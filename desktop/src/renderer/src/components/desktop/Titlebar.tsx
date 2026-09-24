import { useEffect, useState } from "react";
import { FaXmark } from "react-icons/fa6";
import logoMark from "../../assets/logo-mark.svg";

export default function Titlebar() {
  const [dl, setDl] = useState<{ filename: string; percent: number; active: boolean } | null>(null);

  useEffect(() => {
    const api = (window as unknown as { electronAPI?: import("../../preload").IElectronAPI }).electronAPI;
    if (!api) return;
    const onStart = (info: { filename: string }) => setDl({ filename: info.filename, percent: 0, active: true });
    const onProgress = (info: { filename: string; percent: number }) =>
      setDl((prev) => (prev ? { ...prev, filename: info.filename, percent: info.percent } : { filename: info.filename, percent: info.percent, active: true }));
    const onDone = () => setDl(null);
    const onError = () => setDl(null);
    api.onMediaDownloadStarted?.(onStart);
    api.onMediaDownloadProgress?.(onProgress);
    api.onMediaDownloadDone?.(onDone);
    api.onMediaDownloadError?.(onError);
  }, []);

  const cancel = () => {
    const api = (window as unknown as { electronAPI?: import("../../preload").IElectronAPI }).electronAPI;
    api?.cancelDownload?.();
    setDl(null);
  };

  return (
    <div
      className="flex h-[50px] shrink-0 items-center justify-between border-b border-line bg-surface px-3 select-none"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <div className="flex items-center gap-3">
        <img src={logoMark} alt="Mellow Movies" className="h-5 w-5 shrink-0" />
        <span className="relative text-[11px] font-extrabold tracking-[0.2em] text-white">
          MELLOW <span className="text-primary">MOVIES</span>
          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary ring-1 ring-primary/20">
            Beta
          </span>
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center px-4" style={{ WebkitAppRegion: "drag" } as React.CSSProperties}>
        {dl?.active ? (
          <div className="flex w-full max-w-[420px] items-center gap-2" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="truncate font-semibold text-white" title={dl.filename}>
                  ↓ {dl.filename}
                </span>
                <span className="ml-2 shrink-0 font-mono text-primary">{dl.percent}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-primary transition-all duration-200" style={{ width: `${dl.percent}%` }} />
              </div>
            </div>
            <button
              onClick={cancel}
              aria-label="Cancel download"
              title="Cancel download"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <FaXmark className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex-1" />
        )}
      </div>

      <div className="w-[160px] shrink-0" />
    </div>
  );
}
