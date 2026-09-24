import { contextBridge, ipcRenderer } from "electron";

export interface IElectronAPI {
  fetchMediaHeaders: (url: string, range?: string) => Promise<{ ok: boolean; status: number; headers: Record<string, string>; error?: string }>;
  getStreamUrls: (detailPath: string, se: number, ep: number) => Promise<unknown>;
  getVersion: () => Promise<string>;
  checkForUpdates: () => Promise<string | null>;
  downloadUpdate: () => Promise<void>;
  quitAndInstall: () => Promise<void>;
  onUpdateAvailable: (cb: (info: { version: string; fromVersion: string }) => void) => void;
  onUpdateDownloaded: (cb: (info: { version: string }) => void) => void;
  onDownloadProgress: (cb: (p: { percent: number; transferred: number; total: number; bytesPerSecond: number }) => void) => void;
  onUpdateError: (cb: (msg: string) => void) => void;
  onUpdateNotAvailable: (cb: () => void) => void;
  downloadVideo: (opts: { url: string; filename: string }) => Promise<{ canceled?: boolean; filePath?: string; error?: string }>;
  cancelDownload: () => Promise<boolean>;
  openFileLocation: (filePath: string) => Promise<boolean>;
  openFile: (filePath: string) => Promise<boolean>;
  onMediaDownloadStarted: (cb: (info: { filename: string; filePath: string }) => void) => void;
  onMediaDownloadProgress: (cb: (info: { filename: string; filePath: string; percent: number; transferred: number; total: number }) => void) => void;
  onMediaDownloadDone: (cb: (info: { filename: string; filePath: string }) => void) => void;
  onMediaDownloadError: (cb: (info: { error: string }) => void) => void;
}

const api: IElectronAPI = {
  fetchMediaHeaders: (url, range) => ipcRenderer.invoke("fetch-media-headers", url, range),
  getStreamUrls: (detailPath, se, ep) => ipcRenderer.invoke("get-stream-urls", detailPath, se, ep),
  getVersion: () => ipcRenderer.invoke("get-version"),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
  quitAndInstall: () => ipcRenderer.invoke("quit-and-install"),
  onUpdateAvailable: (cb) => ipcRenderer.on("update-available", (_e, info) => cb(info)),
  onUpdateDownloaded: (cb) => ipcRenderer.on("update-downloaded", (_e, info) => cb(info)),
  onDownloadProgress: (cb) => ipcRenderer.on("download-progress", (_e, p) => cb(p)),
  onUpdateError: (cb) => ipcRenderer.on("update-error", (_e, msg) => cb(msg)),
  onUpdateNotAvailable: (cb) => ipcRenderer.on("update-not-available", () => cb()),
  downloadVideo: (opts) => ipcRenderer.invoke("download-video", opts),
  cancelDownload: () => ipcRenderer.invoke("cancel-download"),
  openFileLocation: (filePath) => ipcRenderer.invoke("open-file-location", filePath),
  openFile: (filePath) => ipcRenderer.invoke("open-file", filePath),
  onMediaDownloadStarted: (cb) => ipcRenderer.on("media-download-started", (_e, info) => cb(info)),
  onMediaDownloadProgress: (cb) => ipcRenderer.on("media-download-progress", (_e, info) => cb(info)),
  onMediaDownloadDone: (cb) => ipcRenderer.on("media-download-done", (_e, info) => cb(info)),
  onMediaDownloadError: (cb) => ipcRenderer.on("media-download-error", (_e, info) => cb(info)),
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electronAPI", api);
  } catch {}
} else {
  // @ts-ignore
  window.electronAPI = api;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
