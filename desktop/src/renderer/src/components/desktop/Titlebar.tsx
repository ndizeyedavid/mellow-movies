export default function Titlebar() {
  return (
    <div
      className="flex h-9 shrink-0 items-center justify-between border-b border-[#262626] bg-[#0f0f0f] px-4"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 rounded bg-red-600" />
        <span className="text-xs font-bold tracking-[0.18em] text-white">MELLOW MOVIES</span>
        <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-black">DESKTOP</span>
      </div>
      <div className="text-xs text-zinc-500">Electron 32 LTS · No Python needed</div>
    </div>
  );
}
