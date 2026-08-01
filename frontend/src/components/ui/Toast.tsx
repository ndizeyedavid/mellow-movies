import { useSyncExternalStore } from "react";
import { FaRegBookmark, FaXmark } from "react-icons/fa6";
import {
  dismissToast,
  getToast,
  subscribeToast,
} from "../../utils/toast";

/**
 * Global in-app toast. Rendered once in the layout; any code can show one
 * via `showToast(...)`. Fixed bottom-right, auto-dismisses, supports an
 * optional action button (e.g. "View My List").
 */
export default function Toast() {
  const toast = useSyncExternalStore(subscribeToast, getToast);

  if (!toast) return null;

  const run = (fn: () => void) => () => {
    dismissToast();
    fn();
  };

  return (
    <div className="fixed bottom-5 left-4 right-4 z-[80] animate-toast-in sm:left-auto sm:right-6 sm:w-[380px]">
      <div className="flex items-start gap-3.5 rounded-xl border border-line2 bg-card p-4 shadow-2xl shadow-black/50">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <FaRegBookmark className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{toast.title}</p>
          {toast.message && (
            <p className="mt-0.5 line-clamp-2 text-sm text-soft">
              {toast.message}
            </p>
          )}
          {toast.action && (
            <button
              onClick={run(toast.action.onClick)}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-primary transition-colors duration-200 hover:text-white"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          onClick={dismissToast}
          aria-label="Dismiss notification"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-200 hover:bg-card2 hover:text-white"
        >
          <FaXmark className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
