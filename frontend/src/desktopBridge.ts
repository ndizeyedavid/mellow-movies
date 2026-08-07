/**
 * Desktop bridge — talks to the Tauri shell when this app runs inside it.
 * In a normal browser (Vercel) every call is a guarded no-op, so the web
 * build never touches Tauri APIs and never crashes.
 */

export type MediaKeyAction = "playpause" | "next" | "prev";

const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Tell the shell the SPA booted → it closes the native splash. */
export function emitAppReady(): void {
  if (!isTauri()) return;
  void import("@tauri-apps/api/event")
    .then(({ emit }) => emit("app:ready"))
    .catch(() => {});
}

/** Subscribe to global media-key presses forwarded by the shell. */
export function onMediaKey(
  handler: (action: MediaKeyAction) => void,
): () => void {
  if (!isTauri()) return () => {};
  let unlisten: (() => void) | undefined;
  import("@tauri-apps/api/event")
    .then(({ listen }) =>
      listen<MediaKeyAction>("media-key", (e) => handler(e.payload)),
    )
    .then((u) => {
      unlisten = u;
    })
    .catch(() => {});
  return () => unlisten?.();
}

/** Snap the main window into the always-on-top mini player (or back). */
export async function toggleMiniPlayer(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<boolean>("toggle_mini");
  } catch {
    return false;
  }
}

export { isTauri };
