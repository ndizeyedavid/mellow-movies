import { useEffect, useState } from "react";

interface BufferingIndicatorProps {
  /** Label shown under the ring. */
  label?: string;
}

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Fake progress cap — stays short of 100 so the user knows it's buffering. */
const FAKE_MAX = 92;

/**
 * Circular buffering indicator with a fake percentage. The number climbs
 * quickly at first, then eases toward the cap — the classic "something is
 * happening" illusion. Real completion unmounts this component.
 */
export default function BufferingIndicator({
  label = "Loading",
}: BufferingIndicatorProps) {
  const [progress, setProgress] = useState(4);

  useEffect(() => {
    const id = window.setInterval(() => {
      setProgress((p) => p + (FAKE_MAX - p) * 0.055);
    }, 70);
    return () => window.clearInterval(id);
  }, []);

  const shown = Math.min(99, Math.floor(progress));

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-5"
      role="status"
      aria-label={`${label}: ${shown}%`}
    >
      <div className="relative h-20 w-20">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          {/* Track */}
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="6"
          />
          {/* Progress arc */}
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - shown / 100)}
            className="text-primary transition-[stroke-dashoffset] duration-150 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-semibold tabular-nums text-white">
            {shown}%
          </span>
        </div>
      </div>
      <p className="text-sm text-soft">{label}…</p>
    </div>
  );
}
