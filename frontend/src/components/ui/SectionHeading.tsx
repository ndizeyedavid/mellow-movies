import type { ReactNode } from "react";

interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  align?: "left" | "center";
  className?: string;
}

/**
 * Section title block from Figma: 38px Bold heading (24px on mobile)
 * + 18px muted subtitle, with optional actions aligned right (flex-end, gap 100).
 */
export default function SectionHeading({
  title,
  subtitle,
  actions,
  align = "left",
  className = "",
}: SectionHeadingProps) {
  return (
    <div
      className={`flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between xl:gap-[60px] 2xl:gap-[100px] ${className}`}
    >
      <div
        className={`flex flex-col gap-3.5 ${
          align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-[640px]'
        }`}
      >
        <h2 className="text-2xl font-bold leading-snug text-white md:text-3xl xl:text-[32px] 2xl:text-[38px]">
          {title}
        </h2>
        {subtitle && (
          <p className="text-base leading-snug text-muted lg:text-lg">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
