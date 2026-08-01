import { FaCheck } from 'react-icons/fa6'
import type { Plan } from '../../data/mockData'
import Button from './Button'

interface PricingCardProps {
  plan: Plan
  yearly: boolean
}

/**
 * Subscription plan card from Figma (EL-e326b187): #1A1A1A fill,
 * radius 12, padding 50px. 40px price + "/month", feature list with
 * check icons, and a full-width action row (Start Free Trial / Choose Plan).
 */
export default function PricingCard({ plan, yearly }: PricingCardProps) {
  return (
    <div
      className={`flex flex-col gap-[50px] rounded-xl border p-6 transition-colors duration-300 sm:p-10 lg:p-[50px] ${
        plan.highlighted
          ? 'border-primary bg-gradient-to-br from-primary/20 via-card to-card'
          : 'border-line bg-card hover:border-line2'
      }`}
    >
      <div className="flex flex-col gap-3.5">
        <h3 className="text-lg font-semibold text-white lg:text-xl">{plan.name}</h3>
        <div className="flex items-end gap-1">
          <span className="text-[32px] font-semibold leading-none text-white lg:text-[40px]">
            {yearly ? plan.yearly : plan.monthly}
          </span>
          <span className="pb-1 text-lg font-medium leading-[0.73em] text-muted">/month</span>
        </div>
      </div>

      <div className="h-px w-full bg-line" aria-hidden="true" />

      <ul className="flex flex-col gap-5">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-center gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card2 text-primary">
              <FaCheck className="h-3 w-3" aria-hidden="true" />
            </span>
            <span className="text-base text-soft lg:text-lg">{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-col gap-5 sm:flex-row">
        <Button variant="outline" className="flex-1">
          Start Free Trial
        </Button>
        <Button variant={plan.highlighted ? 'primary' : 'outline'} className="flex-1">
          Choose Plan
        </Button>
      </div>
    </div>
  )
}
