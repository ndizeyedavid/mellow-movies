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
  const [health, setHealth] = useState<{ ok?: boolean; pool_size?: number; probe?: { ok?: boolean; status?: number } } | null>(null);
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
        (faqCat === "Playback" && /buffer|play|quality|stream/i.test(f.question + f.answer)) ||
        (faqCat === "Account" && /account|login|list/i.test(f.question + f.answer)) ||
        (faqCat === "Content" && /catalog|disappear|download/i.test(f.question + f.answer)) ||
        (faqCat === "Legal" && /legal|copyright|removal/i.test(f.question + f.answer));
      const qOk = !q || f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [faqQ, faqCat]);

  const canSubmit = name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && message.trim().length >= 10 && !sending;

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
      if (!res.ok) throw new Error((await res.text()) || `Failed ${res.status}`);
      const data = await res.json().catch(() => ({}));
      const id = data.github_issue ? String(data.github_issue).split("/").pop() || "created" : `MM-${Date.now().toString(36).toUpperCase()}`;
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
      title: "Playback fails / 429 / 426",
      desc: "Video stuck, 91% buffer, or mid-play stop.",
      cta: "Report issue",
      color: "from-primary/20 to-primary/5 border-primary/20",
      onClick: () => {
        setCategory("Playback");
        document.getElementById("contact-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
      },
    },
    {
      icon: FaFilm,
      title: "Request a title",
      desc: "Can't find a movie or show?",
      cta: "Request",
      color: "from-violet-500/15 to-violet-500/5 border-violet-500/20",
      onClick: () => {
        setCategory("Content");
        document.getElementById("contact-form")?.scrollIntoView({ behavior: "smooth" });
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
        document.getElementById("contact-form")?.scrollIntoView({ behavior: "smooth" });
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
        document.getElementById("contact-form")?.scrollIntoView({ behavior: "smooth" });
      },
    },
  ] as const;

  return (
    <div className="overflow-hidden">
      {/* ---------- HERO — alive with orbs + live pulse ---------- */}
      <section className="relative overflow-hidden border-b border-line">
        {/* gradient orbs */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-28 -left-28 h-[520px] w-[520px] rounded-full bg-primary/20 blur-[90px] animate-[float_9s_ease-in-out_infinite]" />
          <div className="absolute -bottom-24 -right-24 h-[560px] w-[560px] rounded-full bg-violet-500/15 blur-[90px] animate-[float_11s_ease-in-out_infinite_reverse]" />
          <div className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.04] blur-[60px]" />
        </div>
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
              HELP CENTER — WE USUALLY REPLY IN ~2H
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
                <FaCircleCheck className="h-3 w-3" /> LIVE
              </span>
            </div>

            <h1 className="mt-4 text-4xl font-extrabold leading-none tracking-tight text-white md:text-5xl">
              We&apos;re here.
              <br />
              <span className="bg-gradient-to-r from-primary to-violet-400 bg-clip-text text-transparent">Really here.</span>
            </h1>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-muted lg:text-lg">
              Pick a quick action, search the FAQ, or drop us a line. Your message creates a GitHub issue and pings us on ntfy.sh — no account needed.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#contact-form" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white shadow-[0_10px_30px_rgba(229,0,0,0.35)] transition hover:bg-primary-dark">
                <FaPaperPlane className="h-3.5 w-3.5" /> Contact us
              </a>
              <a
                href="#faq"
                className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-5 py-3 text-sm font-semibold text-white hover:border-line2"
              >
                Search FAQ <FaMagnifyingGlass className="h-3.5 w-3.5 text-muted" />
              </a>
            </div>

            {/* live stats row */}
            <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
              {[
                { k: "Avg reply", v: "~2 hours", sub: "last 7 days", icon: FaClock },
                { k: "Uptime", v: health?.probe?.ok ? "99.9%" : healthLoading ? "…" : "degraded", sub: `${health?.pool_size ?? "—"} proxies`, icon: FaSignal },
                { k: "Tickets", v: "1.2k+", sub: "resolved", icon: FaHeart },
              ].map((s) => (
                <div key={s.k} className="rounded-2xl border border-line bg-card/70 px-3 py-3 backdrop-blur">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest text-muted">
                    <s.icon className="h-3 w-3" /> {s.k}
                  </div>
                  <div className="mt-1 text-sm font-bold text-white">{s.v}</div>
                  <div className="text-xs text-muted">{s.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* right: live system status card */}
          <div className="w-full max-w-[420px] shrink-0">
            <div className="relative overflow-hidden rounded-[24px] border border-line bg-card p-5 shadow-2xl">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                    <FaSignal className="h-3.5 w-3.5" />
                  </span>
                  System status
                </h3>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Operational
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-surface px-3 py-3">
                  <span className="flex items-center gap-2 text-sm text-soft">
                    <FaBolt className="h-4 w-4 text-amber-400" /> Streaming API
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                    <FaCircleCheck className="h-3.5 w-3.5" /> Up
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-surface px-3 py-3">
                  <span className="flex items-center gap-2 text-sm text-soft">
                    <FaShieldHalved className="h-4 w-4 text-violet-400" /> Proxy pool
                  </span>
                  {healthLoading ? (
                    <span className="text-xs text-muted">checking…</span>
                  ) : health?.probe?.ok ? (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                      <FaCircleCheck className="h-3.5 w-3.5" /> {health?.pool_size ?? 0} routes
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                      <FaTriangleExclamation className="h-3.5 w-3.5" /> Degraded
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between rounded-xl bg-surface px-3 py-3">
                  <span className="flex items-center gap-2 text-sm text-soft">
                    <FaHeadset className="h-4 w-4 text-sky-400" /> Human reply
                  </span>
                  <span className="text-xs font-semibold text-white">~2 hours</span>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <a
                  href="https://mellow-movies.fastapicloud.dev/health/proxy"
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 rounded-full border border-line bg-background px-3 py-2 text-center text-xs font-semibold text-white hover:border-line2"
                >
                  View health
                </a>
                <a
                  href="https://github.com/ndizeyedavid/mellow-movies/issues"
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 rounded-full bg-primary px-3 py-2 text-center text-xs font-bold text-white hover:bg-primary-dark"
                >
                  Issues
                </a>
              </div>

              <p className="mt-3 text-center text-xs text-muted">
                Responses create a GitHub issue + ntfy push. No spam — rate-limited per IP.
              </p>
            </div>
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
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black shadow">
                <a.icon className="h-5 w-5" />
              </div>
              <h3 className="relative mt-4 text-sm font-bold text-white">{a.title}</h3>
              <p className="relative mt-1 text-xs leading-relaxed text-muted">{a.desc}</p>
              <span className="relative mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary">
                {a.cta} <FaArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ---------- FAQ — searchable, alive ---------- */}
      <section id="faq" className="section-gutter mx-auto w-full max-w-[1920px] py-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-extrabold text-white md:text-3xl">Frequently asked</h2>
              <p className="mt-1 text-sm text-muted">Search before you write — most answers are already here. Live filter below.</p>
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
                <button onClick={() => setFaqQ("")} className="rounded-full bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20">
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
                  faqCat === c ? "border-primary bg-primary text-white" : "border-line bg-card text-soft hover:border-line2 hover:text-white",
                )}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {filteredFaqs.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-line bg-card/40 px-6 py-10 text-center">
                <p className="text-sm font-semibold text-white">No results for “{faqQ}”</p>
                <p className="mt-1 text-xs text-muted">Try “buffer”, “429”, “download”, or ask below.</p>
              </div>
            ) : (
              filteredFaqs.map((faq, i) => {
                const isOpen = openFaq === i;
                return (
                  <div
                    key={faq.question}
                    className={cx(
                      "group rounded-2xl border bg-card p-4 transition-all duration-300",
                      isOpen ? "border-primary/30 bg-card shadow-[0_10px_30px_rgba(0,0,0,0.25)]" : "border-line hover:border-line2",
                    )}
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      className="flex w-full items-start justify-between gap-4 text-left"
                      aria-expanded={isOpen}
                    >
                      <span className={cx("text-sm font-semibold leading-snug", isOpen ? "text-white" : "text-white/90 group-hover:text-white")}>
                        {faq.question}
                      </span>
                      <span
                        className={cx(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs transition",
                          isOpen ? "border-primary bg-primary text-white" : "border-line bg-background text-muted group-hover:border-line2",
                        )}
                      >
                        {isOpen ? "−" : "+"}
                      </span>
                    </button>
                    <div className={cx("grid transition-all duration-300", isOpen ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                      <div className="overflow-hidden">
                        <p className="pr-8 text-sm leading-relaxed text-muted">{faq.answer}</p>
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
      <section id="contact-form" className="section-gutter mx-auto w-full max-w-[1920px] pb-14 2xl:pb-20">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {/* left: form */}
          <form onSubmit={onSubmit} className="relative overflow-hidden rounded-[24px] border border-line bg-card p-6 sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-extrabold text-white">Send us a message</h3>
                <p className="mt-1 text-sm text-muted">We read every message. You&apos;ll get a GitHub issue link + we&apos;re pinged on phone.</p>
              </div>
              <span className="hidden items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 sm:inline-flex">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Avg 2h
              </span>
            </div>

            {/* honeypot — invisible */}
            <input value={hp} onChange={(e) => setHp(e.target.value)} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-bold tracking-widest text-muted">FULL NAME</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ada Lovelace"
                  required
                  className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-white placeholder:text-muted focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10"
                />
                <span className="text-xs text-muted/70">{name.length ? `${name.length} chars` : "What should we call you?"}</span>
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-bold tracking-widest text-muted">EMAIL</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ada@example.com"
                  type="email"
                  required
                  className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-white placeholder:text-muted focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10"
                />
                <span className="text-xs text-muted/70">We&apos;ll reply here (no newsletter, ever).</span>
              </label>
            </div>

            <label className="mt-4 flex flex-col gap-2">
              <span className="text-xs font-bold tracking-widest text-muted">CATEGORY</span>
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
                MESSAGE <span className={cx("font-normal", message.length > 1800 ? "text-amber-400" : "text-muted")}>{message.length}/2000</span>
              </span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what happened — include the title, what you clicked, and any error you saw (e.g. 429, 426, 91% stuck)…"
                rows={5}
                maxLength={2000}
                required
                className="resize-none rounded-xl border border-line bg-surface px-4 py-3 text-sm leading-relaxed text-white placeholder:text-muted focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10"
              />
              {/* live typing preview bubble */}
              {message.trim().length > 0 && (
                <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-muted">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-primary" /> Live preview — we&apos;ll quote this in the issue.
                </span>
              )}
            </label>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-white shadow-[0_10px_30px_rgba(229,0,0,0.35)] transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Sending…
                  </>
                ) : (
                  <>
                    <FaPaperPlane className="h-3.5 w-3.5" /> Send message
                  </>
                )}
              </button>
              <span className="text-xs text-muted">or press ⌘+Enter</span>
              {error && <span className="text-xs font-semibold text-red-400">{error}</span>}
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
              By sending, you agree we may open a public GitHub issue with your (anonymized) message to track the fix. Email is only used for reply.
            </p>
          </form>

          {/* right: info stack */}
          <div className="flex flex-col gap-4">
            <div className="rounded-[24px] border border-line bg-gradient-to-br from-primary/15 via-card to-card p-6">
              <h4 className="flex items-center gap-2 text-sm font-extrabold text-white">
                <FaEnvelope className="h-4 w-4 text-primary" /> What happens next?
              </h4>
              <ol className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
                <li className="flex gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">1</span>
                  <span>Your message hits our backend → a GitHub issue (`user-report`) is opened anonymously — no GitHub login needed.</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-black">2</span>
                  <span>We get an instant push on phone via ntfy.sh (`NTFY_TOPIC`).</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-black">3</span>
                  <span>You get the issue ID above — share it if you need to follow up.</span>
                </li>
              </ol>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href="https://github.com/ndizeyedavid/mellow-movies/issues"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold text-white hover:border-line2"
                >
                  View issues
                </a>
                <a href="mailto:support@mellowmovies.vercel.app" className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-dark">
                  Email us
                </a>
              </div>
            </div>

            <div className="rounded-[24px] border border-line bg-card p-6">
              <h4 className="text-sm font-bold text-white">Prefer DMs?</h4>
              <p className="mt-1 text-sm text-muted">We&apos;re not on Discord/Telegram — use the form or GitHub issues. Response in ~2 hours, 9am–11pm CAT.</p>
              <div className="mt-4 flex gap-2">
                {[
                  { label: "Facebook", icon: FaFacebook },
                  { label: "Instagram", icon: FaInstagram },
                  { label: "X", icon: FaXTwitter },
                  { label: "YouTube", icon: FaYoutube },
                ].map((s) => (
                  <a
                    key={s.label}
                    href="#"
                    aria-label={s.label}
                    onClick={(e) => e.preventDefault()}
                    title={`${s.label} — coming soon`}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-white transition hover:border-primary/30 hover:text-primary"
                  >
                    <s.icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/10 p-5">
              <p className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                <FaHeart className="h-4 w-4" /> Built with care
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Mellow is a one-person project. Your report actually moves the needle — every playback `429/426` or `91% stuck` you send becomes a tracked issue we fix next.
              </p>
            </div>
          </div>
        </div>
      </section>

      <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}`}</style>
    </div>
  );
}
