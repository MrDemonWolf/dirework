import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  Cloud,
  Code2,
  ExternalLink,
  Github,
  Minus,
  MessageSquare,
  Palette,
  Radio,
  Server,
  Shield,
  Terminal,
  Timer,
  Tv,
  Twitch,
  Users,
  X as XIcon,
} from "lucide-react";
import { ChatCommandWidget } from "./_widgets/ChatCommandWidget";
import { OverlayThemePreview } from "./_widgets/OverlayThemePreview";

const GITHUB = "https://github.com/mrdemonwolf/dirework";
const DISCORD = "https://mrdwolf.net/discord";

export const metadata: Metadata = {
  title: "Dirework — Focus together, stream better.",
  description:
    "Self-hosted Pomodoro timer and task list with Twitch chat integration. Built for co-working and body-doubling streams. Runs on Cloudflare Workers + D1.",
  alternates: { canonical: "/" },
};

// ── LED status chip — the signature Focus Console status element ──────────
function Chip({
  tone = "accent",
  children,
  pulse = false,
}: {
  tone?: "accent" | "live" | "warn";
  children: React.ReactNode;
  pulse?: boolean;
}) {
  return (
    <span className={`dw-chip dw-chip-${tone}`}>
      <span className={`dw-chip-dot ${pulse ? "animate-led-pulse" : ""}`} aria-hidden />
      {children}
    </span>
  );
}

// ── Numbered section kicker — one consistent spine down the page ──────────
function Kicker({ num, children }: { num: string; children: React.ReactNode }) {
  return (
    <span className="dw-kicker">
      <span className="dw-kicker-num">{num}</span>
      {children}
    </span>
  );
}

// ── Section heading helper ────────────────────────────────────────────────
function SectionHead({
  num,
  eyebrow,
  title,
  sub,
  align = "center",
}: {
  num: string;
  eyebrow: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  align?: "center" | "left";
}) {
  return (
    <div className={`max-w-3xl ${align === "center" ? "mx-auto text-center" : ""}`}>
      <div className={align === "center" ? "flex justify-center" : ""}>
        <Kicker num={num}>{eyebrow}</Kicker>
      </div>
      <h2 className="dw-display dw-text-1 text-4xl sm:text-5xl mt-5">{title}</h2>
      {sub ? (
        <p className="dw-text-2 text-lg sm:text-xl mt-5 leading-relaxed">{sub}</p>
      ) : null}
    </div>
  );
}

// ── The signature hardware-timer module (mirrors the app's home hero) ─────
function TimerModuleMock() {
  return (
    <div
      aria-hidden
      className="bg-grain panel-hero relative flex w-64 flex-col items-center gap-3 px-8 py-7"
    >
      <Chip tone="live" pulse>
        Focus
      </Chip>
      <p className="dw-display dw-text-1 text-6xl font-bold tabular-nums tracking-tight">
        18:32
      </p>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full" style={{ background: "var(--phase-work)" }} />
        <span
          className="size-2 rounded-full"
          style={{ background: "var(--phase-work)", boxShadow: "0 0 0 3px color-mix(in srgb, var(--phase-work) 25%, transparent)" }}
        />
        <span className="size-2 rounded-full border" style={{ borderColor: "var(--hairline)" }} />
        <span className="size-2 rounded-full border" style={{ borderColor: "var(--hairline)" }} />
      </div>
      <p className="dw-mono text-[10px] tracking-[0.18em] dw-text-2 uppercase">Pomo 2 of 4</p>
    </div>
  );
}

// ── Comparison cell ───────────────────────────────────────────────────────
type CellState = "yes" | "no" | "partial";
function CompareCell({ state }: { state: CellState }) {
  const Icon = state === "yes" ? Check : state === "partial" ? Minus : XIcon;
  // Three visually distinct verdicts: brand yes, amber partial, muted no —
  // color + icon shape together, so neither carries the meaning alone.
  const color =
    state === "yes"
      ? "var(--brand-600)"
      : state === "partial"
        ? "var(--chip-warn-fg)"
        : "var(--txt-2)";
  const bg =
    state === "yes"
      ? "var(--brand-50)"
      : state === "partial"
        ? "color-mix(in srgb, var(--phase-paused) 14%, transparent)"
        : "color-mix(in srgb, var(--bg-surface) 60%, transparent)";
  return (
    <div className="flex items-center justify-center">
      <span
        role="img"
        className="inline-flex items-center justify-center w-7 h-7 rounded-full"
        style={{ backgroundColor: bg, color }}
        aria-label={state === "yes" ? "Yes" : state === "no" ? "No" : "Partial"}
      >
        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      </span>
    </div>
  );
}

