import { app, BrowserWindow, ipcMain, protocol, net, session, shell, dialog } from "electron";
import { join } from "path";
import * as fs from "fs";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import { autoUpdater } from "electron-updater";

// Phase 0 Spike: prove Referer spoof works with correct bcdn URL
// Phase 1 IPC: Attempt A — client-direct residential fetch via main
// No python sub-child needed.

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1100,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#141414",
      symbolColor: "#ffffff",
      height: 36,
    },
    backgroundColor: "#141414",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Fallback — if ready-to-show never fires (Vite HMR hiccup), force show after 3s
  const showTimer = setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      console.warn("[main] forcing window show (ready-to-show timeout)");
      mainWindow.show();
    }
  }, 3000);

  mainWindow.once("ready-to-show", () => {
    clearTimeout(showTimer);
    mainWindow?.show();
  });

  mainWindow.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.error(`[webContents] did-fail-load ${code} ${desc} ${url}`);
  });

  mainWindow.webContents.on("console-message", (_e, level, message) => {
    if (level === 2 || level === 3) console.warn(`[renderer:${level}] ${message}`);
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

  // External links → OS default browser, not the app window.
  // Handles <a target="_blank" href="https://..."> and window.open.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const isAppUrl = url.startsWith("file://") || url.startsWith("mellow://");
    const isDevUrl = is.dev && url.startsWith("http://localhost:");
    if (!isAppUrl && !isDevUrl) {
      event.preventDefault();
      if (url.startsWith("https://") || url.startsWith("http://")) {
        shell.openExternal(url);
      }
    }
  });

  // Patch bcdn/hakunaymatata Referer via webRequest for direct <video src="https://bcdnxw...">
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
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.on("update-available", (info) => {
    mainWindow?.webContents.send("update-available", {
      version: info.version,
      fromVersion: app.getVersion(),
    });
  });
  autoUpdater.on("update-downloaded", (info) => {
    mainWindow?.webContents.send("update-downloaded", { version: info.version });
  });
  autoUpdater.on("download-progress", (p) => {
    mainWindow?.webContents.send("download-progress", {
      percent: p.percent,
      transferred: p.transferred,
      total: p.total,
      bytesPerSecond: p.bytesPerSecond,
    });
  });
  autoUpdater.on("error", (err) => {
    mainWindow?.webContents.send("update-error", String(err?.message || err));
  });
  ipcMain.handle("get-version", () => app.getVersion());
  ipcMain.handle("check-for-updates", async () => {
    try {
      const res = await autoUpdater.checkForUpdates();
      return res ? res.updateInfo.version : null;
    } catch {
      return null;
    }
  });
  ipcMain.handle("download-update", async () => {
    await autoUpdater.downloadUpdate();
  });
  ipcMain.handle("quit-and-install", () => {
    autoUpdater.quitAndInstall();
  });

  // Media download: ask where to save, stream with Referer, report progress to Titlebar + sender
  let activeDownloadPath: string | null = null;
  let activeDownloadAbort: AbortController | null = null;
  let activeDownloadFileStream: fs.WriteStream | null = null;

  ipcMain.handle("cancel-download", async () => {
    if (activeDownloadAbort) {
      activeDownloadAbort.abort();
    }
    if (activeDownloadFileStream) {
      try {
        activeDownloadFileStream.destroy();
      } catch {}
    }
    if (activeDownloadPath) {
      try {
        if (fs.existsSync(activeDownloadPath)) fs.unlinkSync(activeDownloadPath);
      } catch {}
    }
    if (mainWindow) {
      mainWindow.webContents.send("media-download-error", { error: "Canceled" });
      mainWindow.setProgressBar(-1);
    }
    activeDownloadPath = null;
    activeDownloadFileStream = null;
    activeDownloadAbort = null;
    return true;
  });

  ipcMain.handle("download-video", async (_e, payload: { url: string; filename: string }) => {
    if (!mainWindow) return { canceled: true, error: "No window" };
    const suggested = payload.filename || "video.mp4";
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: suggested,
      filters: [
        { name: "Video", extensions: ["mp4", "mkv", "webm"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    if (canceled || !filePath) return { canceled: true };

    activeDownloadPath = filePath;
    activeDownloadAbort = new AbortController();
    mainWindow.webContents.send("media-download-started", { filename: suggested, filePath });
    mainWindow.setProgressBar(0);

    const isDirectBcdn =
      filePath && (payload.url.includes("hakunaymatata.com") || payload.url.includes("bcdn") || payload.url.includes("aoneroom.com"));
    const headers: Record<string, string> = isDirectBcdn
      ? {
          Referer: "https://moviebox.ph/",
          Origin: "https://moviebox.ph",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "*/*",
        }
      : {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        };

    try {
      const res = await net.fetch(payload.url, { headers, redirect: "follow", signal: activeDownloadAbort.signal } as RequestInit);
      if (!res.ok || !res.body) {
        throw new Error(`Download failed: ${res.status} ${res.statusText}`);
      }
      const total = Number(res.headers.get("content-length") || 0);
      const fileStream = fs.createWriteStream(filePath);
      activeDownloadFileStream = fileStream;
      const reader = (res.body as ReadableStream<Uint8Array>).getReader();
      let received = 0;
      let lastSent = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            await new Promise<void>((resolve, reject) => {
              fileStream.write(Buffer.from(value), (err) => (err ? reject(err) : resolve()));
            });
            received += value.length;
            const now = Date.now();
            if (now - lastSent > 160 || received === total) {
              lastSent = now;
              const percent = total ? Math.min(99, Math.round((received / total) * 100)) : 0;
              mainWindow?.webContents.send("media-download-progress", {
                filename: suggested,
                filePath,
                percent,
                transferred: received,
                total,
              });
              if (total) mainWindow?.setProgressBar(percent / 100);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
      await new Promise<void>((resolve, reject) => {
        fileStream.end((err?: Error | null) => (err ? reject(err) : resolve()));
      });
      mainWindow.webContents.send("media-download-done", { filename: suggested, filePath });
      mainWindow.setProgressBar(-1);
      activeDownloadPath = null;
      activeDownloadFileStream = null;
      activeDownloadAbort = null;
      return { canceled: false, filePath };
    } catch (err) {
      const isAbort = err instanceof Error && (err.name === "AbortError" || String(err).includes("aborted"));
      if (!isAbort) {
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch {}
      }
      if (!isAbort) mainWindow.webContents.send("media-download-error", { error: String(err) });
      mainWindow.setProgressBar(-1);
      activeDownloadPath = null;
      activeDownloadFileStream = null;
      activeDownloadAbort = null;
      if (isAbort) return { canceled: true };
      return { canceled: false, error: String(err) };
    }
  });

  ipcMain.handle("open-file-location", async (_e, filePath: string) => {
    if (!filePath) return false;
    shell.showItemInFolder(filePath);
    return true;
  });

  ipcMain.handle("open-file", async (_e, filePath: string) => {
    if (!filePath) return false;
    const res = await shell.openPath(filePath);
    return res === "";
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
