import Hero from "../components/home/Hero";
import TrendingSection from "../components/home/TrendingSection";
import DevicesSection from "../components/sections/DevicesSection";
import FaqSection from "../components/sections/FaqSection";
import PricingSection from "../components/sections/PricingSection";
import CtaSection from "../components/sections/CtaSection";

/**
 * Home page (Figma "Home Page - Desktop" #34:919, height 5518px).
 * Sections in order: Hero → Trending Now → Devices → FAQ → Pricing → CTA.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <div className="section-stack pt-10 md:pt-14 2xl:pt-16">
        <TrendingSection />
        <DevicesSection />
        <FaqSection />
        <PricingSection />
        <CtaSection />
      </div>
    </>
  );
}
