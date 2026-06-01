import Link from "next/link";
import { Montserrat, JetBrains_Mono } from "next/font/google";
import {
  Timer,
  MessageSquare,
  Tv,
  Palette,
  LogIn,
  MonitorPlay,
  Sparkles,
  ArrowRight,
} from "lucide-react";

const heading = Montserrat({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--dw-font-heading",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--dw-font-mono",
});

const features = [
  {
    icon: Timer,
    title: "Pomodoro timer",
    description:
      "Set your focus and break lengths once. The timer counts down on stream and moves to the next phase on its own.",
  },
  {
    icon: MessageSquare,
    title: "Chat runs the tasks",
    description:
      "Viewers add their own to-dos with simple chat commands. No accounts, no apps — they just type and go.",
  },
  {
    icon: Tv,
    title: "Drops into OBS",
    description:
      "Two transparent browser-source overlays — timer and task list. Paste a URL, line it up, done.",
  },
  {
    icon: Palette,
    title: "Make it yours",
    description:
      "11 ready-made looks plus a visual editor for every color, font, and size. Change it live, see it instantly.",
  },
];

const steps = [
  {
    icon: LogIn,
    title: "Sign in with Twitch",
    description: "One click. Your channel, your instance. Nothing else to set up.",
  },
  {
    icon: MonitorPlay,
    title: "Add the overlays to OBS",
    description: "Copy two URLs into browser sources. That's the whole setup.",
  },
  {
    icon: MessageSquare,
    title: "Let your chat join in",
    description: "Viewers type !task to add to-dos and !timer to run the clock with you.",
  },
];

const commands = ["!task finish the slides", "!done", "!timer start", "!time"];

