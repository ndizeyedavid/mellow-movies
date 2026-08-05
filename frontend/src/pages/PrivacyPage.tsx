import LegalPage from "../components/ui/LegalPage";
import { usePageTitle } from "../hooks/usePageTitle";

/**
 * Privacy Policy. Full legal document with the honest bits left in —
 * including the IP-forwarding trick, disclosed in plain English.
 */
export default function PrivacyPage() {
  usePageTitle("Privacy Policy");

  return (
    <LegalPage
      kicker="What We Know About You"
      title="Privacy Policy"
      description="How we collect, use, and absolutely do not sell your data. If you made it this far, you're already more privacy-conscious than 99% of the internet."
      effectiveDate="August 5, 2026"
      sections={[
        {
          heading: "1. Information We Collect",
          body: (
            <>
              <p>
                1.1 Information you give us: your email address, your password
                (encrypted — we're not animals), and anything you type into
                forms or send to our support team.
              </p>
              <p>
                1.2 Information we collect automatically: your watch history
                (so we can recommend things), device type, browser,
                approximate location, and your IP address. About that IP
                address — see Section 3. It's a doozy.
              </p>
              <p>
                1.3 Information from cookies and similar technologies. Cookies
                here are the digital kind, not the delicious kind. We're as
                disappointed as you are.
              </p>
            </>
          ),
        },
        {
          heading: "2. How We Use Your Information",
          body: (
            <p>
              We use your information to: provide and improve the Service;
              personalise recommendations; respond to support requests; keep
              the Service secure; and send you the occasional update. We do
              not sell your information, because (a) we believe in privacy,
              and (b) nobody has offered us enough money yet.
            </p>
          ),
        },
        {
          heading: "3. The IP Address Thing",
          body: (
            <p>
              Here is the honest part, because you're clearly the curious
              type. When you request streaming data, our servers take your IP
              address and attach it to the request we send upstream. Why?
              Because some streaming sources think they can tell where a
              server lives and block it accordingly. We outsmarted them. Your
              IP is used strictly to route the request on your behalf — it is
              not stored beyond what is needed to deliver your movie, and it
              is not used to build a dossier on you. We could have buried this
              in legalese. We chose honesty and a little bragging instead.
            </p>
          ),
        },
        {
          heading: "4. Cookies",
          body: (
            <p>
              We use cookies to keep you logged in, remember your preferences,
              and generally make the Service feel less like a stranger's
              house. You can disable cookies in your browser, but some parts
              of the Service may stop working properly, and we will be mildly
              sad about it.
            </p>
          ),
        },
        {
          heading: "5. Third Parties",
          body: (
            <p>
              We use third-party services to host the Service, deliver
              Content, and handle payments (should you ever donate). Those
              providers process data only to the extent needed to provide
              their services and are bound by their own privacy policies. We
              try to keep the number of people who touch your data small. It
              is a small, trusted club.
            </p>
          ),
        },
        {
          heading: "6. Data Retention",
          body: (
            <p>
              We keep your data for as long as your account is active, or as
              long as reasonably needed to provide the Service and comply with
              legal obligations. If you delete your account, we delete your
              data in a timely manner, and we mean it — the delete button
              works. We're not one of those companies.
            </p>
          ),
        },
        {
          heading: "7. Your Rights and Choices",
          body: (
            <p>
              You have the right to: access the personal data we hold about
              you; correct inaccurate data; request deletion; and object to
              certain processing. Want something gone? Use our Request Removal
              page, or email privacy@mellowmovies.com. We respond to privacy
              requests faster than we respond to most other mail, because we
              respect you, and also because the lawyers told us to.
            </p>
          ),
        },
        {
          heading: "8. Children",
          body: (
            <p>
              The Service is not directed at children under 13, and we do not
              knowingly collect personal information from them. If you believe
              a child under 13 has provided us with personal information,
              contact us, and we will delete it and have a stern word with the
              responsible adult.
            </p>
          ),
        },
        {
          heading: "9. Security",
          body: (
            <p>
              We use industry-standard safeguards to protect your data,
              including encryption in transit and at rest where appropriate.
              No system is perfectly secure — anyone who promises you that is
              selling something — but we take reasonable measures and update
              them as threats evolve.
            </p>
          ),
        },
        {
          heading: "10. Changes to This Policy",
          body: (
            <p>
              We may update this Privacy Policy from time to time. Changes
              take effect when posted, and the "Last updated" date above tells
              you how fresh this document is. Your continued use of the
              Service after changes means you accept the updated policy.
            </p>
          ),
        },
        {
          heading: "11. Contact",
          body: (
            <p>
              Questions about privacy? Email privacy@mellowmovies.com. Or
              read the policy again. Or both. We're not picky.
            </p>
          ),
        },
      ]}
    />
  );
}
