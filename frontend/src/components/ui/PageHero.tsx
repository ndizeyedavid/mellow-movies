import type { ReactNode } from "react";
import Container from "../ui/Container";

interface PageHeroProps {
  kicker?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}

/**
 * Slim page banner used on inner pages: red-tinted gradient panel
 * (matching Figma fill_5a107196) with kicker, 38px title and description.
 */
export default function PageHero({
  kicker,
  title,
  description,
  actions,
}: PageHeroProps) {
  return (
    <section className="pt-8 2xl:pt-16">
      <Container>
        <div className="relative overflow-hidden rounded-xl border border-line bg-gradient-to-br from-primary/25 via-surface to-surface px-6 py-10 sm:px-10 lg:py-12 2xl:px-[50px] 2xl:py-[60px]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between xl:gap-[60px] 2xl:gap-[100px]">
            <div className="flex max-w-3xl flex-col gap-3.5">
              {kicker && (
                <span className="text-lg font-medium text-primary">
                  {kicker}
                </span>
              )}
              <h1 className="text-3xl font-bold leading-snug text-white md:text-4xl xl:text-[32px] 2xl:text-[34px]">
                {title}
              </h1>
              <p className="text-base leading-snug text-muted lg:text-lg">
                {description}
              </p>
            </div>
            {actions && <div className="shrink-0">{actions}</div>}
          </div>
        </div>
      </Container>
    </section>
  );
}
