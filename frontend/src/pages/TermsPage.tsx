import LegalPage from "../components/ui/LegalPage";
import { usePageTitle } from "../hooks/usePageTitle";

/**
 * Terms of Use. Full legal document with a side of personality —
 * the fine print you probably won't read, but legally still agreed to.
 */
export default function TermsPage() {
  usePageTitle("Terms of Use");

  return (
    <LegalPage
      kicker="The Fine Print"
      title="Terms of Use"
      description="The contract you probably won't read. We get it — nobody reads these. But ours is honest, occasionally funny, and legally binding. Read it or not, you're agreeing to it either way."
      effectiveDate="August 5, 2026"
      sections={[
        {
          heading: "1. Acceptance of These Terms",
          body: (
            <>
              <p>
                By accessing or using Mellow Movies ("the Service," "we,"
                "us," "our"), you agree to be bound by these Terms of Use and
                our Privacy Policy, which is incorporated by reference. If you
                do not agree with any part of these Terms, please stop using
                the Service. We'll wait. Really — close the tab, go outside,
                touch some grass. This contract will still be here when you
                get back, unfortunately.
              </p>
            </>
          ),
        },
        {
          heading: "2. No Account, No Password, No Drama",
          body: (
            <>
              <p>
                2.1 The Service requires no signup, no login, and no password
                manager. You open the page, you press play, you watch. That's
                the entire registration process. We couldn't log you in even
                if you asked — there's no door, so there's no key.
              </p>
              <p>
                2.2 Your watchlist and preferences live in your browser, on
                your device, and nowhere else. Clear your browser data and
                they vanish like a plot twist you should have seen coming.
                This also means there is no account for anyone else to hijack,
                share, or judge you about. Your cousin is safe.
              </p>
              <p>
                2.3 You must be at least the age of digital consent in your
                jurisdiction to use the Service. Children watching with their
                parents' permission are welcome; children racking up parental
                guilt trips are not.
              </p>
            </>
          ),
        },
        {
          heading: "3. The Streaming",
          body: (
            <>
              <p>
                3.1 The Service lets you stream movies and shows
                ("Content"). We grant you a personal, non-exclusive,
                non-transferable, revocable license to stream Content for
                personal, non-commercial entertainment. That license does not
                include permission to record, re-upload, resell, or submit the
                Content as your own Oscar contender.
              </p>
              <p>
                3.2 We do our very best to keep Content available. Occasionally
                a title may vanish, buffer, or be geo-locked. Please do not
                write to us demanding an explanation for geo-locks — we have
                already sent a strongly worded letter to the people
                responsible. It did not help, but it made us feel better.
              </p>
            </>
          ),
        },
        {
          heading: "4. Acceptable Use",
          body: (
            <>
              <p>
                4.1 Don't: scrape, crawl, hack, reverse-engineer, or otherwise
                interfere with the Service. Don't resell access. Don't use
                automated tools to watch forty-seven movies at once — your
                eyeballs can't, and neither can our servers.
              </p>
              <p>
                4.2 Do: enjoy yourself, recommend us to friends, and maybe
                drop a donation if you feel like it. We won't tell anyone.
              </p>
            </>
          ),
        },
        {
          heading: "5. Donations",
          body: (
            <p>
              The Service is free. If you choose to donate, thank you — it
              keeps the lights on and the streams flowing. Donations are
              non-refundable. We will not be taking questions about what
              exactly your donation paid for, and the answer is always
              "infrastructure" and never "snacks."
            </p>
          ),
        },
        {
          heading: "6. Intellectual Property",
          body: (
            <p>
              The Service's branding, design, and code belong to us. The
              Content belongs to its respective owners, whom we respect deeply
              and, occasionally, borrow from with no permission at all. That
              last part is a joke. Kind of.
            </p>
          ),
        },
        {
          heading: "7. Disclaimers",
          body: (
            <>
              <p>
                7.1 The Service is provided "as is" and "as available," with
                all faults, and without warranties of any kind, express or
                implied. We do not guarantee that streaming will be
                uninterrupted, error-free, or free of that one movie your
                uncle insists on quoting at every family gathering.
              </p>
              <p>
                7.2 To the maximum extent permitted by law, we disclaim all
                implied warranties, including merchantability, fitness for a
                particular purpose, and non-infringement.
              </p>
            </>
          ),
        },
        {
          heading: "8. Limitation of Liability",
          body: (
            <p>
              To the maximum extent permitted by law, we shall not be liable
              for any indirect, incidental, special, consequential, or
              punitive damages, or any loss of profits, data, or enjoyment of
              your evening, arising from your use of (or inability to use) the
              Service. Our total liability shall not exceed the greater of
              fifty United States dollars or the total amount you paid us in
              the twelve months preceding the claim. Since the Service is
              free, feel free to do the math. It is a very small number.
            </p>
          ),
        },
        {
          heading: "9. Termination",
          body: (
            <p>
              We may suspend or terminate your access at any time, for any
              reason, including (but not limited to) conduct we believe
              violates these Terms or is otherwise a menace to society. You
              may also stop using the Service at any time. No hard feelings.
              Mostly.
            </p>
          ),
        },
        {
          heading: "10. Changes to These Terms",
          body: (
            <p>
              We may update these Terms from time to time. When we do, we will
              update the "Last updated" date above and do our best to make it
              obvious. Your continued use of the Service after changes takes
              effect means you accept the new Terms. By this point you have
              accepted roughly forty-one different documents. Congratulations.
            </p>
          ),
        },
        {
          heading: "11. Governing Law",
          body: (
            <p>
              These Terms are governed by the laws of the Republic of South
              Africa, without regard to its conflict-of-laws principles. Any
              disputes shall be resolved by the courts of Johannesburg. We
              will not fly to your country to litigate; you are welcome to fly
              to ours. The flights are lovely.
            </p>
          ),
        },
        {
          heading: "12. Contact",
          body: (
            <p>
              Questions about these Terms? Email legal@mellowmovies.com. We
              answer legal mail within a few business days, or slightly longer
              if it requires our lawyer, Steve, to read the whole thing first.
              Steve is unpaid and underappreciated, but he does his best.
            </p>
          ),
        },
      ]}
    />
  );
}
