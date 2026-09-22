import LegalPage from "../components/ui/LegalPage";
import { usePageTitle } from "../hooks/usePageTitle";

const REMOVAL_EMAIL =
  "mailto:dmca@mellowmovies.com?subject=Removal%20Request";

/**
 * Request Removal (DMCA-style takedown page). Full legal document with
 * a submission checklist and a mailto CTA in the hero.
 */
export default function RemovalPage() {
  usePageTitle("Request Removal");

  return (
    <LegalPage
      kicker="We Respect the Law (Sort Of)"
      title="Request Removal"
      description="Own a title we're streaming and want it taken down? This is the page for you. No lawyers required — but bring the details."
      effectiveDate="August 5, 2026"
      actions={
        <a
          href={REMOVAL_EMAIL}
          className="inline-flex items-center justify-center gap-1 rounded-lg bg-primary px-6 py-[18px] text-lg font-semibold text-white transition-all duration-200 hover:bg-primary-dark focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          Submit a Removal Request
        </a>
      }
      sections={[
        {
          heading: "1. What This Page Is For",
          body: (
            <p>
              We stream movies and shows from various sources. Occasionally,
              that includes content we don't own — a fact we handle with the
              grace and poise of a toddler caught with the cookie jar. If you
              are the copyright owner (or an authorised agent) of a work
              appearing on Mellow Movies, you can ask us to remove it. We will
              take you seriously. We will even be nice about it.
            </p>
          ),
        },
        {
          heading: "2. What We Need From You",
          body: (
            <>
              <p>
                To process a removal request, please provide all of the
                following. Missing information means delays, and delays mean
                the content stays up longer, which is presumably the opposite
                of what you want.
              </p>
              <ul className="flex list-disc flex-col gap-2 pl-6">
                <li>Your full legal name and physical address.</li>
                <li>A contact email and phone number.</li>
                <li>
                  A description of the copyrighted work you claim is
                  infringed.
                </li>
                <li>
                  The exact URL(s) on Mellow Movies where the work appears.
                </li>
                <li>
                  A statement, made under penalty of perjury, that you are the
                  copyright owner or are authorised to act on the owner's
                  behalf.
                </li>
                <li>A statement that the information in your notice is accurate.</li>
                <li>
                  Your signature. Typed is fine; we're not monsters.
                </li>
              </ul>
            </>
          ),
        },
        {
          heading: "3. How to Submit",
          body: (
            <p>
              Email everything to dmca@mellowmovies.com with "Removal Request"
              in the subject line. Please do not send us fourteen attachments
              named "final_FINAL_v2_real_this_time.pdf". One clear email is
              enough.
            </p>
          ),
        },
        {
          heading: "4. What Happens Next",
          body: (
            <p>
              We review your request, typically within a few business days. If
              it checks out, we remove the content promptly. If it doesn't
              check out — say, you're claiming to own content that is
              demonstrably not yours — we may ask for more information, or
              politely decline, with a helpful note explaining why.
            </p>
          ),
        },
        {
          heading: "5. Counter-Notices",
          body: (
            <p>
              If you believe content was removed by mistake or
              misidentification, you may submit a counter-notice with: your
              name and contact information; a description of the removed
              content and where it appeared; a statement under penalty of
              perjury that you have a good-faith belief the removal was a
              mistake; and consent to the jurisdiction of your local courts.
              We review counter-notices fairly and restore content where
              appropriate. Fairness is the whole point, after all.
            </p>
          ),
        },
        {
          heading: "6. Repeat Infringers",
          body: (
            <p>
              We take removal requests seriously. Sources responsible for
              repeated infringement may be cut off, because even we have
              standards, and also because getting sued is not on the vision
              board.
            </p>
          ),
        },
        {
          heading: "7. Good-Faith Warning",
          body: (
            <p>
              Submitting a removal request that knowingly misrepresents
              ownership is against the law in many jurisdictions and, frankly,
              a bad look. Please be honest. The internet has enough drama
              without you adding perjury to the mix.
            </p>
          ),
        },
        {
          heading: "8. Contact",
          body: (
            <p>
              Removal requests: dmca@mellowmovies.com. General questions about
              this page: legal@mellowmovies.com. Questions about whether we
              are scared yet: no comment.
            </p>
          ),
        },
      ]}
    />
  );
}
