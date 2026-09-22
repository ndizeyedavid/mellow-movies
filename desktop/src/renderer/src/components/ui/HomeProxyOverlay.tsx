import { useState } from "react";
import { useHomeProxyHealth } from "../../hooks/useHomeProxyHealth";
import { API_BASE_URL } from "../../api/client";
import { showToast } from "../../utils/toast";

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function HomeProxyOverlay() {
  const { isDown, remainingMs, dismissed, dismiss } = useHomeProxyHealth();
  const [showNotifyChoice, setShowNotifyChoice] = useState(false);
  const [notifyMode, setNotifyMode] = useState<"push" | "email" | null>(null);
  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [emailError, setEmailError] = useState("");
  const [pushStatus, setPushStatus] = useState<"idle" | "granted" | "denied" | "unsupported">("idle");

  // Don't render if not down or dismissed
  if (!isDown || dismissed) return null;

  const handleOkay = () => {
    dismiss();
    showToast("We’ll keep trying in the background", { message: "You can keep watching — fallback is active." });
  };

  const handleClose = () => dismiss();

  const handleNotifyClick = () => setShowNotifyChoice((v) => !v);

  const handlePush = async () => {
    setNotifyMode("push");
    if (!("Notification" in window)) {
      setPushStatus("unsupported");
      return;
    }
    if (Notification.permission === "granted") {
      setPushStatus("granted");
      localStorage.setItem("mm-notify-push", "1");
      try {
        new Notification("Mellow Movies — You’ll be notified", {
          body: "Keep this tab open. We’ll ping you when the home server is back.",
          icon: "/icon-192.png",
        });
      } catch {}
      showToast("Push enabled", { message: "Keep this tab open — we’ll notify you when it’s back." });
      return;
    }
    if (Notification.permission === "denied") {
      setPushStatus("denied");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      setPushStatus("granted");
      localStorage.setItem("mm-notify-push", "1");
      try {
        new Notification("Mellow Movies — You’ll be notified", {
          body: "Keep this tab open. We’ll ping you when the home server is back.",
          icon: "/icon-192.png",
        });
      } catch {}
      showToast("Push enabled", { message: "Keep this tab open — we’ll notify you when it’s back." });
    } else {
      setPushStatus("denied");
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmailError("");
    setEmailStatus("saving");
    try {
      const res = await fetch(`${API_BASE_URL}/api/notify/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || data.error || "Failed to save email");
      setEmailStatus("done");
      localStorage.setItem("mm-notify-email", trimmed);
      showToast("You’re on the list", { message: "We’ll email you when the home server is back. Saved for 24h only." });
    } catch (err) {
      setEmailStatus("error");
      setEmailError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const isExpired = remainingMs <= 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Home server down apology"
    >
      {/* Darkened backdrop — no blur */}
      <div
        className="absolute inset-0 bg-black/70 animate-[overlay-in_220ms_ease-out]"
        onClick={handleClose}
        aria-hidden
      />

      {/* Modal card */}
      <div
        className="relative w-full max-w-[520px] overflow-hidden rounded-2xl border border-line bg-card shadow-[0_20px_60px_rgba(0,0,0,0.6)] animate-[modal-in_320ms_cubic-bezier(0.16,1,0.3,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent top bar */}
        <div className="h-1 w-full bg-gradient-to-r from-primary via-primary-dark to-card" />

        {/* Close X */}
        <button
          onClick={handleClose}
          aria-label="Dismiss"
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-soft transition hover:bg-card2 hover:text-white"
        >
          <span aria-hidden className="text-lg leading-none">
            ×
          </span>
        </button>

        <div className="space-y-5 p-6 pt-7 sm:p-7">
          {/* Header */}
          <div className="flex items-start gap-4 pr-6">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <span className="text-xl">😔</span>
            </div>
            <div className="space-y-1">
              <h2 className="text-[18px] font-bold leading-tight text-white sm:text-[20px]">
                Our home server is taking a nap
              </h2>
              <p className="text-[13px] leading-relaxed text-soft">
                The creator’s laptop (our home proxy) is offline — maybe sleeping, at school, or at work.
                Streams still work via fallback, but may be a bit slower. Sorry for the hiccup!
              </p>
            </div>
          </div>

          {/* Countdown */}
          <div className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">We’ll auto-retry for</p>
                <p className="mt-1 font-mono text-[28px] font-bold tracking-tight text-white sm:text-[30px]">
                  {isExpired ? "00:00:00" : formatCountdown(remainingMs)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {isExpired ? "Still trying — will notify you the moment it’s back." : "Fixed 4-hour window from first detection. Survives reloads & tab close."}
                </p>
              </div>
              <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-card2 sm:flex">
                <span className="text-lg">⏳</span>
              </div>
            </div>
            {/* progress */}
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className="h-full bg-primary transition-all duration-1000"
                style={{ width: `${Math.max(0, (remainingMs / (4 * 60 * 60 * 1000)) * 100)}%` }}
              />
            </div>
          </div>

          {/* Actions */}
          {!showNotifyChoice ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={handleOkay}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-dark"
              >
                Okay, continue
              </button>
              <button
                onClick={handleNotifyClick}
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-line bg-card2 px-5 py-3 text-sm font-semibold text-white transition hover:bg-line2"
              >
                Alert me when back
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-line bg-surface p-4 animate-[modal-in_220ms_ease-out]">
              <p className="text-sm font-semibold text-white">How should we alert you?</p>
              <p className="mt-1 text-xs text-muted">Pick one — or both.</p>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  onClick={handlePush}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    notifyMode === "push" ? "border-primary bg-primary/10" : "border-line bg-card2 hover:bg-line2"
                  }`}
                >
                  <span className="block text-sm font-semibold text-white">📱 Phone notification</span>
                  <span className="mt-1 block text-xs text-soft">Keep this tab open</span>
                  {pushStatus === "granted" && <span className="mt-2 block text-xs font-medium text-green-400">Enabled ✓</span>}
                  {pushStatus === "denied" && <span className="mt-2 block text-xs text-red-400">Permission denied — enable in browser settings</span>}
                  {pushStatus === "unsupported" && <span className="mt-2 block text-xs text-red-400">Not supported on this browser</span>}
                </button>

                <button
                  onClick={() => setNotifyMode("email")}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    notifyMode === "email" ? "border-primary bg-primary/10" : "border-line bg-card2 hover:bg-line2"
                  }`}
                >
                  <span className="block text-sm font-semibold text-white">✉️ Email</span>
                  <span className="mt-1 block text-xs text-soft">Deleted after 24h</span>
                </button>
              </div>

              {notifyMode === "push" && (
                <p className="mt-3 rounded-lg bg-black/30 px-3 py-2 text-xs leading-relaxed text-soft">
                  You’ll get a system notification as soon as the home server is back — just leave this tab open and vibe.
                </p>
              )}

              {notifyMode === "email" && (
                <form onSubmit={handleEmailSubmit} className="mt-4 space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="flex-1 rounded-xl border border-line bg-background px-4 py-2.5 text-sm text-white placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                      required
                    />
                    <button
                      type="submit"
                      disabled={emailStatus === "saving" || emailStatus === "done"}
                      className="shrink-0 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
                    >
                      {emailStatus === "saving" ? "Saving…" : emailStatus === "done" ? "Saved ✓" : "Notify me"}
                    </button>
                  </div>
                  {emailError && <p className="text-xs text-red-400">{emailError}</p>}
                  {emailStatus === "done" && (
                    <p className="text-xs text-green-400">Saved! We’ll email you with happy news. Auto-deleted in 24h for security.</p>
                  )}
                  <p className="text-[11px] leading-relaxed text-muted">
                    We store your email only to alert you once — <strong className="text-soft">auto-deleted after 24 hours</strong>. No spam, no sharing. Google SMTP, branded Mellow Movies email.
                  </p>
                </form>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setShowNotifyChoice(false)}
                  className="flex-1 rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-soft hover:text-white"
                >
                  Back
                </button>
                <button
                  onClick={handleOkay}
                  className="flex-1 rounded-xl bg-card2 px-4 py-2.5 text-sm font-medium text-white hover:bg-line2"
                >
                  Continue without alert
                </button>
              </div>
            </div>
          )}

          <p className="text-center text-[11px] text-muted">
            You can dismiss this anytime. It’ll reappear only when a new outage starts.
          </p>
        </div>
      </div>
    </div>
  );
}
