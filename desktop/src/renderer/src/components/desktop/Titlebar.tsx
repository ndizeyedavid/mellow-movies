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
        <span className="text-[11px] font-extrabold tracking-[0.2em] text-white">
          MELLOW <span className="text-primary">MOVIES</span>
        </span>
      </div>

      {/* Center — window drag region */}
      <div className="flex-1" />
    </div>
  );
}
