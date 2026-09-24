import type { ReactNode } from "react";
import PageHero from "./PageHero";
import Container from "./Container";

export interface LegalSection {
  heading?: string;
  body: ReactNode;
}

interface LegalPageProps {
  kicker: string;
  title: string;
  description: string;
  effectiveDate: string;
  actions?: ReactNode;
  sections: LegalSection[];
}

/**
 * Shared layout for legal documents (Terms of Use, Privacy Policy,
 * Request Removal). Renders the PageHero banner, an effective-date
 * stamp, and a column of prose sections. Body content is passed in
 * as JSX so each page can freely mix paragraphs, lists and asides.
 */
export default function LegalPage({
  kicker,
  title,
  description,
  effectiveDate,
  actions,
  sections,
}: LegalPageProps) {
  return (
    <>
      <PageHero
        kicker={kicker}
        title={title}
        description={description}
        actions={actions}
      />
      <section className="section-stack py-14 2xl:py-24">
        <Container>
          <div className="mx-auto w-full max-w-4xl">
            <p className="text-base text-muted lg:text-lg">
              Last updated: {effectiveDate}
            </p>
            <div className="mt-10 flex flex-col gap-10 border-t border-line pt-10 lg:mt-12 lg:gap-12 lg:pt-12">
              {sections.map((section, index) => (
                <section
                  key={section.heading ?? index}
                  className="flex flex-col gap-4 lg:gap-5"
                >
                  {section.heading && (
                    <h2 className="text-xl font-semibold text-white lg:text-2xl">
                      {section.heading}
                    </h2>
                  )}
                  <div className="flex flex-col gap-4 text-base leading-snug text-muted lg:text-lg">
                    {section.body}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
