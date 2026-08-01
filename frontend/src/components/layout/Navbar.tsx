import { useState } from "react";
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
 * Navbar from Figma #180:312: 30px/162px padding, 120px tall.
 * Desktop: logo left, centered pill nav (4px #1F1F1F stroke, radius 12)
 * with an active pill for the current page, search + bell icons right.
 * Mobile/tablet: hamburger toggles a slide-down drawer.
 */
export default function Navbar({ onSearch }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[88px] w-full max-w-[1920px] items-center justify-between px-5 sm:px-8 lg:h-[120px] lg:px-[60px] xl:px-[121px] 2xl:px-[162px]">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-4"
          aria-label="Mellow Movies home"
        >
          <img
            src={logoMark}
            alt=""
            className="h-[52px] w-[52px] lg:h-[60px] lg:w-[60px]"
          />
          <span className="whitespace-nowrap text-lg font-bold tracking-tight text-white lg:text-[22px]">
            Mellow Movies
          </span>
        </Link>

        {/* Centered pill nav — desktop only */}
        <nav
          aria-label="Primary"
          className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-[30px] rounded-xl border-4 border-card2 bg-surface py-2.5 pl-2.5 pr-10 lg:flex"
        >
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) =>
                `rounded-lg px-6 py-3.5 text-lg transition-colors duration-200 ${
                  isActive
                    ? "bg-card font-medium text-white"
                    : "font-normal text-soft hover:text-white"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Right icons — desktop only */}
        <div className="hidden items-center gap-[30px] lg:flex">
          <button
            aria-label="Search"
            onClick={onSearch}
            className="text-white transition-transform duration-200 hover:scale-110 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <img src={searchIcon} alt="" className="h-[34px] w-[34px]" />
          </button>
          <button
            aria-label="Notifications"
            onClick={onSearch}
            className="relative text-white transition-transform duration-200 hover:scale-110 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <img src={bellIcon} alt="" className="h-[34px] w-[34px]" />
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
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-card text-white lg:hidden"
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
          <div className="flex flex-col gap-1 px-5 py-6">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-5 py-4 text-lg transition-colors duration-200 ${
                    isActive
                      ? "bg-card font-medium text-white"
                      : "font-normal text-soft hover:bg-card hover:text-white"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            <div className="mt-4 flex items-center gap-4 border-t border-line pt-5">
              <button
                aria-label="Search"
                onClick={() => {
                  setMenuOpen(false);
                  onSearch();
                }}
                className="flex h-12 w-12 items-center justify-center rounded-lg border border-line bg-card"
              >
                <img src={searchIcon} alt="" className="h-6 w-6" />
              </button>
              <button
                aria-label="Notifications"
                className="flex h-12 w-12 items-center justify-center rounded-lg border border-line bg-card"
              >
                <img src={bellIcon} alt="" className="h-6 w-6" />
              </button>
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}
