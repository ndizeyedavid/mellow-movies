import Modal from './Modal'
import Button from './Button'
import type { MediaItem } from '../../data/mockData'
import playIcon from '../../assets/icon-play.svg'

interface MediaModalProps {
  item: MediaItem | null
  onClose: () => void
}

/**
 * Quick view dialog for a movie/show card. Shows poster, title,
 * metadata row and description with a Play Now action.
 */
export default function MediaModal({ item, onClose }: MediaModalProps) {
  if (!item) return null

  return (
    <Modal open onClose={onClose} labelledBy="quick-view-title">
      <div className="relative -m-6 -mt-8 mb-6 h-44 overflow-hidden rounded-t-xl sm:-m-8 sm:mb-6">
        <img src={item.poster} alt="" className="h-full w-full object-cover object-top" />
        <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" aria-hidden="true" />
      </div>

      <h2 id="quick-view-title" className="text-2xl font-bold text-white">
        {item.title}
      </h2>
      <p className="mt-1 text-lg font-medium text-soft">
        {item.genre}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-base text-muted">
        <span className="rounded-md border border-line bg-surface px-2.5 py-1 text-sm font-semibold text-white">
          ★ {item.rating}
        </span>
        <span>{item.year}</span>
        <span>{item.duration}</span>
        {item.quality && <span>{item.quality}</span>}
      </div>
      <p className="mt-5 text-base leading-relaxed text-muted lg:text-lg">{item.description}</p>
      <div className="mt-8 flex flex-wrap gap-4">
        <Button
          icon={<img src={playIcon} alt="" className="h-7 w-7" />}
          onClick={onClose}
        >
          Play Now
        </Button>
        <Button variant="outline" onClick={onClose}>
          Add to List
        </Button>
      </div>
    </Modal>
  )
}
