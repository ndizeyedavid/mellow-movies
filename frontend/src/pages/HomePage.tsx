import { useState } from 'react'
import Hero from '../components/home/Hero'
import TrendingSection from '../components/home/TrendingSection'
import DevicesSection from '../components/sections/DevicesSection'
import FaqSection from '../components/sections/FaqSection'
import PricingSection from '../components/sections/PricingSection'
import CtaSection from '../components/sections/CtaSection'
import MediaModal from '../components/ui/MediaModal'
import type { MediaItem } from '../data/mockData'

/**
 * Home page (Figma "Home Page - Desktop" #34:919, height 5518px).
 * Sections in order: Hero → Trending Now → Devices → FAQ → Pricing → CTA.
 */
export default function HomePage() {
  const [selected, setSelected] = useState<MediaItem | null>(null)

  return (
    <>
      <Hero />
      <div className="flex flex-col gap-20 pt-20 lg:gap-20 lg:pt-[120px]">
        <TrendingSection onSelect={setSelected} />
        <DevicesSection />
        <FaqSection />
        <PricingSection />
        <CtaSection />
      </div>
      <MediaModal item={selected} onClose={() => setSelected(null)} />
    </>
  )
}
