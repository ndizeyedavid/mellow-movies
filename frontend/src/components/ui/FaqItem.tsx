import { useState } from 'react'
import { FaPlus, FaMinus } from 'react-icons/fa6'
import type { Faq } from '../../data/mockData'

interface FaqItemProps {
  faq: Faq
  defaultOpen?: boolean
}

/**
 * FAQ accordion item from Figma: bordered row, question 20px SemiBold,
 * 30px add/remove icon button, collapsible answer 18px muted.
 */
export default function FaqItem({ faq, defaultOpen = false }: FaqItemProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-line">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`faq-panel-${faq.question.replace(/\s+/g, '-')}`}
        className="flex w-full items-center justify-between gap-6 py-6 text-left transition-colors duration-200 hover:text-soft lg:py-7"
      >
        <span className={`text-lg font-semibold lg:text-xl ${open ? 'text-white' : 'text-white'}`}>
          {faq.question}
        </span>
        <span
          className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border text-sm transition-all duration-200 ${
            open
              ? 'border-primary bg-primary text-white'
              : 'border-line bg-card2 text-white hover:border-line2 hover:text-primary'
          }`}
          aria-hidden="true"
        >
          {open ? <FaMinus /> : <FaPlus />}
        </span>
      </button>
      <div
        id={`faq-panel-${faq.question.replace(/\s+/g, '-')}`}
        role="region"
        className={`grid transition-all duration-300 ease-in-out ${
          open ? 'grid-rows-[1fr] pb-6 opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <p className="max-w-2xl text-base leading-relaxed text-muted lg:text-lg">
            {faq.answer}
          </p>
        </div>
      </div>
    </div>
  )
}
