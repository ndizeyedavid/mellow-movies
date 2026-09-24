import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  FaFacebook,
  FaInstagram,
  FaXTwitter,
  FaYoutube,
  FaBolt,
  FaCircleCheck,
  FaClock,
  FaEnvelope,
  FaHeadset,
  FaMagnifyingGlass,
  FaPaperPlane,
  FaShieldHalved,
  FaSignal,
  FaTriangleExclamation,
  FaFilm,
  FaBug,
  FaLightbulb,
  FaArrowRight,
  FaCopy,
  FaHeart,
  FaGithub,
} from "react-icons/fa6";
import { faqs } from "../data/mockData";
import { usePageTitle } from "../hooks/usePageTitle";
import { API_BASE_URL } from "../api/client";

/* ---------------- small helpers ---------------- */

const categories = ["All", "Playback", "Account", "Content", "Legal"] as const;
type Cat = (typeof categories)[number];

function cx(...c: (string | false | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ---------------- page ---------------- */

export default function SupportPage() {
  usePageTitle("Support");

  // contact form state (alive: validation + char count + live preview)
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("Playback");
  const [message, setMessage] = useState("");
  const [hp, setHp] = useState(""); // honeypot
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // faq search
  const [faqQ, setFaqQ] = useState("");
  const [faqCat, setFaqCat] = useState<Cat>("All");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // live system status — hits real backend
  const [health, setHealth] = useState<{
    ok?: boolean;
    pool_size?: number;
    probe?: { ok?: boolean; status?: number };
  } | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE_URL}/health/proxy`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        setHealth(j);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setHealthLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const filteredFaqs = useMemo(() => {
    const q = faqQ.trim().toLowerCase();
    return faqs.filter((f) => {
      const catOk =
        faqCat === "All" ||
        (faqCat === "Playback" &&
          /buffer|play|quality|stream/i.test(f.question + f.answer)) ||
        (faqCat === "Account" &&
          /account|login|list/i.test(f.question + f.answer)) ||
        (faqCat === "Content" &&
          /catalog|disappear|download/i.test(f.question + f.answer)) ||
        (faqCat === "Legal" &&
          /legal|copyright|removal/i.test(f.question + f.answer));
      const qOk =
        !q ||
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [faqQ, faqCat]);

  const canSubmit = message.trim().length >= 10 && !sending;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (hp) return; // bot
    if (!canSubmit) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `[Support:${category}] ${name}`,
          detail_path: "support-page",
          subject_id: "support",
          url: window.location.href,
          error: `Support:${category}`,
          message: `From: ${name} <${email}>\nCategory: ${category}\n\n${message}`,
          user_agent: navigator.userAgent,
        }),
      });
      if (!res.ok)
        throw new Error((await res.text()) || `Failed ${res.status}`);
      const data = await res.json().catch(() => ({}));
      const id = data.github_issue
        ? String(data.github_issue).split("/").pop() || "created"
        : `MM-${Date.now().toString(36).toUpperCase()}`;
      setSent({ id: String(id) });
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const quickActions = [
    {
      icon: FaTriangleExclamation,
      title: "Movie doesn't play",
      desc: "Video stuck, 91% buffer, or mid-play stop.",
      cta: "Report issue",
      color: "from-primary/20 to-primary/5 border-primary/20",
      onClick: () => {
        setCategory("Playback");
        document
          .getElementById("contact-form")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      },
    },
    {
      icon: FaFilm,
      title: "Report missing content",
      desc: "Title disappeared from catalog or won't load?",
      cta: "Report",
      color: "from-violet-500/15 to-violet-500/5 border-violet-500/20",
      onClick: () => {
        setCategory("Content");
        document
          .getElementById("contact-form")
          ?.scrollIntoView({ behavior: "smooth" });
      },
    },
    {
      icon: FaBug,
      title: "Found a bug",
      desc: "UI glitch, wrong poster, broken page.",
      cta: "Report bug",
      color: "from-emerald-500/15 to-emerald-500/5 border-emerald-500/20",
      onClick: () => {
        setCategory("Playback");
        document
          .getElementById("contact-form")
          ?.scrollIntoView({ behavior: "smooth" });
      },
    },
    {
      icon: FaLightbulb,
      title: "Suggest a feature",
      desc: "Have an idea to make Mellow better?",
      cta: "Suggest",
      color: "from-amber-500/15 to-amber-500/5 border-amber-500/20",
      onClick: () => {
        setCategory("Playback");
        document
          .getElementById("contact-form")
          ?.scrollIntoView({ behavior: "smooth" });
      },
    },
  ] as const;

  return (
    <div className="overflow-hidden">
      {/* ---------- HERO — alive with orbs + live pulse ---------- */}
      <section className="relative overflow-hidden border-b border-line">
        {/* subtle grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)`,
            backgroundSize: `40px 40px`,
          }}
        />

        <div className="section-gutter relative mx-auto flex w-full max-w-[1920px] flex-col gap-8 py-10 lg:flex-row lg:items-end lg:justify-between lg:py-14 2xl:py-16">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold tracking-widest text-primary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              HELP CENTER // I USUALLY REPLY IN ~2H
            </div>

            <h1 className="mt-4 text-4xl font-extrabold leading-none tracking-tight text-white md:text-4xl">
              Having an issue?
              <br />
              <span className="text-primary-dark">
                Worry not, I've got your back.
              </span>
            </h1>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-muted lg:text-lg">
              Pick a quick action, search the FAQ, or drop me a line. Your
              message creates a GitHub issue and pings me directly on my phone.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- QUICK ACTIONS ---------- */}
      <section className="section-gutter mx-auto w-full max-w-[1920px] py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((a) => (
            <button
              key={a.title}
              onClick={a.onClick}
              className={cx(
                "group relative overflow-hidden rounded-2xl border bg-card p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20",
                a.color,
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent opacity-0 transition group-hover:opacity-100" />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white text-black shadow">
                <a.icon className="h-5 w-5" />
              </div>
              <h3 className="relative mt-4 text-sm font-bold text-white">
                {a.title}
              </h3>
              <p className="relative mt-1 text-xs leading-relaxed text-muted">
                {a.desc}
              </p>
              <span className="relative mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary">
                {a.cta}{" "}
                <FaArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ---------- FAQ — searchable, alive ---------- */}
      <section
        id="faq"
        className="section-gutter mx-auto w-full max-w-[1920px] py-8"
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-extrabold text-white md:text-3xl">
                Frequently asked
              </h2>
              <p className="mt-1 text-sm text-muted">
                I believe these could be among the questions you might be
                wondering.
              </p>
            </div>
            <div className="flex w-full max-w-md items-center gap-2 rounded-full border border-line bg-card px-3 py-2 focus-within:border-primary/40">
              <FaMagnifyingGlass className="h-4 w-4 text-muted" />
              <input
                value={faqQ}
                onChange={(e) => setFaqQ(e.target.value)}
                placeholder="Search FAQs… (e.g. buffering, download, 429)"
                className="w-full bg-transparent text-sm text-white placeholder:text-muted focus:outline-none"
              />
              {faqQ && (
                <button
                  onClick={() => setFaqQ("")}
                  className="rounded-full bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setFaqCat(c)}
                className={cx(
                  "rounded-full border px-3 py-1.5 text-xs font-bold tracking-wide transition",
                  faqCat === c
                    ? "border-primary bg-primary text-white"
                    : "border-line bg-card text-soft hover:border-line2 hover:text-white",
                )}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {filteredFaqs.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-line bg-card/40 px-6 py-10 text-center">
                <p className="text-sm font-semibold text-white">
                  No results for “{faqQ}”
                </p>
                <p className="mt-1 text-xs text-muted">
                  Try “buffer”, “429”, “download”, or ask below.
                </p>
              </div>
            ) : (
              filteredFaqs.map((faq, i) => {
                const isOpen = openFaq === i;
                return (
                  <div
                    key={faq.question}
                    className={cx(
                      "group rounded-2xl border bg-card p-4 transition-all duration-300",
                      isOpen
                        ? "border-primary/30 bg-card shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
                        : "border-line hover:border-line2",
                    )}
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      className="flex w-full items-start justify-between gap-4 text-left"
                      aria-expanded={isOpen}
                    >
                      <span
                        className={cx(
                          "text-sm font-semibold leading-snug",
                          isOpen
                            ? "text-white"
                            : "text-white/90 group-hover:text-white",
                        )}
                      >
                        {faq.question}
                      </span>
                      <span
                        className={cx(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs transition",
                          isOpen
                            ? "border-primary bg-primary text-white"
                            : "border-line bg-background text-muted group-hover:border-line2",
                        )}
                      >
                        {isOpen ? "−" : "+"}
                      </span>
                    </button>
                    <div
                      className={cx(
                        "grid transition-all duration-300",
                        isOpen
                          ? "mt-3 grid-rows-[1fr] opacity-100"
                          : "grid-rows-[0fr] opacity-0",
                      )}
                    >
                      <div className="overflow-hidden">
                        <p className="pr-8 text-sm leading-relaxed text-muted">
                          {faq.answer}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* ---------- CONTACT — alive form + info ---------- */}
      <section
        id="contact-form"
        className="section-gutter mx-auto w-full max-w-[1920px] pb-14 2xl:pb-20"
      >
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {/* left: form */}
          <form
            onSubmit={onSubmit}
            className="relative overflow-hidden rounded-[10px] border border-line bg-card p-6 sm:p-8"
          >
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-extrabold text-white">
                  Send me a message
                </h3>
                <p className="mt-1 text-sm text-muted">
                  I gurantee you that I read all messages. They get posted also
                  on our github issue page
                </p>
              </div>
            </div>

            {/* honeypot — invisible */}
            <input
              value={hp}
              onChange={(e) => setHp(e.target.value)}
              className="hidden"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden
            />

            <div className="mt-6 ">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-bold tracking-widest text-muted">
                  NAME (Optional)
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ada Lovelace"
                  className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-white placeholder:text-muted focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10"
                />
              </label>
            </div>

            <label className="mt-4 flex flex-col gap-2">
              <span className="text-xs font-bold tracking-widest text-muted">
                CATEGORY
              </span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-white focus:border-primary/40 focus:outline-none"
              >
                <option>Playback</option>
                <option>Content</option>
                <option>Account</option>
                <option>Legal</option>
                <option>Other</option>
              </select>
            </label>

            <label className="mt-4 flex flex-col gap-2">
              <span className="flex items-center justify-between text-xs font-bold tracking-widest text-muted">
                MESSAGE{" "}
                <span
                  className={cx(
                    "font-normal",
                    message.length > 1800 ? "text-amber-400" : "text-muted",
                  )}
                >
                  {message.length}/2000
                </span>
              </span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="You may write your message here and express yourself to the fullest😉"
                rows={5}
                maxLength={2000}
                required
                className="resize-none rounded-xl border border-line bg-surface px-4 py-3 text-sm leading-relaxed text-white placeholder:text-muted focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10"
              />
            </label>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-white shadow-[0_10px_30px_rgba(229,0,0,0.35)] transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />{" "}
                    Sending…
                  </>
                ) : (
                  <>
                    <FaPaperPlane className="h-3.5 w-3.5" /> Send message
                  </>
                )}
              </button>
              {error && (
                <span className="text-xs font-semibold text-red-400">
                  {error}
                </span>
              )}
              {sent && (
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-400">
                  <FaCircleCheck className="h-3.5 w-3.5" /> Sent — ID {sent.id}
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(sent.id);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1400);
                      } catch {}
                    }}
                    className="ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-1 text-[11px] font-bold text-white"
                  >
                    <FaCopy className="h-3 w-3" /> {copied ? "Copied!" : "Copy"}
                  </button>
                </span>
              )}
            </div>

            <p className="mt-4 text-xs leading-relaxed text-muted">
              By sending, you agree I may open a public GitHub issue with your
              (anonymized) message to track the fix.
            </p>
          </form>

          {/* right: info stack */}
          <div className="flex flex-col gap-4">
            <div className="rounded-[10px] border border-line bg-card p-6">
              <h4 className="text-sm font-bold text-white">Prefer DMs?</h4>
              <p className="mt-1 text-sm text-muted">
                I am not on Discord/Telegram, use this form or email me
                directly. I will try to respond in ~2 hours, 9am - 11pm CAT.
              </p>
              <div className="mt-4 flex gap-2">
                {[
                  {
                    label: "Instagram",
                    icon: FaInstagram,
                    url: "https://www.instagram.com/mellow_junior1",
                  },
                  {
                    label: "Github",
                    icon: FaGithub,
                    url: "https://www.github.com/ndizeyedavid",
                  },
                ].map((s) => (
                  <a
                    key={s.label}
                    href={s.url}
                    aria-label={s.label}
                    title={`${s.label}`}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-white transition hover:border-primary/30 hover:text-primary"
                  >
                    <s.icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>

            <div className="rounded-[10px] border border-emerald-500/20 bg-emerald-500/10 p-5">
              <p className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                <FaHeart className="h-4 w-4" /> Note from moi
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Mellow movies is among the projects I have spent months working
                on. I have invested most of my time and research to make it the
                way it. But honestly speaking, all this is not because of me. I
                thank soo much{" "}
                <a
                  href="https://github.com/walterwhite-69"
                  className="text-primary-dark"
                >
                  @walterwhite-69
                </a>{" "}
                for creating the first intial backend logic, and I also thank
                heartfully everyone who gave me feedbacks and supported me in
                development of this proj. Enjoy mellow movies, let me know what
                you'd like to see change or improved here, and Thank you for
                using one of my products🙏
              </p>
            </div>
          </div>
        </div>
      </section>

      <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}`}</style>
    </div>
  );
}