// ── FAQ row ───────────────────────────────────────────────────────────────
function FaqRow({ q, a }: { q: string; a: React.ReactNode }) {
  return (
    <details className="group panel" style={{ padding: "1.1rem 1.4rem" }}>
      <summary
        className="cursor-pointer list-none flex items-center justify-between gap-4"
        style={{ fontWeight: 600 }}
      >
        <span className="dw-text-1 text-base sm:text-lg">{q}</span>
        <span
          className="dw-text-2 text-2xl leading-none transition-transform group-open:rotate-45"
          aria-hidden="true"
        >
          +
        </span>
      </summary>
      <div className="mt-4 dw-text-2 text-base leading-relaxed">{a}</div>
    </details>
  );
}

export default function HomePage() {
  // Root is a <div>, not <main>: Fumadocs' HomeLayout already renders the
  // page's single <main> landmark, so nesting one here would be invalid ARIA.
  // The id stays for the layout's skip-to-content link (#nd-page).
  return (
    <div id="nd-page" className="dw-font dw-bg-base">
      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative overflow-hidden">
        <div className="dw-hero-glow" aria-hidden="true" />
        <div className="relative z-10 px-6 pt-12 pb-16 sm:pt-20 sm:pb-24">
          <div className="mx-auto max-w-6xl grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center">
            <div className="text-center lg:text-left">
              <h1 className="dw-reveal dw-reveal-1 dw-hero-headline dw-text-1">
                Focus together,{" "}
                <span className="dw-text-brand">stream better.</span>
              </h1>
              <p className="dw-reveal dw-reveal-2 dw-text-2 text-lg sm:text-xl mt-5 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                A co-working Pomodoro timer and shared task list for your Twitch stream.
                You run the timer, your chat runs the tasks, and OBS shows it all — on
                your own Cloudflare account, no SaaS in the middle.
              </p>
              <div className="dw-reveal dw-reveal-3 mt-7 flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3">
                <Link href="/docs/getting-started" className="dw-btn dw-btn-primary w-full justify-center sm:w-auto">
                  <Terminal className="w-4 h-4" />
                  Get Started
                </Link>
                <Link href="/docs" className="dw-btn dw-btn-secondary w-full justify-center sm:w-auto">
                  Read the docs
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <p className="mt-4 dw-mono text-xs dw-text-2 tracking-wide">
                One Dirework per streamer · Free plan-friendly · No lock-in
              </p>

              <div className="dw-reveal dw-reveal-3 mt-6 flex flex-wrap items-center justify-center lg:justify-start gap-2">
                <a
                  href={GITHUB}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open source on GitHub (opens in a new tab)"
                  className="dw-pill dw-pill-link"
                >
                  <Github className="w-3.5 h-3.5" /> Open source
                  <ExternalLink className="w-3 h-3 opacity-60" aria-hidden="true" />
                </a>
                <span className="dw-pill">
                  <Shield className="w-3.5 h-3.5" /> Your data, your Cloudflare
                </span>
                <a
                  href={DISCORD}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Discord community (opens in a new tab)"
                  className="dw-pill dw-pill-link"
                >
                  <Radio className="w-3.5 h-3.5" /> Discord community
                  <ExternalLink className="w-3 h-3 opacity-60" aria-hidden="true" />
                </a>
              </div>
            </div>

            {/* Signature hardware-timer module */}
            <div className="dw-reveal dw-reveal-2 relative flex justify-center lg:justify-end">
              <div aria-hidden="true" className="dw-hero-card-glow" />
              <div className="dw-hero-card-float relative">
                <TimerModuleMock />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ AUDIENCES ═══════════════ */}
      <section id="audiences" className="dw-bg-surface px-6 py-14 sm:py-20 lg:py-28 scroll-mt-16">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            num="01"
            eyebrow="Who it's for"
            title={<>One timer. A whole room.</>}
            sub="Co-working streams turn a lonely grind into a shared one. Dirework gives the streamer, the viewers, and the self-hoster each what they need."
          />
          <div className="mt-14 grid md:grid-cols-3 gap-5">
            {[
              {
                icon: Twitch,
                title: "For streamers",
                body: "Sign in with Twitch, connect a bot account, drop two browser sources in OBS. Run focus sprints without alt-tabbing mid-stream.",
                href: "/docs/getting-started",
                cta: "Getting started",
              },
              {
                icon: Users,
                title: "For viewers",
                body: "Add your own tasks from chat with !task, mark them !done, and watch your name land on the shared overlay. Body-doubling that sticks.",
                href: "/docs/chat-commands",
                cta: "Chat commands",
              },
              {
                icon: Server,
                title: "For self-hosters",
                body: "One Cloudflare account, two workers, one D1 database. Better Auth, tRPC, Drizzle. No server to babysit, no accounts to manage but your own.",
                href: "/docs/deployment",
                cta: "Deployment guide",
              },
            ].map(({ icon: Icon, title, body, href, cta }) => (
              <div key={title} className="dw-card dw-card-hover panel flex flex-col">
                <div
                  className="w-11 h-11 rounded-xl inline-flex items-center justify-center mb-5"
                  style={{ backgroundColor: "var(--brand-50)", color: "var(--brand-500)" }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="dw-display dw-text-1 text-xl mb-2">{title}</h3>
                <p className="dw-text-2 text-base leading-relaxed flex-1">{body}</p>
                <Link
                  href={href}
                  className="dw-text-brand mt-5 inline-flex items-center gap-1.5 text-sm font-semibold"
                >
                  {cta}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ TWITCH CHAT ═══════════════ */}
      <section id="chat" className="dw-bg-base px-6 py-14 sm:py-20 lg:py-28 scroll-mt-16">
        <div className="mx-auto max-w-6xl grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <Kicker num="02">Twitch chat bot</Kicker>
            <h2 className="dw-display dw-text-1 text-4xl sm:text-5xl mt-5">
              Chat is the control panel.
            </h2>
            <p className="dw-text-2 text-lg mt-5 leading-relaxed">
              Viewers run their own tasks with{" "}
              <code className="dw-mono dw-text-1">!task</code>,{" "}
              <code className="dw-mono dw-text-1">!done</code>, and{" "}
              <code className="dw-mono dw-text-1">!focus</code>. Mods drive the timer
              with <code className="dw-mono dw-text-1">!timer start</code>. Every
              command is aliasable and every reply is yours to reword. The bot runs from a
              private browser page you keep open in OBS or a pinned tab — no extra software to run.
            </p>
            <Link
              href="/docs/chat-commands"
              className="dw-text-brand mt-6 inline-flex items-center gap-1.5 text-sm font-semibold"
            >
              Full command reference
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <ChatCommandWidget />
        </div>
      </section>

      {/* ═══════════════ OVERLAYS ═══════════════ */}
      <section id="overlays" className="dw-bg-surface px-6 py-14 sm:py-20 lg:py-28 scroll-mt-16">
        <div className="mx-auto max-w-6xl grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="order-2 md:order-1">
            <OverlayThemePreview />
          </div>

          <div className="order-1 md:order-2">
            <Kicker num="03">Overlays &amp; themes</Kicker>
            <h2 className="dw-display dw-text-1 text-4xl sm:text-5xl mt-5">
              Transparent. Live. Zero refresh.
            </h2>
            <p className="dw-text-2 text-lg mt-5 leading-relaxed">
              Two transparent browser sources — a timer and a task list — for OBS.
              Each checks for changes every few seconds, so a{" "}
              <code className="dw-mono dw-text-1">!done</code> in chat lands on screen
              in about three seconds — and the countdown ticks smoothly on the overlay
              itself. Start from one of six presets and tune every color, font, size, and
              corner radius — pick a theme to preview it live.
            </p>
            <Link
              href="/docs/overlays"
              className="dw-text-brand mt-6 inline-flex items-center gap-1.5 text-sm font-semibold"
            >
              Set up the overlays
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════ FEATURES GRID ═══════════════ */}
      <section id="features" className="dw-bg-base px-6 py-14 sm:py-20 lg:py-28 scroll-mt-16">
        <div className="mx-auto max-w-6xl">
          <SectionHead num="04" eyebrow="What's in the box" title={<>Everything a focus stream needs.</>} />
          <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: Timer,
                title: "Pomodoro timer",
                body: "Configurable work, break, and long-break durations with automatic phase transitions and cycle tracking.",
              },
              {
                icon: MessageSquare,
                title: "Twitch chat bot",
                body: "Viewers manage tasks and mods drive the timer through chat — !task, !done, !timer, and friends.",
              },
              {
                icon: Tv,
                title: "OBS overlays",
                body: "Transparent browser sources that update within seconds. Circle or squircle progress rings and a smooth, always-live countdown.",
              },
              {
                icon: Palette,
                title: "Theme Center",
                body: "Visual style editor with 6 presets. Customize every color, font, size, and spacing for both overlays.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="dw-card panel">
                <div
                  className="w-10 h-10 rounded-xl inline-flex items-center justify-center mb-4"
                  style={{ backgroundColor: "var(--brand-50)", color: "var(--brand-500)" }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="dw-display dw-text-1 text-lg mb-2">{title}</h3>
                <p className="dw-text-2 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ COMPARISON ═══════════════ */}
      <section id="compare" className="dw-bg-surface px-6 py-14 sm:py-20 lg:py-28 scroll-mt-16">
        <div className="mx-auto max-w-5xl">
          <SectionHead
            num="05"
            eyebrow="Honest comparison"
            title={<>Why self-host Dirework?</>}
            sub="Hosted task widgets are convenient until they're not. Dirework trades a one-time setup for full ownership — on Cloudflare's free plan."
          />
          <div
            className="mt-12 overflow-x-auto focus-visible:outline-2 focus-visible:outline-[var(--brand-500)]"
            tabIndex={0}
            role="region"
            aria-label="Feature comparison table (scrolls horizontally)"
          >
            <div className="dw-card panel min-w-[600px]" style={{ padding: "1.5rem 2rem" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
                    <th className="text-left py-4 pr-4 dw-text-2 font-medium" scope="col">
                      Feature
                    </th>
                    <th className="text-center py-4 px-3 dw-text-brand font-semibold" scope="col">
                      Dirework
                    </th>
                    <th className="text-center py-4 px-3 dw-text-2 font-medium" scope="col">
                      Self-hosted bots
                      <span className="mt-0.5 block text-[0.7rem] font-normal dw-text-2">
                        Firebot · Mix It Up · Streamer.bot
                      </span>
                    </th>
                    <th className="text-center py-4 pl-3 dw-text-2 font-medium" scope="col">
                      Hosted platforms
                      <span className="mt-0.5 block text-[0.7rem] font-normal dw-text-2">
                        StreamElements · Streamlabs
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { feature: "Pomodoro + per-viewer task list, built in", a: "yes", b: "partial", c: "partial" },
                    { feature: "Live overlays, zero refresh", a: "yes", b: "partial", c: "partial" },
                    { feature: "Runs serverless — no always-on PC", a: "yes", b: "no", c: "yes" },
                    { feature: "Setup on Mac & Linux, not Windows-only", a: "yes", b: "partial", c: "yes" },
                    { feature: "Own your data & instance", a: "yes", b: "yes", c: "no" },
                    { feature: "Free to run", a: "yes", b: "yes", c: "partial" },
                    { feature: "Fully themeable overlays", a: "yes", b: "partial", c: "partial" },
                    { feature: "Open source", a: "yes", b: "partial", c: "no" },
                  ].map((row, i, arr) => (
                    <tr
                      key={row.feature}
                      style={i < arr.length - 1 ? { borderBottom: "1px solid var(--hairline)" } : undefined}
                    >
                      <td className="py-4 pr-4 dw-text-1">{row.feature}</td>
                      <td className="py-4 px-3"><CompareCell state={row.a as CellState} /></td>
                      <td className="py-4 px-3"><CompareCell state={row.b as CellState} /></td>
                      <td className="py-4 pl-3"><CompareCell state={row.c as CellState} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-5 text-center text-xs dw-text-2">
            Partial means &quot;depends on the tool or your plan.&quot; See the{" "}
            <Link href="/docs/features" className="dw-text-brand font-semibold">
              full feature breakdown
            </Link>
            .
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-center text-xs dw-text-2 leading-relaxed">
            Not sold on hosting a whole app? Honest alternatives worth a look:{" "}
            <a href="https://firebot.app" target="_blank" rel="noopener noreferrer" className="dw-text-brand font-medium">Firebot</a>{" "}
            and{" "}
            <a href="https://mixitupapp.com" target="_blank" rel="noopener noreferrer" className="dw-text-brand font-medium">Mix It Up</a>{" "}
            (all-in-one bots), or single-purpose OBS overlays like{" "}
            <a href="https://github.com/jujoco/twitch-multitask-task-list-overlay" target="_blank" rel="noopener noreferrer" className="dw-text-brand font-medium">jujoco&apos;s task list</a>{" "}
            and{" "}
            <a href="https://github.com/unfloned/pomodoro-twitch-overlay" target="_blank" rel="noopener noreferrer" className="dw-text-brand font-medium">unfloned&apos;s pomodoro</a>.
          </p>
        </div>
      </section>

      {/* ═══════════════ SELF-HOST / DEV ═══════════════ */}
      <section
        className="dw-bg-base px-6 py-14 sm:py-20 lg:py-28 relative overflow-hidden"
        style={{
          backgroundImage:
            "radial-gradient(color-mix(in srgb, var(--hairline) 70%, transparent) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      >
        <div className="mx-auto max-w-5xl relative">
          <SectionHead
            num="06"
            eyebrow="For self-hosters & devs"
            title={
              <>
                Two workers. One database.
                <br />
                <span className="dw-text-brand">Yours to fork.</span>
              </>
            }
            sub="A Next.js app and a Hono API on Cloudflare Workers, with Drizzle on D1. Deploy with Alchemy, set five secrets, and you're live on the free plan."
          />

          <div className="mt-12 grid md:grid-cols-2 gap-4">
            <div className="dw-card panel">
              <div className="console-rule mb-3">
                <span className="console-label">Quick start</span>
              </div>
              <pre className="dw-code">{`git clone ${GITHUB}.git
cd dirework
bun install
bun run dev   # web :3001 · api :3000 · docs :4000`}</pre>
            </div>
            <div className="dw-card panel">
              <div className="console-rule mb-3">
                <span className="console-label">The stack</span>
              </div>
              <ul className="space-y-2.5 text-sm dw-text-1">
                {[
                  "Next.js 16 (App Router, React 19) on Workers via OpenNext",
                  "Hono API worker + tRPC v11 (overlays poll every 3s)",
                  "Better Auth — Twitch OAuth, 30-day sessions",
                  "Drizzle ORM on Cloudflare D1 (SQLite)",
                  "Alchemy IaC + GitHub Actions deploy",
                ].map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--brand-500)" }} aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-8 grid sm:grid-cols-3 gap-4">
            {[
              { icon: BookOpen, title: "Environment variables", body: "Every var explained, with safe defaults.", href: "/docs/environment-variables", external: false },
              { icon: Cloud, title: "Deployment", body: "Cloudflare Workers + D1 via Alchemy, step by step.", href: "/docs/deployment", external: false },
              { icon: Github, title: "GitHub", body: "Star the repo, open an issue, or send a PR.", href: GITHUB, external: true },
            ].map(({ icon: Icon, title, body, href, external }) => {
              const inner = (
                <div className="flex items-start gap-4">
                  <div
                    className="w-10 h-10 rounded-xl inline-flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "var(--brand-50)", color: "var(--brand-500)" }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="dw-display dw-text-1 text-lg mb-1">
                      {title}
                      {external && (
                        <ExternalLink className="dw-text-2 ml-1 inline size-3.5 align-[-0.1em]" aria-hidden />
                      )}
                    </h3>
                    <p className="dw-text-2 text-sm leading-relaxed">{body}</p>
                  </div>
                </div>
              );
              const cn = "dw-card dw-card-hover panel block";
              return external ? (
                <a key={title} href={href} target="_blank" rel="noopener noreferrer" aria-label={`${title} (opens in a new tab)`} className={cn}>
                  {inner}
                </a>
              ) : (
                <Link key={title} href={href} className={cn}>
                  {inner}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════ FAQ ═══════════════ */}
      <section id="faq" className="dw-bg-surface px-6 py-14 sm:py-20 lg:py-28 scroll-mt-16">
        <div className="mx-auto max-w-3xl">
          <SectionHead num="07" eyebrow="Questions, answered" title={<>Anything else?</>} sub="Short answers here. Longer ones live in the docs." />
          <div className="mt-12 space-y-3">
            <FaqRow
              q="Do I need to host it myself?"
              a={
                <>
                  Yes — Dirework is self-hosted, one instance per streamer. That&apos;s
                  the trade for owning your data and never hitting a paywall. The{" "}
                  <Link href="/docs/deployment" className="dw-text-brand font-semibold">
                    deployment guide
                  </Link>{" "}
                  covers Cloudflare Workers + D1 via Alchemy — it runs happily on the free plan.
                </>
              }
            />
            <FaqRow
              q="Does it work with anything other than Twitch?"
              a={<>Not today. Login and the chat bot are built on Twitch OAuth and IRC. Other platforms aren&apos;t supported yet.</>}
            />
            <FaqRow
              q="Can viewers really edit the task list?"
              a={
                <>
                  Each viewer manages their own tasks from chat — add, focus, complete,
                  edit, remove. Broadcaster and mods get clear-all and per-user controls.
                  See the{" "}
                  <Link href="/docs/chat-commands" className="dw-text-brand font-semibold">
                    chat commands
                  </Link>
                  .
                </>
              }
            />
            <FaqRow
              q="How do the overlays stay in sync?"
              a={<>The overlays check for changes every few seconds, and the countdown ticks on the overlay itself from the timer&apos;s end time — so a !done lands within a few seconds with no flicker. There&apos;s no fragile real-time connection to babysit, which is exactly what keeps it on Cloudflare&apos;s free plan.</>}
            />
            <FaqRow
              q="Is it really free?"
              a={
                <>
                  Yes. Open source on{" "}
                  <a href={GITHUB} target="_blank" rel="noopener noreferrer" className="dw-text-brand font-semibold">
                    GitHub
                  </a>
                  , and it fits inside Cloudflare&apos;s free Workers + D1 tiers. No premium
                  tier, no telemetry.
                </>
              }
            />
          </div>
          <p className="mt-10 text-center text-sm dw-text-2">
            More questions?{" "}
            <a href={DISCORD} target="_blank" rel="noopener noreferrer" className="dw-text-brand font-semibold">
              Ask in Discord
            </a>
            .
          </p>
        </div>
      </section>

      {/* ═══════════════ CTA ═══════════════ */}
      <section className="dw-bg-base px-6 py-28 sm:py-36">
        <div className="mx-auto max-w-4xl text-center">
          <div
            className="w-12 h-12 rounded-2xl inline-flex items-center justify-center mb-6 mx-auto"
            style={{ backgroundColor: "var(--brand-50)", color: "var(--brand-500)" }}
          >
            <Timer className="w-5 h-5" />
          </div>
          <h2 className="dw-display dw-text-1 text-5xl sm:text-6xl lg:text-7xl">
            Start the timer.
            <br />
            <span className="dw-text-brand">Bring the whole chat.</span>
          </h2>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/docs/getting-started" className="dw-btn dw-btn-primary">
              <Terminal className="w-4 h-4" />
              Get started
            </Link>
            <Link href="/docs" className="dw-btn dw-btn-secondary">
              Read the docs
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a href={GITHUB} target="_blank" rel="noopener noreferrer" className="dw-btn dw-btn-ghost">
              <Github className="w-4 h-4" />
              Star on GitHub
            </a>
          </div>
          <p className="mt-5 dw-mono text-xs dw-text-2 tracking-wide">Self-hosted · Open source · Built for co-working streams</p>
        </div>
      </section>
    </div>
  );
}
