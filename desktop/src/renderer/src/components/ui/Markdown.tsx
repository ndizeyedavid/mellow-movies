import React from "react";

/**
 * Minimal markdown renderer for release notes. Handles headings, bullet lists,
 * paragraphs, and inline bold / code / links. Keeps the output safe (React
 * elements, no dangerouslySetInnerHTML).
 */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      parts.push(<strong key={key++} className="font-semibold text-white">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      parts.push(
        <code key={key++} className="rounded bg-white/10 px-1 py-0.5 font-mono text-xs text-soft">
          {tok.slice(1, -1)}
        </code>,
      );
    } else {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (lm) {
        parts.push(
          <a key={key++} href={lm[2]} target="_blank" rel="noreferrer" className="text-primary underline hover:text-primary/80">
            {lm[1]}
          </a>,
        );
      } else {
        parts.push(tok);
      }
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function Markdown({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) { i++; continue; }

    const hm = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (hm) {
      const level = hm[1].length;
      const cls =
        level === 1
          ? "text-base font-extrabold text-white"
          : level === 2
            ? "text-sm font-bold text-white"
            : "text-xs font-bold uppercase tracking-wide text-muted";
      out.push(
        <div key={key++} className={cls + " mt-3 first:mt-0"}>
          {renderInline(hm[2])}
        </div>,
      );
      i++;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      out.push(
        <ul key={key++} className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-soft">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    const para: string[] = [trimmed];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3})\s+/.test(lines[i].trim()) &&
      !/^[-*]\s+/.test(lines[i].trim())
    ) {
      para.push(lines[i].trim());
      i++;
    }
    out.push(
      <p key={key++} className="mt-2 text-sm leading-relaxed text-soft first:mt-0">
        {renderInline(para.join(" "))}
      </p>,
    );
  }
  return <>{out}</>;
}
