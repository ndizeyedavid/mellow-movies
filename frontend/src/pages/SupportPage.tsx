import { useState, type FormEvent } from "react";
import {
  FaEnvelope,
  FaPhone,
  FaLocationDot,
  FaFacebook,
  FaInstagram,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";
import PageHero from "../components/ui/PageHero";
import FaqSection from "../components/sections/FaqSection";
import Button from "../components/ui/Button";

const contactCards = [
  {
    id: "email",
    title: "Email Us",
    lines: ["info@mellowmovies.com", "support@mellowmovies.com"],
    icon: <FaEnvelope className="h-7 w-7" />,
  },
  {
    id: "phone",
    title: "Call Us",
    lines: ["+1 (234) 567-890", "+1 (987) 654-321"],
    icon: <FaPhone className="h-7 w-7" />,
  },
  {
    id: "location",
    title: "Visit Us",
    lines: ["88 Alperton Street", "Johannesburg, South Africa"],
    icon: <FaLocationDot className="h-7 w-7" />,
  },
];

const socials = [
  { label: "Facebook", icon: <FaFacebook className="h-5 w-5" /> },
  { label: "Instagram", icon: <FaInstagram className="h-5 w-5" /> },
  { label: "X (Twitter)", icon: <FaXTwitter className="h-5 w-5" /> },
  { label: "YouTube", icon: <FaYoutube className="h-5 w-5" /> },
];

/**
 * Support page (Figma "Support Page - Desktop" #107:323):
 * contact info cards, FAQ section, and a contact form with socials.
 */
export default function SupportPage() {
  const [sent, setSent] = useState(false);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSent(true);
    e.currentTarget.reset();
  };

  return (
    <>
      <PageHero
        kicker="Help Center"
        title="Support"
        description="Our team is here around the clock. Browse the most common questions below, or get in touch directly — we usually reply within a few hours."
      />

      <section className="section-stack py-14 2xl:py-24">
        {/* Contact info cards */}
        <div className="section-gutter mx-auto grid w-full max-w-[1920px] gap-[30px] sm:grid-cols-3">
          {contactCards.map((card) => (
            <div
              key={card.id}
              className="flex flex-col gap-6 rounded-xl border border-line bg-card p-6 transition-colors duration-300 hover:border-line2 sm:p-[30px]"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-card2 bg-background text-white">
                {card.icon}
              </div>
              <h2 className="text-xl font-semibold text-white lg:text-2xl">
                {card.title}
              </h2>
              <ul className="flex flex-col gap-2">
                {card.lines.map((line) => (
                  <li key={line} className="text-base text-muted lg:text-lg">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <FaqSection />

        {/* Contact form + socials */}
        <div className="section-gutter mx-auto w-full max-w-[1920px]">
          <div className="grid gap-[30px] lg:grid-cols-3">
            <div className="flex flex-col gap-6 lg:col-span-1">
              <h2 className="text-2xl font-bold text-white md:text-3xl xl:text-[32px] 2xl:text-[38px]">
                Still have questions?
              </h2>
              <p className="text-base leading-snug text-muted lg:text-lg">
                Write to us and our team will get back to you within 24 hours.
              </p>
              <div className="flex gap-3">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href="#"
                    aria-label={s.label}
                    className="flex h-12 w-12 items-center justify-center rounded-lg border border-line bg-card text-white transition-all duration-200 hover:border-line2 hover:text-primary"
                  >
                    {s.icon}
                  </a>
                ))}
              </div>
            </div>

            <form
              onSubmit={onSubmit}
              className="flex flex-col gap-6 rounded-xl border border-line bg-card p-6 sm:p-10 lg:col-span-2"
            >
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <label
                    htmlFor="contact-name"
                    className="text-lg font-medium text-white"
                  >
                    Full Name
                  </label>
                  <input
                    id="contact-name"
                    required
                    placeholder="Jane Doe"
                    className="rounded-lg border border-line bg-surface px-5 py-4 text-lg text-white outline-none transition-colors duration-200 placeholder:text-muted focus:border-line2"
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <label
                    htmlFor="contact-email"
                    className="text-lg font-medium text-white"
                  >
                    Email Address
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    placeholder="jane@example.com"
                    className="rounded-lg border border-line bg-surface px-5 py-4 text-lg text-white outline-none transition-colors duration-200 placeholder:text-muted focus:border-line2"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <label
                  htmlFor="contact-message"
                  className="text-lg font-medium text-white"
                >
                  Message
                </label>
                <textarea
                  id="contact-message"
                  required
                  rows={5}
                  placeholder="How can we help?"
                  className="resize-none rounded-lg border border-line bg-surface px-5 py-4 text-lg text-white outline-none transition-colors duration-200 placeholder:text-muted focus:border-line2"
                />
              </div>
              <div className="flex items-center gap-5">
                <Button size="lg" type="submit">
                  Send Message
                </Button>
                {sent && (
                  <p role="status" className="text-lg font-medium text-primary">
                    Message sent — we&apos;ll be in touch!
                  </p>
                )}
              </div>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}
