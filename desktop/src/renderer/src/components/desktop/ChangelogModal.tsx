import { useEffect, useState } from "react";
import { FaCircleCheck, FaRocket, FaXmark, FaGithub } from "react-icons/fa6";

interface ChangelogModalProps {
  open: boolean;
  version: string;
  onClose: () => void;
}

export default function ChangelogModal({
  open,
  version,
  onClose,
}: ChangelogModalProps) {
  const [notes, setNotes] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !version) return;
    let alive = true;
    setLoading(true);
    // Fetch release notes for this tag from GitHub (public, no auth)
    fetch(
      `https://api.github.com/repos/ndizeyedavid/mellow-movies/releases/tags/v${version}`,
      {
        headers: { Accept: "application/vnd.github+json" },
      },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        if (j?.body) setNotes(j.body as string);
        else setNotes(null);
      })
      .catch(() => {
        if (alive) setNotes(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, version]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="What's new"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[82vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[10px] border border-line bg-card shadow-2xl animate-[modal-in_.25s_ease-out]"
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-primary to-violet-500" />

        <div className="flex items-start justify-between gap-4 px-6 pb-3 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white shadow">
              <FaCircleCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold leading-none text-white">
                Updated to v{version}
              </h3>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{" "}
                Successfully installed
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-muted hover:bg-white/10 hover:text-white"
          >
            <FaXmark className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="px-6">
          <div className="rounded-xl border border-line bg-surface px-4 py-3">
            <p className="flex items-center gap-2 text-xs font-bold tracking-widest text-muted">
              <FaRocket className="h-3.5 w-3.5 text-primary" /> WHAT&apos;S NEW
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              Mellow Movies v{version} is now running
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Here is what changed in this version. You can always find the full
              history on GitHub Releases.
            </p>
          </div>
        </div>

        <div className="mt-4 flex-1 overflow-auto px-6 pb-2">
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />{" "}
              Loading changelog…
            </div>
          ) : notes ? (
            <div className="rounded-xl border border-line bg-background p-4">
              <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-soft">
                {notes}
              </pre>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line bg-background p-4 text-center">
              <p className="text-sm font-semibold text-white">
                You are on the latest version
              </p>
              <p className="mt-1 text-xs text-muted">
                Changelog is not available offline. Check GitHub Releases for
                details.
              </p>
              <a
                href={`https://github.com/ndizeyedavid/mellow-movies/releases/tag/v${version}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold text-white hover:border-line2"
              >
                <FaGithub className="h-3.5 w-3.5" /> View release on GitHub
              </a>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line bg-surface/50 px-6 py-4">
          <a
            href={`https://github.com/ndizeyedavid/mellow-movies/releases/tag/v${version}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-white"
          >
            <FaGithub className="h-3.5 w-3.5" /> Full release notes
          </a>
          <button
            onClick={onClose}
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(229,0,0,0.35)] hover:bg-primary-dark"
          >
            Continue
          </button>
        </div>
      </div>

      <style>{`@keyframes modal-in{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
    </div>
  );
}
