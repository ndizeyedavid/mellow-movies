import { NavLink, useLocation } from "react-router-dom";
import {
  FaHouse,
  FaFilm,
  FaTv,
  FaCompass,
  FaMagnifyingGlass,
  FaBookmark,
  FaCircleInfo,
  FaGithub,
} from "react-icons/fa6";

const main = [
  { to: "/", label: "Home", icon: FaHouse },
  { to: "/movies", label: "Movies", icon: FaFilm },
  { to: "/shows", label: "TV Shows", icon: FaTv },
  { to: "/search", label: "Search", icon: FaMagnifyingGlass },
  { to: "/my-list", label: "My List", icon: FaBookmark },
];

const secondary = [{ to: "/support", label: "Support", icon: FaCircleInfo }];

export default function Sidebar() {
  const loc = useLocation();

  return (
    <aside className="flex w-[98px] shrink-0 flex-col border-r border-line bg-surface">
      {/* DISCOVER — vertical stacked icons, bg touches edges */}
      <div className="flex-1 overflow-y-auto">
        <p className="px-0 py-3 text-center text-[10px] font-bold tracking-[0.18em] text-muted">
          DISCOVER
        </p>
        <nav className="flex flex-col">
          {main.map((it) => {
            const active = loc.pathname === it.to;
            const Icon = it.icon;
            return (
              <NavLink
                key={it.to}
                to={it.to}
                className={`group flex w-full flex-col items-center justify-center gap-1.5 border-b border-line/40 px-2 py-5 text-center transition-colors last:border-b-0 ${
                  active
                    ? "bg-primary text-white"
                    : "bg-transparent text-soft hover:bg-card hover:text-white"
                }`}
              >
                <Icon
                  className={`h-7 w-7 shrink-0 ${active ? "text-white" : "text-muted group-hover:text-white"}`}
                />
                <span className="text-[11px] font-bold leading-none tracking-wide">
                  {it.label}
                </span>
              </NavLink>
            );
          })}
        </nav>

        <p className="mt-0 border-t border-line px-0 py-3 text-center text-[10px] font-bold tracking-[0.18em] text-muted">
          TOOLS
        </p>
        <nav className="flex flex-col">
          {secondary.map((it) => {
            const Icon = it.icon;
            const active = loc.pathname === it.to;
            return (
              <NavLink
                key={it.to}
                to={it.to}
                className={`flex w-full flex-col items-center justify-center gap-1.5 border-b border-line/40 px-2 py-4 text-center transition-colors last:border-b-0 ${
                  active
                    ? "bg-card text-white"
                    : "text-soft hover:bg-card hover:text-white"
                }`}
              >
                <Icon className="h-6 w-6" />
                <span className="text-[11px] font-semibold leading-none tracking-wide">
                  {it.label}
                </span>
              </NavLink>
            );
          })}
          <a
            href="https://github.com/ndizeyedavid/mellow-movies"
            target="_blank"
            rel="noreferrer"
            className="flex w-full flex-col items-center justify-center gap-1.5 px-2 py-4 text-center text-soft transition-colors hover:bg-card hover:text-white"
          >
            <FaGithub className="h-6 w-6" />
            <span className="text-[11px] font-semibold leading-none tracking-wide">
              GitHub
            </span>
          </a>
        </nav>
      </div>
    </aside>
  );
}
