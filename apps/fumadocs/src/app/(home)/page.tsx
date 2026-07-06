import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  Code2,
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
import { TimerOverlayWidget } from "./_widgets/TimerOverlayWidget";
import { TaskListWidget } from "./_widgets/TaskListWidget";
import { ChatCommandWidget } from "./_widgets/ChatCommandWidget";
import { ThemeGallery } from "./_widgets/ThemeGallery";

const GITHUB = "https://github.com/mrdemonwolf/dirework";
const DISCORD = "https://mrdwolf.net/discord";

export const metadata: Metadata = {
  title: "Dirework — Focus. Together.",
  description:
    "Self-hosted Pomodoro timer and task list with Twitch chat integration. Built for co-working and body-doubling streams.",
  alternates: { canonical: "/" },
};

// ── Section heading helper ───────────────────────────────────
function SectionHead({
  eyebrow,
  title,
  sub,
  align = "center",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  align?: "center" | "left";
}) {
  return (
    <div className={`max-w-3xl ${align === "center" ? "mx-auto text-center" : ""}`}>
      {eyebrow ? (
        <p className="dw-text-brand text-sm font-semibold mb-3">{eyebrow}</p>
      ) : null}
      <h2 className="dw-display dw-text-1 text-4xl sm:text-5xl lg:text-6xl">{title}</h2>
      {sub ? (
        <p className="dw-text-2 text-lg sm:text-xl mt-5 leading-relaxed">{sub}</p>
      ) : null}
    </div>
  );
}

// ── Comparison cell ──────────────────────────────────────────
type CellState = "yes" | "no" | "partial";
function CompareCell({ state }: { state: CellState }) {
  const Icon = state === "yes" ? Check : state === "partial" ? Minus : XIcon;
  const color =
    state === "yes" ? "var(--brand-500)" : "var(--txt-2)";
  const bg =
    state === "yes" ? "var(--brand-50)" : "var(--bg-surface)";
  return (
    <div className="flex items-center justify-center">
      <span
        className="inline-flex items-center justify-center w-7 h-7 rounded-full"
        style={{ backgroundColor: bg, color }}
        aria-label={state === "yes" ? "Yes" : state === "no" ? "No" : "Partial"}
      >
        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      </span>
    </div>
  );
}

