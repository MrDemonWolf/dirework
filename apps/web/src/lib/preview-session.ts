// The Theme Center preview's sample data, taken from the shared demo session in
// @dirework/overlay-kit so the preview, the landing page and the docs show the same
// viewers, tasks and countdown.

import { DEMO_SESSION } from "@dirework/overlay-kit";

import type { Task } from "@/lib/task-utils";

/**
 * Twitch chat colors for the demo viewers, in order of first appearance. The first
 * viewer has none (null), so the preview also shows the "Fallback username color" the
 * streamer picks for viewers who never set one.
 */
const PREVIEW_AUTHOR_COLORS: readonly (string | null)[] = [null, "#ff6b35", "#2dd4bf"];

const authors = [...new Set(DEMO_SESSION.tasks.map((task) => task.author))];

/** DEMO_SESSION's tasks as the task overlay receives them: active, pending and done rows. */
export const PREVIEW_TASKS: Task[] = DEMO_SESSION.tasks.map((task, index) => {
  const authorIndex = authors.indexOf(task.author);
  return {
    id: `demo-${index}`,
    authorTwitchId: `demo-${authorIndex}`,
    authorDisplayName: task.author,
    authorColor: PREVIEW_AUTHOR_COLORS[authorIndex % PREVIEW_AUTHOR_COLORS.length] ?? null,
    text: task.text,
    status: task.status,
  };
});

/** Length of the previewed focus block, and how much of it is left when the preview opens. */
export const PREVIEW_PHASE_MS = DEMO_SESSION.phaseMs;
export const PREVIEW_REMAINING_MS = DEMO_SESSION.remainingMs;
export const PREVIEW_CYCLE = DEMO_SESSION.cycle;

export type PreviewBackdrop = "dark" | "light" | "bright" | "checker";

/**
 * The preview canvas backdrops: simulated stream scenes (classes in index.css), deliberately
 * outside the app palette. Not named `bg-*`: tailwind-merge (`cn`) reads any `bg-*` class as
 * a background color, so a `bg-*` scene beside `bg-grain` was silently dropped.
 */
export const PREVIEW_BACKDROPS: readonly {
  id: PreviewBackdrop;
  label: string;
  /** The canvas classes. */
  className: string;
  /** The swatch button's classes. */
  swatch: string;
}[] = [
  {
    id: "dark",
    label: "Dark backdrop",
    className: "preview-scene-dark bg-grain",
    swatch: "preview-scene-dark",
  },
  {
    id: "light",
    label: "Light backdrop",
    className: "preview-scene-light bg-grain",
    swatch: "preview-scene-light",
  },
  {
    id: "bright",
    label: "Bright backdrop",
    className: "preview-scene-bright",
    swatch: "preview-scene-bright",
  },
  { id: "checker", label: "Checkerboard backdrop", className: "bg-checker", swatch: "bg-checker" },
];
