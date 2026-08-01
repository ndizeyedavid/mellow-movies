import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { FaBars, FaXmark, FaAngleDown } from "react-icons/fa6";
import { NAV_LINKS, MORE_LINKS } from "../../data/mockData";
import { useMyList } from "../../store/myList";
import SearchBar from "./SearchBar";
import logoMark from "../../assets/logo-mark.svg";

/**
 * Navbar (Figma #180:312, compact): 72px tall mobile → 88px wide desktop.
 * Logo left, centered pill nav (Home / Movie / TV Show / Animation /
 * More dropdown), inline search bar for desktop, hamburger on mobile.
 * Hides on scroll down, reveals on scroll up.
 */
export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const moreRef = useRef<HTMLDivElement>(null);
  const savedCount = useMyList().length;

  // Hide on scroll down, reveal on scroll up (keeps the bar out of the way
  // while browsing; never hides at the top of the page or with the menu open).
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      if (y < 80) {
        setHidden(false);
      } else if (delta > 6 && !menuOpen) {
        setHidden(true);
        setMoreOpen(false);
      } else if (delta < -6) {
        setHidden(false);
      }
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [menuOpen]);

  // Close the More dropdown when clicking outside it.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3.5 py-2 text-sm font-medium transition-colors duration-200 lg:text-base 2xl:px-4 ${
      isActive ? "bg-card text-white" : "font-normal text-soft hover:text-white"
    }`;

  return (
    <header
      className={`sticky top-0 z-40 border-b border-line/60 bg-background/80 backdrop-blur-xl transition-transform duration-300 ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="section-gutter mx-auto flex h-[72px] w-full max-w-[1920px] items-center justify-between gap-4 lg:h-[80px] 2xl:h-[88px]">
        {/* Logo */}
        <Link
          to="/"
          className="flex shrink-0 items-center gap-3"
          aria-label="Mellow Movies home"
        >
          <img src={"/logo.png"} alt="" className="w-[130px]" />
          {/* <span className="whitespace-nowrap text-lg font-bold tracking-tight text-white lg:text-xl">
            Mellow Movies
          </span> */}
        </Link>

        {/* Centered pill nav — desktop only */}
        <nav
          aria-label="Primary"
          className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-xl border-[3px] border-card2 bg-surface py-2 pl-2 pr-3 lg:flex lg:gap-2.5"
        >
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={navLinkClass}
            >
              {link.label}
            </NavLink>
          ))}

          {/* More dropdown */}
          <div ref={moreRef} className="relative">
            <button
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-normal transition-colors duration-200 lg:text-base 2xl:px-4 ${
                moreOpen ? "bg-card text-white" : "text-soft hover:text-white"
              }`}
            >
              More
              <FaAngleDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  moreOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            <div
              className={`absolute left-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-line bg-card shadow-2xl transition-all duration-200 ${
                moreOpen
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none translate-y-1 opacity-0"
              }`}
            >
              {MORE_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === "/"}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    `block px-4 py-2.5 text-sm transition-colors duration-150 ${
                      isActive
                        ? "bg-card2 font-medium text-white"
                        : "text-soft hover:bg-card2 hover:text-white"
                    }`
                  }
                >
                  {link.label}
                  {link.to === "/my-list" && savedCount > 0 && (
                    <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-white">
                      {savedCount}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        </nav>

        {/* Right side: search bar (desktop) + hamburger (mobile) */}
        <div className="flex shrink-0 items-center justify-end gap-4">
          <SearchBar className="hidden w-[170px] lg:block xl:w-[240px] 2xl:w-[280px]" />
          <button
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-card text-white lg:hidden"
          >
            {menuOpen ? (
              <FaXmark className="h-5 w-5" />
            ) : (
              <FaBars className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <div
        className={`grid overflow-hidden transition-all duration-300 lg:hidden ${
          menuOpen ? "grid-rows-[1fr] border-t border-line" : "grid-rows-[0fr]"
        }`}
      >
        <nav aria-label="Mobile" className="overflow-hidden">
          <div className="flex flex-col gap-1 px-5 py-5">
            <SearchBar className="mb-3" onNavigate={() => setMenuOpen(false)} />
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-5 py-3 text-base transition-colors duration-200 ${
                    isActive
                      ? "bg-card font-medium text-white"
                      : "font-normal text-soft hover:bg-card hover:text-white"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            <div className="mt-3 flex flex-col gap-1 border-t border-line pt-4">
              <p className="px-5 pb-1 text-xs font-semibold uppercase tracking-wider text-muted">
                More
              </p>
              {MORE_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === "/"}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-5 py-3 text-base transition-colors duration-200 ${
                      isActive
                        ? "bg-card font-medium text-white"
                        : "font-normal text-soft hover:bg-card hover:text-white"
                    }`
                  }
                >
                  {link.label}
                  {link.to === "/my-list" && savedCount > 0 && (
                    <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-white">
                      {savedCount}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}
