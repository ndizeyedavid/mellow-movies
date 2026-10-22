// Electron shim — replaces Tauri desktopBridge. No Rust needed.
export const isTauri = () => false;
export const onMediaKey = (_cb: (action: string) => void) => () => {};
export const toggleMiniPlayer = async () => {};
// The Electron shell has no splash handshake; kept so shared pages can call it.
export const emitAppReady = () => {};
