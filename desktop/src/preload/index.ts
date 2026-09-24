import { contextBridge, ipcRenderer } from "electron";

export interface IElectronAPI {
  fetchMediaHeaders: (url: string, range?: string) => Promise<{ ok: boolean; status: number; headers: Record<string, string>; error?: string }>;
  getStreamUrls: (detailPath: string, se: number, ep: number) => Promise<unknown>;
  checkForUpdates: () => Promise<string | null>;
  quitAndInstall: () => Promise<void>;
  onUpdateAvailable: (cb: () => void) => void;
  onUpdateDownloaded: (cb: () => void) => void;
}

const api: IElectronAPI = {
  fetchMediaHeaders: (url, range) => ipcRenderer.invoke("fetch-media-headers", url, range),
  getStreamUrls: (detailPath, se, ep) => ipcRenderer.invoke("get-stream-urls", detailPath, se, ep),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  quitAndInstall: () => ipcRenderer.invoke("quit-and-install"),
  onUpdateAvailable: (cb) => ipcRenderer.on("update-available", cb),
  onUpdateDownloaded: (cb) => ipcRenderer.on("update-downloaded", cb),
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
