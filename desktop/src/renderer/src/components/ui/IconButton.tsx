import type { ReactNode } from 'react'

interface IconButtonProps {
  label: string
  onClick?: () => void
  disabled?: boolean
  children: ReactNode
  className?: string
}

/**
 * Small square icon button from Figma (28px icons, 14px padding,
 * #1A1A1A fill, #1F1F1F border, radius 8).
 */
export default function IconButton({
  label,
  onClick,
  disabled,
  children,
  className = '',
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-14 w-14 items-center justify-center rounded-lg border border-card2 bg-card text-white transition-all duration-200 hover:border-line2 hover:bg-card2 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-card2 disabled:hover:bg-card disabled:hover:text-white ${className}`}
    >
      {children}
    </button>
  )
}
