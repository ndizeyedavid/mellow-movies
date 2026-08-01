import Hero from "../components/home/Hero";
import ContinueWatchingRail from "../components/home/ContinueWatchingRail";
import MyListRail from "../components/home/MyListRail";
import TopTenRail from "../components/home/TopTenRail";
import TrendingSection from "../components/home/TrendingSection";
import DevicesSection from "../components/sections/DevicesSection";
import FaqSection from "../components/sections/FaqSection";
import PricingSection from "../components/sections/PricingSection";
import CtaSection from "../components/sections/CtaSection";
import { usePageTitle } from "../hooks/usePageTitle";

/**
 * Home page (Figma "Home Page - Desktop" #34:919, height 5518px).
 * Sections in order: Hero → Continue Watching → My List → Top 10 →
 * Trending Now → Devices → FAQ → Pricing → CTA.
 */
export default function HomePage() {
  usePageTitle();
  return (
    <>
      <Hero />
      <div className="section-stack pt-10 md:pt-14 2xl:pt-16">
        <ContinueWatchingRail />
        <MyListRail />
        <TopTenRail />
        <TrendingSection />
        <DevicesSection />
        <FaqSection />
        <PricingSection />
        <CtaSection />
      </div>
    </>
  );
}
