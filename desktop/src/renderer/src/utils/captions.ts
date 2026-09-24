/**
 * Caption helpers. The moviebox API serves subtitles as `.srt` files, but
 * the browser's native <track> element only plays WebVTT. Convert SRT → VTT
 * and expose it as a blob: URL.
 */

/** Convert SRT subtitle text to WebVTT. */
export function srtToVtt(srt: string): string {
  const body = srt
    .replace(/\r/g, "")
    .replace(/^\uFEFF/, "")
    .replace(/WEBVTT[^\n]*\n?/i, "")
    // SRT uses commas in timestamps, VTT uses dots.
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")
    .trim();
  return `WEBVTT\n\n${body}\n`;
}

/** Fetch an SRT caption and return a blob: URL to the VTT version. */
export async function srtUrlToVttBlob(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Subtitle fetch failed: ${res.status}`);
  const blob = new Blob([srtToVtt(await res.text())], { type: "text/vtt" });
  return URL.createObjectURL(blob);
}