// ── FAQ row ──────────────────────────────────────────────────
function FaqRow({ q, a }: { q: string; a: React.ReactNode }) {
  return (
    <details
      className="group dw-card dw-bg-elev"
      style={{ border: "1px solid var(--hairline)", padding: "1.25rem 1.5rem" }}
    >
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
  return (
    <main className="dw-font dw-bg-base">
      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative overflow-hidden">
        <div className="dw-hero-glow" aria-hidden="true" />
        <div className="relative z-10 px-6 pt-12 pb-16 sm:pt-20 sm:pb-24">
          <div className="mx-auto max-w-6xl grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center">
            <div className="text-center lg:text-left">
              <p className="dw-reveal dw-reveal-1 dw-text-brand text-sm font-semibold mb-5">
                Self-hosted · Twitch-native · Open source
              </p>
              <h1 className="dw-reveal dw-reveal-1 dw-hero-headline dw-text-1">
                Focus.{" "}
                <span className="dw-text-brand">Together.</span>
              </h1>
              <p className="dw-reveal dw-reveal-2 dw-text-2 text-lg sm:text-xl mt-6 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Dirework is a self-hosted Pomodoro timer and shared task list for
                co-working and body-doubling streams. You run the timer, your
                Twitch chat runs the tasks, and OBS shows it all in real time.
              </p>
              <div className="dw-reveal dw-reveal-3 mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
                <Link href="/docs/getting-started" className="dw-btn dw-btn-primary">
                  <Terminal className="w-4 h-4" />
                  Get Started
                </Link>
                <Link href="/docs" className="dw-btn dw-btn-secondary">
                  Read the docs
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <p className="mt-5 text-sm dw-text-2">
                Run it on your own box · One instance per streamer · No SaaS, no lock-in
              </p>

              <div className="dw-reveal dw-reveal-3 mt-7 flex flex-wrap items-center justify-center lg:justify-start gap-2">
                <a href={GITHUB} target="_blank" rel="noopener noreferrer" className="dw-pill">
                  <Github className="w-3 h-3" /> Open source
                </a>
                <span className="dw-pill">
                  <Shield className="w-3 h-3" /> Your data, your server
                </span>
                <a href={DISCORD} target="_blank" rel="noopener noreferrer" className="dw-pill">
                  <Radio className="w-3 h-3" /> Discord community
                </a>
              </div>
            </div>

            {/* Live timer overlay mock */}
            <div className="dw-reveal dw-reveal-2 relative flex justify-center lg:justify-end">
              <div aria-hidden="true" className="dw-hero-card-glow" />
              <div className="dw-hero-card-float relative">
                <TimerOverlayWidget />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ AUDIENCES ═══════════════ */}
      <section className="dw-bg-surface px-6 py-14 sm:py-20 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            eyebrow="Who it's for"
            title={<>One timer. A whole room.</>}
            sub="Co-working streams turn a lonely grind into a shared one. Dirework gives the streamer, the viewers, and the self-hoster each what they need."
          />
          <div className="mt-14 grid md:grid-cols-3 gap-5">
            {[
              {
                icon: Twitch,
                title: "For streamers",
                body: "Log in with Twitch, connect a bot account, drop two browser sources in OBS. Run focus sprints without touching alt-tab mid-stream.",
                href: "/docs/getting-started",
                cta: "Getting started",
              },
              {
                icon: Users,
                title: "For viewers",
                body: "Add your own tasks straight from chat with !task, mark them !done, and watch your name show up on the shared overlay. Body-doubling that sticks.",
                href: "/docs/chat-commands",
                cta: "Chat commands",
              },
              {
                icon: Server,
                title: "For self-hosters",
                body: "One Docker image, one Postgres, one streamer per instance. Better Auth, tRPC, Drizzle. No accounts to manage but your own.",
                href: "/docs/deployment",
                cta: "Deployment guide",
              },
            ].map(({ icon: Icon, title, body, href, cta }) => (
              <div key={title} className="dw-card dw-card-hover dw-glass flex flex-col">
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
      <section className="dw-bg-base px-6 py-14 sm:py-20 lg:py-28">
        <div className="mx-auto max-w-6xl grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <p className="dw-text-brand text-sm font-semibold mb-3">Twitch chat bot</p>
            <h2 className="dw-display dw-text-1 text-4xl sm:text-5xl">
              Chat is the control panel.
            </h2>
            <p className="dw-text-2 text-lg mt-5 leading-relaxed">
              Viewers run their own tasks with{" "}
              <code className="dw-mono dw-text-1">!task</code>,{" "}
              <code className="dw-mono dw-text-1">!done</code>, and{" "}
              <code className="dw-mono dw-text-1">!focus</code>. Mods drive the timer
              with <code className="dw-mono dw-text-1">!timer start</code>. Every
              command is aliasable, and replies are yours to reword.
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
      <section className="dw-bg-surface px-6 py-14 sm:py-20 lg:py-28">
        <div className="mx-auto max-w-6xl grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
          <figure
            className="order-2 md:order-1 mx-auto rounded-2xl overflow-hidden"
            style={{
              width: "100%",
              maxWidth: 520,
              border: "1px solid var(--hairline)",
              boxShadow: "var(--ds-shadow-lg)",
            }}
            aria-label="Task list overlay inside an OBS browser source"
          >
            <div
              className="px-4 py-2.5 flex items-center gap-2 text-xs dw-mono dw-text-2"
              style={{ backgroundColor: "var(--bg-base)", borderBottom: "1px solid var(--hairline)" }}
              aria-hidden="true"
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#ff5f57" }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#febc2e" }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#28c840" }} />
              <span className="ml-2">/overlay/l/•••</span>
            </div>
            <div
              style={{
                backgroundColor: "#0d0d0f",
                backgroundImage:
                  "linear-gradient(45deg, rgba(255,255,255,0.025) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.025) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.025) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.025) 75%)",
                backgroundSize: "16px 16px",
                backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
                padding: "28px 24px",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <TaskListWidget />
            </div>
          </figure>

          <div className="order-1 md:order-2">
            <p className="dw-text-brand text-sm font-semibold mb-3">OBS overlays</p>
            <h2 className="dw-display dw-text-1 text-4xl sm:text-5xl">
              Transparent. Real-time. Zero refresh.
            </h2>
            <p className="dw-text-2 text-lg mt-5 leading-relaxed">
              Two browser sources — a timer and a task list — with transparent
              backgrounds for OBS. Updates stream over Server-Sent Events, so a{" "}
              <code className="dw-mono dw-text-1">!done</code> in chat lands on
              screen instantly. Pick a circle or macOS-style squircle ring.
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

      {/* ═══════════════ THEME CENTER ═══════════════ */}
      <section className="dw-bg-base px-6 py-14 sm:py-20 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            eyebrow="Theme Center"
            title={<>Six themes. Every pixel yours.</>}
            sub="Start from a preset, then tune every color, font, size, and corner radius in a live editor. Or build the look of your whole channel from scratch."
          />
          <div className="mt-12">
            <ThemeGallery />
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/docs/overlays"
              className="dw-text-brand inline-flex items-center gap-1.5 text-sm font-semibold"
            >
              Customize your overlays
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════ FEATURES GRID ═══════════════ */}
      <section className="dw-bg-surface px-6 py-14 sm:py-20 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHead eyebrow="What's in the box" title={<>Everything a focus stream needs.</>} />
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
                body: "Transparent browser sources with real-time SSE updates. Circle or squircle progress rings.",
              },
              {
                icon: Palette,
                title: "Theme Center",
                body: "Visual style editor with 6 presets. Customize every color, font, size, and spacing for both overlays.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="dw-card dw-bg-elev"
                style={{ border: "1px solid var(--hairline)" }}
              >
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
      <section className="dw-bg-base px-6 py-14 sm:py-20 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <SectionHead
            eyebrow="Honest comparison"
            title={<>Why self-host Dirework?</>}
            sub="Hosted task widgets are convenient until they're not. Dirework trades a one-time setup for full ownership."
          />
          <div className="mt-12 overflow-x-auto">
            <div
              className="dw-card dw-bg-elev min-w-[600px]"
              style={{ border: "1px solid var(--hairline)" }}
            >
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
                      Hosted task widgets
                    </th>
                    <th className="text-center py-4 pl-3 dw-text-2 font-medium" scope="col">
                      Generic timer bots
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { feature: "Pomodoro timer + overlay", a: "yes", b: "partial", c: "yes" },
                    { feature: "Per-viewer task list", a: "yes", b: "yes", c: "no" },
                    { feature: "Real-time (no polling)", a: "yes", b: "partial", c: "no" },
                    { feature: "Self-hosted / own your data", a: "yes", b: "no", c: "no" },
                    { feature: "Fully themeable overlays", a: "yes", b: "partial", c: "no" },
                    { feature: "Open source", a: "yes", b: "no", c: "partial" },
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
        </div>
      </section>

      {/* ═══════════════ SELF-HOST / DEV ═══════════════ */}
      <section
        className="dw-bg-surface px-6 py-14 sm:py-20 lg:py-28 relative overflow-hidden"
        style={{
          backgroundImage:
            "radial-gradient(color-mix(in srgb, var(--hairline) 70%, transparent) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      >
        <div className="mx-auto max-w-5xl relative">
          <SectionHead
            eyebrow="For self-hosters & devs"
            title={
              <>
                One image. One database.
                <br />
                <span className="dw-text-brand">Yours to fork.</span>
              </>
            }
            sub="A Next.js app, a tRPC API, and Drizzle on Postgres. Deploy with the Dockerfile, set six env vars, and you're live."
          />

          <div className="mt-12 grid md:grid-cols-2 gap-4">
            <div className="dw-card dw-bg-elev" style={{ border: "1px solid var(--hairline)" }}>
              <p className="dw-mono text-xs dw-text-2 mb-3">QUICK START</p>
              <pre className="dw-code">{`git clone ${GITHUB}.git
cd dirework
bun install
bun run db:start && bun run db:push
bun run dev   # web on :3001, docs on :4000`}</pre>
            </div>
            <div className="dw-card dw-bg-elev" style={{ border: "1px solid var(--hairline)" }}>
              <p className="dw-mono text-xs dw-text-2 mb-3">THE STACK</p>
              <ul className="space-y-2.5 text-sm dw-text-1">
                {[
                  "Next.js 16 (App Router, React 19, React Compiler)",
                  "tRPC v11 with SSE subscriptions for overlays",
                  "Better Auth — Twitch OAuth, 30-day sessions",
                  "Drizzle ORM on PostgreSQL 17",
                  "Docker + Coolify, output: standalone",
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
              { icon: Code2, title: "Design system", body: "Tokens, components, and the dw-* utility layer.", href: "/docs/design-system", external: false },
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
                    <h3 className="dw-display dw-text-1 text-lg mb-1">{title}</h3>
                    <p className="dw-text-2 text-sm leading-relaxed">{body}</p>
                  </div>
                </div>
              );
              const cn = "dw-card dw-card-hover dw-bg-elev block";
              const st = { border: "1px solid var(--hairline)" } as const;
              return external ? (
                <a key={title} href={href} target="_blank" rel="noopener noreferrer" className={cn} style={st}>
                  {inner}
                </a>
              ) : (
                <Link key={title} href={href} className={cn} style={st}>
                  {inner}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════ FAQ ═══════════════ */}
      <section className="dw-bg-base px-6 py-14 sm:py-20 lg:py-28">
        <div className="mx-auto max-w-3xl">
          <SectionHead eyebrow="Questions, answered" title={<>Anything else?</>} sub="Short answers here. Longer ones live in the docs." />
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
                  covers Docker and Coolify.
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
              q="How do the overlays update so fast?"
              a={<>Server-Sent Events over tRPC subscriptions. Task and timer writes emit events; the overlay listens and pushes fresh state — no polling, no flicker.</>}
            />
            <FaqRow
              q="Is it really free?"
              a={
                <>
                  Yes. Open source on{" "}
                  <a href={GITHUB} target="_blank" rel="noopener noreferrer" className="dw-text-brand font-semibold">
                    GitHub
                  </a>
                  . No premium tier, no telemetry.
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
      <section className="dw-bg-surface px-6 py-28 sm:py-36">
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
              Get Started
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
          <p className="mt-5 text-sm dw-text-2">Self-hosted · Open source · Built for co-working streams</p>
        </div>
      </section>
    </main>
  );
}
