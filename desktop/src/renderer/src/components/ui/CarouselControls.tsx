import IconButton from './IconButton'
import arrowLeft from '../../assets/icon-arrow-left.svg'
import arrowRight from '../../assets/icon-arrow-right.svg'

interface CarouselControlsProps {
  total: number
  active: number
  onPrev: () => void
  onNext: () => void
  label?: string
}

/**
 * Carousel navigation from Figma (#90:365): pill container
 * #0F0F0F fill, #1F1F1F border, radius 12, padding 16 — with prev/next
 * icon buttons and a 4-dot progress indicator (active dot red).
 */
export default function CarouselControls({
  total,
  active,
  onPrev,
  onNext,
  label = 'Carousel navigation',
}: CarouselControlsProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center gap-4 rounded-xl border border-card2 bg-surface p-4"
    >
      <IconButton label="Previous" onClick={onPrev}>
        <img src={arrowLeft} alt="" className="h-7 w-7" />
      </IconButton>
      <div className="flex items-center gap-[3px]" aria-hidden="true">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`h-1 rounded-[100px] transition-all duration-300 ${
              i === active % total ? 'w-6 bg-primary' : 'w-6 bg-line2'
            }`}
          />
        ))}
      </div>
      <IconButton label="Next" onClick={onNext}>
        <img src={arrowRight} alt="" className="h-7 w-7" />
      </IconButton>
    </div>
  )
}
