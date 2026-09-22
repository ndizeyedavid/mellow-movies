import { API_BASE_URL } from "./client";

export interface ReportPayload {
  title?: string;
  detail_path?: string;
  subject_id?: string;
  se?: number;
  ep?: number;
  url?: string;
  stream_url?: string;
  error?: string;
  media_error?: string;
  message?: string;
  user_agent?: string;
}

export async function sendReport(payload: ReportPayload): Promise<{ ok: boolean; github_issue?: string | null; message?: string }> {
  const r = await fetch(`${API_BASE_URL}/api/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      user_agent: payload.user_agent ?? (typeof navigator !== "undefined" ? navigator.userAgent : undefined),
      url: payload.url ?? (typeof window !== "undefined" ? window.location.href : undefined),
    }),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(text || `Report failed ${r.status}`);
  }
  return r.json();
}
