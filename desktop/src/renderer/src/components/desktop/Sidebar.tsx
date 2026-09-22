import { NavLink, useLocation } from "react-router-dom";
import {
  FaHouse,
  FaFilm,
  FaTv,
  FaCompass,
  FaMagnifyingGlass,
  FaBookmark,
  FaCircleInfo,
  FaShieldHalved,
  FaCirclePlay,
  FaGithub,
} from "react-icons/fa6";

const main = [
  { to: "/", label: "Home", icon: FaHouse },
  { to: "/movies", label: "Movies", icon: FaFilm },
  { to: "/shows", label: "TV Shows", icon: FaTv },
  { to: "/browse", label: "Browse All", icon: FaCompass },
  { to: "/my-list", label: "My List", icon: FaBookmark },
];

const secondary = [
  { to: "/search", label: "Search", icon: FaMagnifyingGlass },
  { to: "/support", label: "Support", icon: FaCircleInfo },
];

export default function Sidebar() {
  const loc = useLocation();

  return (
    <aside className="flex w-[248px] shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex-1 overflow-y-auto px-3 pb-4 pt-5">
        <p className="px-3 py-2 text-[11px] font-bold tracking-[0.14em] text-muted">
          DISCOVER
        </p>
        <nav className="space-y-1">
          {main.map((it) => {
            const active = loc.pathname === it.to;
            const Icon = it.icon;
            return (
              <NavLink
                key={it.to}
                to={it.to}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? "bg-primary text-white shadow-[0_6px_16px_rgba(229,0,0,0.35)]"
                    : "text-soft hover:bg-card hover:text-white"
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-muted group-hover:text-white"}`}
                />
                {it.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-5 border-t border-line pt-5">
          <p className="px-3 py-2 text-[11px] font-bold tracking-[0.14em] text-muted">
            TOOLS
          </p>
          <nav className="space-y-1">
            {secondary.map((it) => {
              const Icon = it.icon;
              const active = loc.pathname === it.to;
              return (
                <NavLink
                  key={it.to}
                  to={it.to}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-card text-white"
                      : "text-soft hover:bg-card hover:text-white"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {it.label}
                </NavLink>
              );
            })}
            <a
              href="https://github.com/ndizeyedavid/mellow-movies"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-soft hover:bg-card hover:text-white"
            >
              <FaGithub className="h-3.5 w-3.5" /> GitHub
            </a>
          </nav>
        </div>
      </div>

      <div className="border-t border-line bg-card/40 px-3 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white">
            Mellow Desktop
          </span>
          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
            v1.0.0
          </span>
        </div>
        <p className="mt-1 text-xs text-muted">
          feat/desktop-electron • Electron 32 LTS
        </p>
      </div>
    </aside>
  );
}
