import { Link } from "react-router-dom";
import {
  FaFacebook,
  FaInstagram,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";
import { footerColumns } from "../../data/mockData";
import logoMark from "../../assets/logo-mark.svg";

const socials = [
  { label: "Instagram", icon: <FaInstagram className="h-5 w-5" /> },
];

/**
 * Footer from Figma #109:1748: 100px/162px/50px padding, #0F0F0F fill.
 * Five link columns + brand/social column, divider line and bottom bar.
 */
export default function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="section-gutter mx-auto flex max-w-[1920px] flex-col gap-10 py-14 md:gap-16 xl:gap-[70px] 2xl:gap-[72px] 2xl:py-[80px]">
        {/* Link columns */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 lg:grid-cols-6">
          {footerColumns.map((col) => (
            <div key={col.title} className="flex flex-col gap-6">
              <h3 className="text-lg font-semibold text-white lg:text-xl">
                {col.title}
              </h3>
              <ul className="flex flex-col gap-4">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.to ? (
                      <Link
                        to={link.to}
                        className="text-base text-muted transition-colors duration-200 hover:text-white lg:text-lg"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href="#"
                        className="text-base text-muted transition-colors duration-200 hover:text-white lg:text-lg"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Connect column */}
          <div className="flex flex-col gap-6">
            <h3 className="text-lg font-semibold text-white lg:text-xl">
              Connect With Moi
            </h3>
            <div className="flex gap-3">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  className="flex h-12 w-12 items-center justify-center rounded-lg border border-line bg-card text-white transition-all duration-200 hover:border-line2 hover:text-primary"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-6 border-t border-line pt-6 md:flex-row">
          <p className="text-center text-base text-muted lg:text-lg">
            © {new Date().getFullYear()} Mellow Movies, Inc. All rights
            reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link
              to="/terms"
              className="text-base text-muted transition-colors duration-200 hover:text-white lg:text-lg"
            >
              Terms of Use
            </Link>
            <Link
              to="/privacy"
              className="text-base text-muted transition-colors duration-200 hover:text-white lg:text-lg"
            >
              Privacy Policy
            </Link>
            <Link
              to="/removal"
              className="text-base text-muted transition-colors duration-200 hover:text-white lg:text-lg"
            >
              Request Removal🥺
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base text-muted lg:text-lg">Stream on</span>
            <img src={logoMark} alt="Mellow Movies" className="h-8 w-8" />
          </div>
        </div>
      </div>
    </footer>
  );
}
