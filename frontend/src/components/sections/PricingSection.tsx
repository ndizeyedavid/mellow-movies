import { useState } from 'react'
import { plans } from '../../data/mockData'
import SectionHeading from '../ui/SectionHeading'
import PricingCard from '../ui/PricingCard'

/**
 * Subscription section from Figma (#185:1251): heading with a
 * Monthly/Yearly tab switcher (10px padding, #0F0F0F fill, radius 10)
 * and three plan cards in a row (30px gap).
 */
export default function PricingSection() {
  const [yearly, setYearly] = useState(false)

  const tabs: Array<'Monthly' | 'Yearly'> = ['Monthly', 'Yearly']

  return (
    <section className="mx-auto w-full max-w-[1920px] px-5 sm:px-8 lg:px-[60px] xl:px-[121px] 2xl:px-[162px]">
      <div className="flex flex-col gap-20">
        <SectionHeading
          title="Choose the plan that's right for you"
          subtitle="Join Mellow Movies and stream thousands of blockbuster movies and popular TV shows. Pick your plan — switch or cancel anytime."
          actions={
            <div
              role="tablist"
              aria-label="Billing period"
              className="inline-flex items-center rounded-[10px] border border-line bg-surface p-2.5"
            >
              {tabs.map((tab) => {
                const active = (tab === 'Yearly') === yearly
                return (
                  <button
                    key={tab}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setYearly(tab === 'Yearly')}
                    className={`rounded-lg px-6 py-3.5 text-lg transition-colors duration-200 ${
                      active
                        ? 'bg-card font-medium text-white'
                        : 'font-normal text-soft hover:text-white'
                    }`}
                  >
                    {tab}
                  </button>
                )
              })}
            </div>
          }
        />

        <div className="grid items-stretch gap-[30px] lg:grid-cols-3">
          {plans.map((plan) => (
            <PricingCard key={plan.name} plan={plan} yearly={yearly} />
          ))}
        </div>
      </div>
    </section>
  )
}
