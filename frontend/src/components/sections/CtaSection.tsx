import { Link } from "react-router-dom";
import Button from "../ui/Button";
import ctaBg1 from "../../assets/cta-bg-1.png";
import ctaBg2 from "../../assets/cta-bg-2.png";
import ctaBg3 from "../../assets/cta-bg-3.png";
import ctaBg4 from "../../assets/cta-bg-4.png";

const banners = [ctaBg1, ctaBg2, ctaBg3, ctaBg4];

/**
 * Call-to-action banner from Figma (#240:2): #0F0F0F panel, radius 12,
 * mosaic of poster-strip backgrounds faded out by a left gradient,
 * headline 48px Bold + red "Start a Free Trial" button.
 */
export default function CtaSection() {
  return (
    <section className="section-gutter mx-auto w-full max-w-[1920px]">
      <div className="relative overflow-hidden rounded-xl border border-line bg-surface">
        {/* Background poster strips */}
        <div
          className="pointer-events-none absolute inset-0 flex flex-col gap-5"
          aria-hidden="true"
        >
          {banners.map((src) => (
            <img
              key={src}
              src={src}
              alt=""
              className="h-[22%] w-full object-cover opacity-60"
            />
          ))}
        </div>
        {/* Fade out left */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-surface via-[#141414]/95 to-transparent"
        />

        <div className="relative flex flex-col items-start gap-10 px-6 py-12 sm:px-10 md:flex-row md:items-center md:justify-between lg:py-14 xl:gap-[60px] 2xl:gap-[100px] 2xl:px-[80px] 2xl:py-[100px]">
          <div className="flex max-w-xl flex-col gap-3.5">
            <h2 className="text-3xl font-bold leading-snug text-white md:text-4xl xl:text-[40px] 2xl:text-[48px]">
              Start your free trial today!
            </h2>
            <p className="text-base leading-snug text-muted lg:text-lg">
              This is a clear and concise call to action that encourages users
              to sign up for a free trial of Mellow Movies.
            </p>
          </div>
          <Link to="/pricing">
            <Button size="lg">Start a Free Trial</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
