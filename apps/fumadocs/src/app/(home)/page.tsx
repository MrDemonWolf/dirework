import Link from "next/link";
import { Timer, MessageSquare, Tv, Palette } from "lucide-react";

const features = [
  {
    icon: Timer,
    title: "Pomodoro Timer",
    description:
      "Configurable work, break, and long break durations with automatic phase transitions and cycle tracking.",
  },
  {
    icon: MessageSquare,
    title: "Twitch Chat Bot",
    description:
      "Viewers manage tasks and control the timer through chat commands like !task, !done, and !timer.",
  },
  {
    icon: Tv,
    title: "OBS Overlays",
    description:
      "Transparent browser source overlays with real-time SSE updates. Circle or squircle progress rings.",
  },
  {
    icon: Palette,
    title: "Theme Center",
    description:
      "Visual style editor with 11 presets. Customize every color, font, size, and spacing for both overlays.",
  },
];

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4">
      <div className="w-full max-w-4xl text-center">
        <h1 className="mb-4 text-5xl font-extrabold tracking-tight text-slate-900 sm:text-6xl dark:text-white">
          Focus. Together.
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-lg text-slate-500 dark:text-slate-400">
          Self-hosted Pomodoro timer and task list with Twitch chat integration.
          Built for co-working and body-doubling streams.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/docs/getting-started"
            className="inline-flex h-10 items-center gap-2 rounded-md px-6 text-sm font-medium text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: "var(--color-fd-primary)" }}
          >
            Get Started
          </Link>
          <Link
            href="/docs"
            className="inline-flex h-10 items-center rounded-md border border-slate-200 px-6 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:text-white dark:hover:bg-slate-800"
          >
            Documentation
          </Link>
          <a
            href="https://github.com/mrdemonwolf/dirework"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-6 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:text-white dark:hover:bg-slate-800"
          >
            <svg className="size-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub
          </a>
        </div>
      </div>

      <div className="mx-auto mt-20 w-full max-w-4xl border-t border-slate-200 pt-12 dark:border-slate-800">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div key={feature.title}>
              <div
                className="mb-3 inline-flex items-center justify-center rounded-lg p-2"
                style={{ color: "var(--color-fd-primary)" }}
              >
                <feature.icon className="size-6" />
              </div>
              <h3 className="mb-1 text-lg font-bold">{feature.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
