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
