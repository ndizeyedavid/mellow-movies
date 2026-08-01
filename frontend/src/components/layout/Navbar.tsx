import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { FaBars, FaXmark } from "react-icons/fa6";
import { NAV_LINKS } from "../../data/mockData";
import logoMark from "../../assets/logo-mark.svg";
import searchIcon from "../../assets/icon-nav-1.svg";
import bellIcon from "../../assets/icon-nav-2.svg";

interface NavbarProps {
  onSearch: () => void;
}

/**
 * Navbar (Figma #180:312, compact): 72px tall mobile → 88px wide desktop.
 * Logo left, centered pill nav with active state, search + bell icons right.
 * Mobile/tablet: hamburger toggles a slide-down drawer.
 */
export default function Navbar({ onSearch }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

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
      } else if (delta < -6) {
        setHidden(false);
      }
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [menuOpen]);

  return (
    <header
      className={`sticky top-0 z-40 border-b border-line/60 bg-background/80 backdrop-blur-xl transition-transform duration-300 ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="section-gutter mx-auto flex h-[72px] w-full max-w-[1920px] items-center justify-between lg:h-[80px] 2xl:h-[88px]">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-3"
          aria-label="Mellow Movies home"
        >
          <img src={logoMark} alt="" className="h-10 w-10 lg:h-11 lg:w-11" />
          <span className="whitespace-nowrap text-lg font-bold tracking-tight text-white lg:text-xl">
            Mellow Movies
          </span>
        </Link>

        {/* Centered pill nav — desktop only */}
        <nav
          aria-label="Primary"
          className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-xl border-[3px] border-card2 bg-surface py-2 pl-2 pr-3 lg:flex lg:gap-3 2xl:gap-6"
        >
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) =>
                `rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 lg:text-base ${
                  isActive
                    ? "bg-card text-white"
                    : "font-normal text-soft hover:text-white"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Right icons — desktop only */}
        <div className="hidden items-center gap-6 lg:flex 2xl:gap-8">
          <button
            aria-label="Search"
            onClick={onSearch}
            className="text-white transition-transform duration-200 hover:scale-110 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <img src={searchIcon} alt="" className="h-7 w-7" />
          </button>
          <button
            aria-label="Notifications"
            onClick={onSearch}
            className="relative text-white transition-transform duration-200 hover:scale-110 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <img src={bellIcon} alt="" className="h-7 w-7" />
            <span
              className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-primary"
              aria-hidden="true"
            />
          </button>
        </div>

        {/* Mobile hamburger */}
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

      {/* Mobile drawer */}
      <div
        className={`grid overflow-hidden transition-all duration-300 lg:hidden ${
          menuOpen ? "grid-rows-[1fr] border-t border-line" : "grid-rows-[0fr]"
        }`}
      >
        <nav aria-label="Mobile" className="overflow-hidden">
          <div className="flex flex-col gap-1 px-5 py-5">
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
            <div className="mt-4 flex items-center gap-4 border-t border-line pt-4">
              <button
                aria-label="Search"
                onClick={() => {
                  setMenuOpen(false);
                  onSearch();
                }}
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-card"
              >
                <img src={searchIcon} alt="" className="h-5 w-5" />
              </button>
              <button
                aria-label="Notifications"
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-card"
              >
                <img src={bellIcon} alt="" className="h-5 w-5" />
              </button>
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}
