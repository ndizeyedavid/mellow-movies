import PageHero from '../components/ui/PageHero'
import PricingSection from '../components/sections/PricingSection'
import FaqSection from '../components/sections/FaqSection'
import CtaSection from '../components/sections/CtaSection'

/**
 * Subscription page (Figma "Subscription Page - Desktop" #109:844):
 * plans with billing toggle, FAQ and a closing CTA.
 */
export default function SubscriptionPage() {
  return (
    <>
      <PageHero
        kicker="Plans & Pricing"
        title="Subscriptions"
        description="Pick the plan that fits your viewing habits. Every plan includes unlimited access to thousands of movies and shows, with the freedom to switch or cancel at any time."
      />
      <div className="flex flex-col gap-20 py-20 lg:py-24">
        <PricingSection />
        <FaqSection />
        <CtaSection />
      </div>
    </>
  )
}
