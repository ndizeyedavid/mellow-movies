import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { FaXmark } from 'react-icons/fa6'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  labelledBy?: string
}

/**
 * Accessible modal dialog matching the dark Figma surface styles.
 * Closes on overlay click / Escape; traps focus on the close button.
 */
export default function Modal({ open, onClose, children, labelledBy }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-lg rounded-xl border border-line bg-card p-6 shadow-2xl sm:p-8">
        <button
          aria-label="Close"
          onClick={onClose}
          autoFocus
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-white transition-colors duration-200 hover:border-line2 hover:text-primary"
        >
          <FaXmark className="h-4 w-4" aria-hidden="true" />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  )
}
