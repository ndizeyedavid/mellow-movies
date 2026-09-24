import logoMark from "../../assets/logo-mark.svg";

export default function Titlebar() {
  return (
    <div
      className="flex h-[50px] shrink-0 items-center justify-between border-b border-line bg-surface px-3 select-none"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Left — branding (red) */}
      <div className="flex items-center gap-3">
        <img src={logoMark} alt="Mellow Movies" className="h-5 w-5 shrink-0" />
        <span className="relative text-[11px] font-extrabold tracking-[0.2em] text-white">
          MELLOW <span className="text-primary">MOVIES</span>
          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary ring-1 ring-primary/20">
            Beta
          </span>
        </span>
      </div>

      {/* Center — window drag region */}
      <div className="flex-1" />
    </div>
  );
}
