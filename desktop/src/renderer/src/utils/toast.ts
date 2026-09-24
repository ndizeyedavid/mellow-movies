export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastPayload {
  id: number;
  title: string;
  message?: string;
  action?: ToastAction;
}

let current: ToastPayload | null = null;
let timer: number | undefined;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeToast(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getToast(): ToastPayload | null {
  return current;
}

/** Show a small in-app notification. Auto-dismisses after `duration` ms. */
export function showToast(
  title: string,
  opts?: { message?: string; action?: ToastAction; duration?: number },
) {
  window.clearTimeout(timer);
  current = { id: Date.now(), title, message: opts?.message, action: opts?.action };
  timer = window.setTimeout(() => {
    current = null;
    emit();
  }, opts?.duration ?? 4500);
  emit();
}

export function dismissToast() {
  window.clearTimeout(timer);
  current = null;
  emit();
}
