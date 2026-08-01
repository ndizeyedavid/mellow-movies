import type { ReactNode } from "react";

interface ContainerProps {
  children: ReactNode;
  className?: string;
}

/**
 * Page content wrapper. Matches the Figma design gutters:
 * 162px at 1920+ desktop, scaled down responsively to 20px on mobile.
 */
export default function Container({
  children,
  className = "",
}: ContainerProps) {
  return (
    <div
      className={`section-gutter mx-auto w-full max-w-[1920px] ${className}`}
    >
      {children}
    </div>
  );
}
