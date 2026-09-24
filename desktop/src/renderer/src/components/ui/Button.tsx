import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'outline' | 'ghost'
  size?: 'md' | 'lg'
  icon?: ReactNode
}

/**
 * Base button component matching the Figma button styles.
 * Primary: red #E50000 fill, radius 8. Outline: dark fill with 1px border.
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  const variants = {
    primary:
      'bg-primary text-white hover:bg-primary-dark focus-visible:ring-primary/40',
    outline:
      'bg-background text-white border border-line hover:border-line2 hover:bg-card focus-visible:ring-line2/40',
    ghost: 'bg-transparent text-soft hover:text-white hover:bg-card',
  }

  const sizes = {
    md: 'px-6 py-3.5 text-lg',
    lg: 'px-6 py-[18px] text-lg',
  }

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1 rounded-lg font-semibold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {icon && <span className="flex items-center" aria-hidden="true">{icon}</span>}
      {children}
    </button>
  )
}