export default function HomePage() {
  return (
    <main className={`${heading.variable} ${mono.variable} flex flex-1 flex-col`}>
      {/* ───────────────────────── Hero ───────────────────────── */}
      <section className="dw-aurora dw-grain relative isolate overflow-hidden px-4 pb-24 pt-20 sm:pt-28">
        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center">
          {/* Signature focus ring */}
          <div
            className="dw-rise relative mb-10 size-28 sm:size-32"
            style={{ animationDelay: "0ms" }}
          >
            <svg viewBox="0 0 120 120" className="size-full">
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="var(--color-fd-border)"
                strokeWidth="6"
              />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="var(--color-fd-primary)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray="180 327"
                className="dw-ring-sweep"
              />
            </svg>
            <div className="dw-breathe absolute inset-0 flex items-center justify-center">
              <Timer
                className="size-9 sm:size-10"
                style={{ color: "var(--color-fd-primary)" }}
              />
            </div>
          </div>

          <span
            className="dw-rise mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--color-fd-border)] bg-[var(--color-fd-card)] px-4 py-1.5 text-xs font-medium text-[var(--color-fd-muted-foreground)]"
            style={{ animationDelay: "80ms" }}
          >
            <Sparkles className="size-3.5" style={{ color: "var(--color-fd-primary)" }} />
            Self-hosted · Open source · One streamer per instance
          </span>

          <h1
            className="dw-rise font-[family-name:var(--dw-font-heading)] text-4xl font-extrabold leading-[1.05] tracking-tight text-[var(--color-fd-foreground)] sm:text-6xl"
            style={{ animationDelay: "140ms" }}
          >
            Focus together.
            <br />
            <span className="bg-gradient-to-r from-[var(--color-fd-primary)] to-[hsl(190deg_90%_55%)] bg-clip-text text-transparent">
              Finish together.
            </span>
          </h1>

          <p
            className="dw-rise mx-auto mt-6 max-w-xl text-lg text-[var(--color-fd-muted-foreground)]"
            style={{ animationDelay: "200ms" }}
          >
            A co-working Pomodoro timer and shared task list for your Twitch stream.
            You set the rhythm — your chat works right alongside you.
          </p>

          <div
            className="dw-rise mt-9 flex flex-wrap items-center justify-center gap-3"
            style={{ animationDelay: "260ms" }}
          >
            <Link
              href="/docs/getting-started"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--color-fd-primary)] px-6 text-sm font-semibold text-[var(--color-fd-primary-foreground)] shadow-lg shadow-[hsl(262deg_83%_50%_/_0.35)] transition-transform hover:-translate-y-0.5"
            >
              Start in 3 steps
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/docs"
              className="inline-flex h-11 items-center rounded-xl border border-[var(--color-fd-border)] bg-[var(--color-fd-card)] px-6 text-sm font-semibold text-[var(--color-fd-foreground)] transition-colors hover:bg-[var(--color-fd-accent)]"
            >
              Read the docs
            </Link>
            <a
              href="https://github.com/mrdemonwolf/dirework"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--color-fd-border)] bg-[var(--color-fd-card)] px-6 text-sm font-semibold text-[var(--color-fd-foreground)] transition-colors hover:bg-[var(--color-fd-accent)]"
            >
              <svg className="size-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              GitHub
            </a>
          </div>

          {/* Command chips — the Twitch-chat motif */}
          <div
            className="dw-rise mt-12 flex flex-wrap items-center justify-center gap-2"
            style={{ animationDelay: "340ms" }}
          >
            {commands.map((cmd) => (
              <code
                key={cmd}
                className="rounded-lg border border-[var(--color-fd-border)] bg-[var(--color-fd-card)] px-3 py-1.5 font-[family-name:var(--dw-font-mono)] text-xs text-[var(--color-fd-muted-foreground)]"
              >
                <span style={{ color: "var(--color-fd-primary)" }}>
                  {cmd.split(" ")[0]}
                </span>
                {cmd.includes(" ") ? " " + cmd.split(" ").slice(1).join(" ") : ""}
              </code>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────── How it works ─────────────────────── */}
      <section className="mx-auto w-full max-w-5xl px-4 py-20">
        <div className="mb-12 text-center">
          <p className="font-[family-name:var(--dw-font-mono)] text-xs uppercase tracking-[0.2em] text-[var(--color-fd-primary)]">
            How it works
          </p>
          <h2 className="mt-3 font-[family-name:var(--dw-font-heading)] text-3xl font-bold text-[var(--color-fd-foreground)]">
            Up and running in three steps
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[var(--color-fd-muted-foreground)]">
            No databases to wire up by hand. No plugins to install. If you can paste a
            link into OBS, you can run Dirework.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step.title} className="dw-card rounded-2xl p-6">
              <div className="mb-4 flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-fd-accent)]">
                  <step.icon
                    className="size-5"
                    style={{ color: "var(--color-fd-primary)" }}
                  />
                </span>
                <span className="font-[family-name:var(--dw-font-heading)] text-3xl font-extrabold text-[var(--color-fd-border)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="font-[family-name:var(--dw-font-heading)] text-lg font-bold text-[var(--color-fd-foreground)]">
                {step.title}
              </h3>
              <p className="mt-1.5 text-sm text-[var(--color-fd-muted-foreground)]">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────────────────── Features ───────────────────────── */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-24">
        <div className="mb-12 text-center">
          <p className="font-[family-name:var(--dw-font-mono)] text-xs uppercase tracking-[0.2em] text-[var(--color-fd-primary)]">
            What you get
          </p>
          <h2 className="mt-3 font-[family-name:var(--dw-font-heading)] text-3xl font-bold text-[var(--color-fd-foreground)]">
            Everything for a focus stream
          </h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.title} className="dw-card flex gap-4 rounded-2xl p-6">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-fd-accent)]">
                <feature.icon
                  className="size-5"
                  style={{ color: "var(--color-fd-primary)" }}
                />
              </span>
              <div>
                <h3 className="font-[family-name:var(--dw-font-heading)] text-lg font-bold text-[var(--color-fd-foreground)]">
                  {feature.title}
                </h3>
                <p className="mt-1 text-sm text-[var(--color-fd-muted-foreground)]">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────────────────── Closing CTA ─────────────────────── */}
      <section className="px-4 pb-28">
        <div className="dw-aurora dw-grain relative isolate mx-auto max-w-4xl overflow-hidden rounded-3xl border border-[var(--color-fd-border)] px-6 py-16 text-center">
          <div className="relative z-10">
            <h2 className="font-[family-name:var(--dw-font-heading)] text-3xl font-extrabold text-[var(--color-fd-foreground)] sm:text-4xl">
              Ready to focus?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[var(--color-fd-muted-foreground)]">
              Fork it, run your own instance, and host your first co-working session
              today. It&apos;s free and yours to keep.
            </p>
            <Link
              href="/docs/getting-started"
              className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-[var(--color-fd-primary)] px-8 text-sm font-semibold text-[var(--color-fd-primary-foreground)] shadow-lg shadow-[hsl(262deg_83%_50%_/_0.35)] transition-transform hover:-translate-y-0.5"
            >
              Get started
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
