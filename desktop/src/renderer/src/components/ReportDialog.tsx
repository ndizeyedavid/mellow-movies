import { useState } from "react";
import { sendReport } from "../api/report";
import { showToast } from "../utils/toast";

interface ReportDialogProps {
  open: boolean;
  onClose: () => void;
  context: {
    title?: string;
    detailPath?: string;
    subjectId?: string;
    se?: number;
    ep?: number;
    streamUrl?: string;
    error?: string;
    mediaError?: string;
  };
}

export default function ReportDialog({
  open,
  onClose,
  context,
}: ReportDialogProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  if (!open) return null;

  const submit = async () => {
    setSending(true);
    try {
      const res = await sendReport({
        title: context.title,
        detail_path: context.detailPath,
        subject_id: context.subjectId,
        se: context.se,
        ep: context.ep,
        url: typeof window !== "undefined" ? window.location.href : undefined,
        stream_url: context.streamUrl,
        error: context.error,
        media_error: context.mediaError,
        message: message.trim() || undefined,
      });
      showToast("Report sent", {
        message: res.github_issue
          ? "GitHub issue created"
          : "We'll look into it",
        duration: 3000,
      });
      onClose();
      setMessage("");
    } catch (e) {
      showToast("Report failed", {
        message: e instanceof Error ? e.message : String(e),
        duration: 4000,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-card p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-white">Report playback issue</h3>
        <p className="mt-1 text-sm text-muted">
          This creates an issue for moi the developer to look into and fix it
          ASAP.
        </p>
        <div className="mt-3 rounded-lg bg-black/40 p-3 text-xs text-soft font-mono break-all">
          <div>
            <span className="text-muted">Title:</span> {context.title || "—"}
          </div>
          <div>
            <span className="text-muted">Detail:</span>{" "}
            {context.detailPath || "—"} S{context.se}E{context.ep}
          </div>
          <div>
            <span className="text-muted">Error:</span>{" "}
            {context.error || context.mediaError || "—"}
          </div>
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What happened? (e.g. stuck at 91%, 429, 426, stopped mid-play)"
          className="mt-4 min-h-[90px] w-full rounded-lg border border-line bg-black/40 p-3 text-sm text-white placeholder:text-muted focus:border-primary focus:outline-none"
          maxLength={2000}
        />
        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={sending}
            className="rounded-lg border border-line bg-card px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={sending}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
