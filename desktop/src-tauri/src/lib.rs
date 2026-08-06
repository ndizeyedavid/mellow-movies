use std::sync::Mutex;

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Listener, Manager, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_global_shortcut::GlobalShortcutExt;
use tauri_plugin_global_shortcut::ShortcutState;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

/// Keep the spawned backend alive for the whole app lifetime.
struct BackendHandle(Mutex<Option<CommandChild>>);

/// Spawn the FastAPI backend (frozen sidecar exe) on the same port the
/// webview loads — one process, one port, API + SPA together.
fn spawn_backend(app: &AppHandle) {
    let child = app
        .shell()
        .sidecar("mellow-backend")
        .ok()
        .and_then(|cmd| cmd.args(["--port", "8000"]).spawn().ok())
        .map(|(_, child)| child);
    app.manage(BackendHandle(Mutex::new(child)));
}

/// Toggle "mini player" (PiP): snap the main window into an always-on-top
/// compact box, or restore it back.
#[tauri::command]
fn toggle_mini(window: tauri::WebviewWindow) -> Result<bool, String> {
    let on_top = window.is_always_on_top().map_err(|e| e.to_string())?;
    if on_top {
        window
            .set_always_on_top(false)
            .and_then(|_| window.set_size(tauri::LogicalSize::new(1280.0, 800.0)))
            .and_then(|_| window.set_title("Mellow Movies"))
            .map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        window
            .set_always_on_top(true)
            .and_then(|_| window.set_size(tauri::LogicalSize::new(440.0, 320.0)))
            .and_then(|_| window.set_title("Mellow Movies — Mini"))
            .map_err(|e| e.to_string())?;
        Ok(true)
    }
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

/// Forward one global media key to the webview as a "media-key" event.
fn register_global_shortcut(app: &AppHandle, shortcut: &str, action: &'static str) {
    let Ok(shortcut) = shortcut.parse::<tauri_plugin_global_shortcut::Shortcut>() else {
        return;
    };
    let _ = app.global_shortcut().on_shortcut(
        shortcut,
        move |app, _s, event| {
            if event.state() == ShortcutState::Pressed {
                let _ = app.emit("media-key", action);
            }
        },
    );
}

fn register_media_keys(app: &AppHandle) {
    register_global_shortcut(app, "MediaPlayPause", "playpause");
    register_global_shortcut(app, "MediaNextTrack", "next");
    register_global_shortcut(app, "MediaPreviousTrack", "prev");
}

fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Open Mellow Movies", true, None::<&str>)?;
    let mini = MenuItem::with_id(app, "mini", "Toggle Mini Player", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &mini, &quit])?;

    let tray = TrayIconBuilder::with_id("tray")
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            if let Some(w) = app.get_webview_window("main") {
                match event.id().as_ref() {
                    "show" => {
                        let _ = w.show();
                        let _ = w.unminimize();
                        let _ = w.set_focus();
                    }
                    "mini" => {
                        let _ = w.set_always_on_top(true);
                        let _ = w.set_size(tauri::LogicalSize::new(440.0, 320.0));
                    }
                    "quit" => app.exit(0),
                    _ => {}
                }
            }
        })
        .build(app)?;

    // The tray must outlive this scope or Windows drops it.
    std::mem::forget(tray);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    if let Err(e) = run_inner() {
        eprintln!("Mellow Movies failed to launch: {e}");
    }
}

fn run_inner() -> tauri::Result<()> {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // Second launch → focus the already-running app.
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![toggle_mini, quit_app])
        .setup(|app| {
            spawn_backend(app.handle());

            // Main window → loads the app from the bundled backend.
            let main = WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::External("http://127.0.0.1:8000".parse().unwrap()),
            )
            .title("Mellow Movies")
            .inner_size(1280.0, 800.0)
            .min_inner_size(920.0, 600.0)
            .build()?;

            // Native splash that hides once the real app signals "ready".
            let splash = WebviewWindowBuilder::new(
                app,
                "splash",
                WebviewUrl::App("splash.html".into()),
            )
            .title("Mellow Movies")
            .inner_size(420.0, 620.0)
            .resizable(false)
            .decorations(false)
            .always_on_top(true)
            .build()?;
            splash.center()?;
            splash.show()?;
            main.show()?;

            // The webview tells us when the SPA booted → kill the splash.
            let handle = app.handle().clone();
            app.listen("app:ready", move |_| {
                if let Some(w) = handle.get_webview_window("splash") {
                    let _ = w.destroy();
                }
            });

            register_media_keys(app.handle());
            setup_tray(app.handle())?;

            Ok(())
        })
        .build(tauri::generate_context!())?
        .run(|app, event| {
            // Closing the main window hides it to the tray instead of quitting.
            if let tauri::RunEvent::WindowEvent {
                event:
                    tauri::WindowEvent::CloseRequested { api, .. },
                ..
            } = event
            {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.hide();
                }
                api.prevent_close();
            }
        });
    Ok(())
}
