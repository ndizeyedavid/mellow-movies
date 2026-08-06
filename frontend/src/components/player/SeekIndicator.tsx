import { IoIosFastforward } from "react-icons/io";

interface SeekIndicatorProps {
  side: "left" | "right";
  seconds?: number;
}

/**
 * YouTube-style circular seek flash shown by the player on a double-tap
 * seek. The circular arrow marks the tapped side and the scrub seconds.
 * Animation is driven inline (seek-flash keyframes) so it always plays.
 */
export default function SeekIndicator({
  side,
  seconds = 10,
}: SeekIndicatorProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute top-1/2 z-20 flex flex-col items-center gap-2 ${
        side === "left" ? "left-[7%]" : "right-[7%]"
      }`}
      style={{ animation: "seek-flash 0.55s ease-out forwards" }}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/25 bg-black/60 backdrop-blur-md">
        {side === "left" ? (
          <IoIosFastforward className="h-7 w-7 text-white rotate-180" />
        ) : (
          <IoIosFastforward className="h-7 w-7 text-white" />
        )}
      </div>
      <span className="rounded-full bg-black/60 px-2.5 py-1 text-sm font-semibold text-white backdrop-blur-md">
        {side === "left" ? "-" : "+"}
        {seconds} s
      </span>
    </div>
  );
}
