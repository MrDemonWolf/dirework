import Link from "next/link";
import { Timer, ListTodo, Tv, MessageSquare, Palette, Settings, Shield, Sparkles } from "lucide-react";

const features = [
  {
    icon: Timer,
    title: "Pomodoro Timer",
    description:
      "Configurable work/break/long break durations with automatic phase transitions and cycle tracking.",
  },
  {
    icon: ListTodo,
    title: "Task List",
    description:
      "Viewers add and manage tasks via chat commands, displayed as a scrolling OBS overlay.",
  },
  {
    icon: MessageSquare,
    title: "Twitch Chat Bot",
    description:
      "Chat commands for tasks and timer. Connect a bot account and your viewers can interact live.",
  },
  {
    icon: Tv,
    title: "OBS Overlays",
    description:
      "Transparent browser source overlays with real-time updates. Circle or squircle progress rings.",
  },
  {
    icon: Palette,
    title: "Theme Center",
    description:
      "Visual editor with 11 presets. Customize every color, font, size, and spacing for both overlays.",
  },
  {
    icon: Settings,
    title: "Dashboard",
    description:
      "Control timer, manage tasks, toggle overlay previews, and configure everything from one page.",
  },
  {
    icon: Shield,
    title: "Self-Hosted",
    description:
      "Single-user per instance. Deploy on your own server and keep full control of your data.",
  },
  {
    icon: Sparkles,
    title: "Liquid Glass UI",
    description:
      "macOS-inspired translucent theme with backdrop blur, blue accents, and dark/light mode toggle.",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col flex-1">
      {/* Hero */}
      <section className="px-4 py-24">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Dirework
          </h1>
          <p className="max-w-2xl text-lg text-fd-muted-foreground">
            Self-hosted Pomodoro timer and task list with Twitch chat integration.
            Designed for co-working and body-doubling streams.
          </p>
          <div className="flex gap-3">
            <Link
              href="/docs/getting-started"
              className="inline-flex h-10 items-center rounded-md bg-fd-primary px-6 text-sm font-medium text-fd-primary-foreground transition-colors hover:bg-fd-primary/90"
            >
              Get Started
            </Link>
            <Link
              href="/docs"
              className="inline-flex h-10 items-center rounded-md border border-fd-border px-6 text-sm font-medium transition-colors hover:bg-fd-accent"
            >
              Documentation
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-fd-border px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-10 text-center text-2xl font-bold">Features</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-lg border border-fd-border bg-fd-card p-6"
              >
                <feature.icon className="mb-3 size-6 text-fd-primary" />
                <h3 className="mb-2 font-semibold">{feature.title}</h3>
                <p className="text-sm text-fd-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Start */}
      <section className="border-t border-fd-border px-4 py-16">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="mb-4 text-2xl font-bold">Quick Start</h2>
          <p className="mb-8 text-fd-muted-foreground">
            Get up and running in minutes.
          </p>
          <div className="mx-auto max-w-2xl rounded-lg border border-fd-border bg-fd-card p-6 text-left">
            <pre className="overflow-x-auto text-sm">
              <code>{`git clone https://github.com/mrdemonwolf/dirework.git
cd dirework
pnpm install
pnpm db:start
pnpm db:push
pnpm dev`}</code>
            </pre>
          </div>
          <p className="mt-4 text-sm text-fd-muted-foreground">
            See the{" "}
            <Link
              href="/docs/getting-started"
              className="font-medium underline"
            >
              full setup guide
            </Link>{" "}
            for Twitch OAuth configuration and environment variables.
          </p>
        </div>
      </section>
    </div>
  );
}
