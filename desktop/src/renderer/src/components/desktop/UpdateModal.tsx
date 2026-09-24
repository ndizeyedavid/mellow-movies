import { useEffect } from "react";
import { FaDownload, FaRocket, FaClock, FaXmark } from "react-icons/fa6";

interface UpdateModalProps {
  open: boolean;
  fromVersion: string;
  toVersion: string;
  downloading: boolean;
  progress: number; // 0-100
  downloaded: boolean;
  onClose: () => void;
  onUpdateNow: () => void;
  onRemindLater: () => void;
  onRestartNow: () => void;
  onRestartLater: () => void;
}

export default function UpdateModal({
  open,
  fromVersion,
  toVersion,
  downloading,
  progress,
  downloaded,
  onClose,
  onUpdateNow,
  onRemindLater,
  onRestartNow,
  onRestartLater,
}: UpdateModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Update available"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] overflow-hidden rounded-[10px] border border-line bg-card shadow-2xl animate-[modal-in_.25s_ease-out]"
      >
        {/* header */}
        <div className="px-6 pb-4 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className=" flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white ">
              <FaRocket className="h-5 w-5" />
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-muted hover:bg-white/10 hover:text-white"
            >
              <FaXmark className="h-3.5 w-3.5" />
            </button>
          </div>

          {!downloaded ? (
            <>
              <h3 className="mt-4 text-xl font-extrabold leading-tight text-white">
                Update available
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                A new version of Mellow Movies is ready. You are on{" "}
                <span className="font-semibold text-white">v{fromVersion}</span>{" "}
                and{" "}
                <span className="font-semibold text-white">v{toVersion}</span>{" "}
                is available with the latest fixes and improvements.
              </p>

              {/* version pill */}
              <div className="mt-4 flex items-center gap-2">
                <span className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold text-soft">
                  v{fromVersion}
                </span>
                <span className="text-muted">→</span>
                <span className="rounded-full border border-primary/30 bg-primary px-3 py-1 text-xs font-bold text-white">
                  v{toVersion}
                </span>
                <span className="ml-auto hidden items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold tracking-widest text-emerald-400 sm:inline-flex">
                  RECOMMENDED
                </span>
              </div>
            </>
          ) : (
            <>
              <h3 className="mt-4 text-xl font-extrabold leading-tight text-white">
                Ready to restart
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                <span className="font-semibold text-white">v{toVersion}</span>{" "}
                has been downloaded. Restart now to apply the update, or do it
                later — we will remind you on the next launch.
              </p>
            </>
          )}
        </div>

        {/* progress */}
        {downloading && !downloaded && (
          <div className="px-6 pb-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-white">
                <FaDownload className="h-3 w-3 text-primary" /> Downloading…{" "}
                {Math.round(progress)}%
              </span>
              <span className="font-mono text-muted">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              Keep the app open — this usually takes 30 to 90 seconds on Wi-Fi.
            </p>
          </div>
        )}

        {downloaded && (
          <div className="mx-6 mb-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Download
              complete — restart to apply v{toVersion}
            </p>
          </div>
        )}

        {/* actions */}
        <div className="flex items-center justify-end gap-3 bg-surface/50 px-6 py-4 backdrop-blur">
          {!downloaded ? (
            <>
              <button
                onClick={onRemindLater}
                disabled={downloading}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-5 py-2.5 text-sm font-semibold text-white transition hover:border-line2 disabled:opacity-40"
              >
                <FaClock className="h-3.5 w-3.5 text-muted" /> Remind me later
              </button>
              <button
                onClick={onUpdateNow}
                disabled={downloading}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(229,0,0,0.35)] transition hover:bg-primary-dark disabled:opacity-50"
              >
                {downloading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />{" "}
                    Downloading…
                  </>
                ) : (
                  <>
                    <FaDownload className="h-3.5 w-3.5" /> Update now
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onRestartLater}
                className="rounded-full border border-line bg-card px-5 py-2.5 text-sm font-semibold text-white hover:border-line2"
              >
                Later
              </button>
              <button
                onClick={onRestartNow}
                className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(229,0,0,0.35)] hover:bg-primary-dark"
              >
                Restart now
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes modal-in{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
    </div>
  );
}
