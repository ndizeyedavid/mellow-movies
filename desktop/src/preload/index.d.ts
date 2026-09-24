import type { IElectronAPI } from "./index";

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
