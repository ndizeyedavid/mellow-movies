import type { ReactNode } from 'react'

interface ContainerProps {
  children: ReactNode
  className?: string
}

/**
 * Page content wrapper. Matches the Figma design gutters:
 * 162px on desktop (1920), scaled responsively down to 20px on mobile.
 */
export default function Container({ children, className = '' }: ContainerProps) {
  return (
    <div
      className={`mx-auto w-full max-w-[1920px] px-5 sm:px-8 md:px-12 lg:px-20 xl:px-[121px] 2xl:px-[162px] ${className}`}
    >
      {children}
    </div>
  )
}
