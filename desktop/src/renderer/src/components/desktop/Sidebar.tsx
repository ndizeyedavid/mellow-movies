import { NavLink, useLocation } from "react-router-dom";
import { FaHouse, FaFilm, FaTv, FaMagnifyingGlass, FaBookmark, FaCircleInfo, FaGear } from "react-icons/fa6";

const main = [
  { to: "/", label: "Home", icon: FaHouse },
  { to: "/movies", label: "Movies", icon: FaFilm },
  { to: "/shows", label: "TV Shows", icon: FaTv },
  { to: "/browse", label: "Browse", icon: FaMagnifyingGlass },
  { to: "/my-list", label: "My List", icon: FaBookmark },
];

const secondary = [
  { to: "/search", label: "Search", icon: FaMagnifyingGlass },
  { to: "/support", label: "Support", icon: FaCircleInfo },
];

export default function Sidebar() {
  const loc = useLocation();
  return (
    <aside className="flex w-[230px] shrink-0 flex-col border-r border-[#262626] bg-[#141414]">
      <div className="flex-1 p-3">
        <p className="px-3 py-2 text-[11px] font-semibold tracking-widest text-zinc-500">DISCOVER</p>
        <nav className="space-y-1">
          {main.map((it) => {
            const active = loc.pathname === it.to;
            const Icon = it.icon;
            return (
              <NavLink
                key={it.to}
                to={it.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-white text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" /> {it.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-6 border-t border-[#262626] pt-4">
          <p className="px-3 py-2 text-[11px] font-semibold tracking-widest text-zinc-500">TOOLS</p>
          <nav className="space-y-1">
            {secondary.map((it) => {
              const Icon = it.icon;
              return (
                <NavLink
                  key={it.to}
                  to={it.to}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white"
                >
                  <Icon className="h-3.5 w-3.5" /> {it.label}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="mt-6 rounded-xl border border-amber-900/30 bg-amber-950/20 p-3">
          <p className="text-xs font-semibold text-amber-400">Attempt A</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            Direct residential fetch via Electron main with{" "}
            <code className="rounded bg-black px-1 py-0.5">Referer: moviebox.ph</code>. No proxy.py.
          </p>
        </div>
      </div>

      <div className="border-t border-[#262626] p-3">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <FaGear className="h-3.5 w-3.5" /> <span>v1.0.0 — feat/desktop-electron</span>
        </div>
      </div>
    </aside>
  );
}
