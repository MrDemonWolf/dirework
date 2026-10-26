// The Theme Center preview's sample data, taken from the shared demo session in
// @dirework/overlay-kit so the preview, the landing page and the docs show the same
// viewers, tasks and countdown.

import { DEMO_SESSION, cssLengthToPx } from "@dirework/overlay-kit";

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

export interface Size {
  width: number;
  height: number;
}

/** The stream the preview stands in for: a 1080p OBS canvas, in logical pixels. */
export const STREAM_CANVAS: Size = { width: 1920, height: 1080 };

/** The recommended task-list browser source (the dashboard's size chip). */
export const TASKS_SOURCE: Size = { width: 700, height: 800 };

/** The recommended timer browser source, used when its dimensions are not plain lengths. */
export const TIMER_SOURCE_FALLBACK: Size = { width: 300, height: 300 };

/** Gap between a source and the canvas edge: where streamers usually park an overlay. */
const SCENE_INSET = 48;

/**
 * The timer's browser source on the canvas. The overlay draws the frame at
 * `dimensions` and AutoScales it to fill its source, so a source sized to the
 * dimensions shows it 1:1. Layout-relative lengths (%, vw) have no size until a source
 * exists, so they get the recommended 300 × 300.
 */
export function timerSourceSize(dimensions: { width: string; height: string }): Size {
  const width = cssLengthToPx(dimensions.width);
  const height = cssLengthToPx(dimensions.height);
  if (width == null || height == null || width <= 0 || height <= 0) return TIMER_SOURCE_FALLBACK;
  return { width, height };
}

export interface SceneSource extends Size {
  x: number;
  y: number;
}

/**
 * Where each overlay sits on the 1920 × 1080 preview canvas: the task list down the left
 * edge, the timer in the top-right corner, a common co-working layout. A source larger
 * than the canvas is pinned to its edge rather than pushed off it.
 */
export function previewSceneLayout(timer: Size): { timer: SceneSource; tasks: SceneSource } {
  const place = (size: Size, x: number): SceneSource => ({
    ...size,
    x: Math.max(0, Math.min(x, STREAM_CANVAS.width - size.width)),
    y: Math.max(0, Math.min(SCENE_INSET, STREAM_CANVAS.height - size.height)),
  });
  return {
    tasks: place(TASKS_SOURCE, SCENE_INSET),
    timer: place(timer, STREAM_CANVAS.width - SCENE_INSET - timer.width),
  };
}

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
