import { app, BrowserWindow, ipcMain, protocol, net, session } from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import { autoUpdater } from "electron-updater";

// Phase 0 Spike: prove Referer spoof works with correct bcdn URL
// Phase 1 IPC: Attempt A — client-direct residential fetch via main
// No python sub-child needed.

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#141414",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });

  // Custom protocol mellow://fetch?u=<cdn> -> streams with correct Referer
  // Keeps <video src="mellow://fetch?u=https://bcdnxw..."> working without CORS.
  protocol.handle("mellow", async (request) => {
    const url = new URL(request.url);
    if (url.hostname === "fetch") {
      const target = url.searchParams.get("u");
      if (!target) return new Response("missing u", { status: 400 });
      const range = request.headers.get("range") || undefined;
      // Stream via Node fetch with correct Referer from residential IP
      const headers: Record<string, string> = {
        Referer: "https://moviebox.ph/",
        Origin: "https://moviebox.ph",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "*/*",
      };
      if (range) headers["Range"] = range;
      try {
        const upstream = await net.fetch(target, { headers, redirect: "follow" });
        // net.fetch returns Response; pipe it back
        return new Response(upstream.body, {
          status: upstream.status,
          statusText: upstream.statusText,
          headers: {
            "Content-Type": upstream.headers.get("content-type") || "video/mp4",
            "Content-Length": upstream.headers.get("content-length") || "",
            "Content-Range": upstream.headers.get("content-range") || "",
            "Accept-Ranges": upstream.headers.get("accept-ranges") || "bytes",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store",
          },
        });
      } catch (e) {
        return new Response(String(e), { status: 502 });
      }
    }
    return new Response("not found", { status: 404 });
  });

  // Fallback: also patch bcdn/hakunaymatata Referer via webRequest for direct <video src="https://bcdnxw...">
  // Use broad filter and check hostname inside, because Chromium URL patterns
  // only allow "*://*.example.com/*" wildcards, not "*://bcdn*/*".
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ["*://*/*"] },
    (details, callback) => {
      try {
        const host = new URL(details.url).hostname;
        if (host.includes("hakunaymatata.com") || host.includes("b-cdn.net") || host.includes("aoneroom.com") || host.startsWith("bcdn")) {
          details.requestHeaders["Referer"] = "https://moviebox.ph/";
          details.requestHeaders["Origin"] = "https://moviebox.ph";
        }
      } catch {}
      callback({ requestHeaders: details.requestHeaders });
    },
  );

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.mellow.movies");

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // IPC: Attempt A direct fetch for Spike + Player
  ipcMain.handle("fetch-media-headers", async (_e, url: string, range?: string) => {
    const headers: Record<string, string> = {
      Referer: "https://moviebox.ph/",
      Origin: "https://moviebox.ph",
      Accept: "*/*",
    };
    if (range) headers["Range"] = range;
    try {
      const r = await net.fetch(url, { headers });
      return {
        ok: r.ok,
        status: r.status,
        headers: Object.fromEntries(r.headers.entries()),
      };
    } catch (e) {
      return { ok: false, status: 0, error: String(e) };
    }
  });

  ipcMain.handle("get-stream-urls", async (_e, detailPath: string, se: number, ep: number) => {
    // Proxy to backend for signing; backend still handles X-Forwarded-For at :750
    const base = process.env.VITE_API_BASE || "https://mellow-movies.fastapicloud.dev";
    // We need subjectId — renderer will pass full; for now placeholder
    return { base, detailPath, se, ep, note: "renderer should call backend/api/stream directly via fetch" };
  });

  // Auto-updater (GitHub Releases, side-load)
  autoUpdater.autoDownload = false;
  autoUpdater.on("update-available", () => {
    mainWindow?.webContents.send("update-available");
  });
  autoUpdater.on("update-downloaded", () => {
    mainWindow?.webContents.send("update-downloaded");
  });
  ipcMain.handle("check-for-updates", async () => {
    try {
      const res = await autoUpdater.checkForUpdates();
      return res ? res.updateInfo.version : null;
    } catch {
      return null;
    }
  });
  ipcMain.handle("quit-and-install", () => {
    autoUpdater.quitAndInstall();
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Check for updates on start (only in production)
  if (!is.dev) {
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 4000);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
