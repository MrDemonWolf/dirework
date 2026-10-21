// A still of a co-working stream for the viewer landing page: the timer overlay, the task
// list overlay and the chat beside them (`compact` drops the chat, for the claim page), all drawn from `DEMO_SESSION` (the example session
// the docs mocks and share cards render too, so the numbers and bot replies agree
// everywhere). Server-rendered and static: no polling, no client state, no timers.

import { Check } from "lucide-react";

import {
  BRAND,
  DEMO_SESSION,
  SQUIRCLE_RADIUS,
  cycleLabel,
  formatClock,
  roundedRectPath,
  roundedRectPerimeter,
  type DemoTaskStatus,
} from "@dirework/overlay-kit";

import { StatusChip } from "@/components/status-chip";
import { groupTasksByAuthor } from "@/lib/task-utils";
import { cn } from "@/lib/utils";

/** Ring geometry in viewBox units (the box scales with its container). */
const RING_SIZE = 200;
const RING_STROKE = 8;
const RING_INSET = RING_STROKE / 2 + 2;
const RING_SIDE = RING_SIZE - RING_INSET * 2;
const RING_RADIUS = RING_SIZE * SQUIRCLE_RADIUS;
const RING_PATH = roundedRectPath(RING_INSET, RING_INSET, RING_SIDE, RING_SIDE, RING_RADIUS);
const RING_LENGTH = roundedRectPerimeter(RING_SIDE, RING_SIDE, RING_RADIUS);

/** The part of the focus block already spent; the ring fills as the block runs, like the overlay's. */
const ELAPSED = (DEMO_SESSION.phaseMs - DEMO_SESSION.remainingMs) / DEMO_SESSION.phaseMs;

const CLOCK = formatClock(DEMO_SESSION.remainingMs);
const CYCLE = cycleLabel(DEMO_SESSION.cycle.current, DEMO_SESSION.cycle.total);

/**
 * Viewer name colors, given out in order of first appearance across the list and the chat,
 * so a viewer keeps one color in both. Text tokens that clear AA on the card in both themes.
 */
const NAME_TONES = ["text-chart-2", "text-warning", "text-success"] as const;

const speakers: string[] = [];
for (const name of [
  ...DEMO_SESSION.tasks.map((task) => task.author),
  ...DEMO_SESSION.chat.flatMap((line) => (line.kind === "command" ? [line.user] : [])),
]) {
  if (!speakers.includes(name)) speakers.push(name);
}

function nameTone(name: string): string {
  return NAME_TONES[speakers.indexOf(name) % NAME_TONES.length] ?? NAME_TONES[0];
}

const taskGroups = groupTasksByAuthor(
  DEMO_SESSION.tasks.map((task, index) => ({
    id: String(index),
    authorDisplayName: task.author,
    authorColor: null,
    text: task.text,
    status: task.status,
  })),
);
const doneCount = DEMO_SESSION.tasks.filter((task) => task.status === "done").length;

const STATUS_LABEL: Record<DemoTaskStatus, string> = {
  active: "Working on it",
  pending: "Up next",
  done: "Done",
};

function TaskMark({ status }: { status: DemoTaskStatus }) {
  if (status === "done") {
    return (
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Check className="size-3" aria-hidden />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "mt-1 size-2.5 shrink-0 rounded-full",
        status === "active"
          ? "bg-primary ring-4 ring-primary/20"
          : "border border-muted-foreground/60",
      )}
    />
  );
}

/** The squircle timer overlay, frozen at the demo session's mid-block moment. */
function TimerOverlay() {
  return (
    <div
      role="img"
      aria-label={`Timer overlay: ${DEMO_SESSION.phaseLabel}, ${CLOCK} left, ${CYCLE}`}
      className="relative flex aspect-square w-40 shrink-0 items-center justify-center rounded-[22%] bg-card shadow-lg shadow-black/10 sm:w-44 dark:shadow-black/40"
    >
      <svg
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        className="absolute inset-0 size-full"
        aria-hidden
      >
        <path d={RING_PATH} fill="none" strokeWidth={RING_STROKE} className="stroke-border" />
        <path
          d={RING_PATH}
          fill="none"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={RING_LENGTH}
          strokeDashoffset={RING_LENGTH * (1 - ELAPSED)}
          className="stroke-primary"
        />
      </svg>
      <div className="relative text-center">
        <p className="font-heading text-sm font-bold tracking-[0.08em] text-primary uppercase">
          {DEMO_SESSION.phaseLabel}
        </p>
        <p className="font-heading text-4xl leading-tight font-bold tabular-nums sm:text-[2.6rem]">
          {CLOCK}
        </p>
        <p className="text-sm text-muted-foreground">{CYCLE}</p>
      </div>
    </div>
  );
}

/** The task list overlay: viewers' tasks grouped by name, as on stream. */
function TaskListOverlay() {
  return (
    <div className="w-full min-w-0 rounded-xl border border-border bg-card/95 p-4 shadow-lg shadow-black/10 dark:shadow-black/40">
      <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
        <p className="font-heading text-base font-bold">Tasks</p>
        <p className="font-mono text-xs text-muted-foreground tabular-nums">
          {doneCount}/{DEMO_SESSION.tasks.length} done
        </p>
      </div>
      <ul className="mt-3 space-y-3">
        {taskGroups.map((group) => (
          <li key={group.authorKey}>
            <p className={cn("text-sm font-semibold", nameTone(group.authorDisplayName))}>
              {group.authorDisplayName}
            </p>
            <ul className="mt-1 space-y-1.5">
              {group.tasks.map((task) => {
                const status = task.status as DemoTaskStatus;
                return (
                  <li key={task.id} className="flex items-start gap-2.5 text-sm">
                    <TaskMark status={status} />
                    <span className="sr-only">{STATUS_LABEL[status]}: </span>
                    <span
                      className={cn(
                        "min-w-0",
                        status === "done" && "text-muted-foreground line-through",
                      )}
                    >
                      {task.text}
                    </span>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The stream's chat: viewers' commands and the bot's real default replies. */
function ChatStrip() {
  return (
    <div className="flex min-w-0 flex-col border-t border-border lg:border-t-0 lg:border-l">
      <p className="border-b border-border px-4 py-2.5 text-sm font-medium text-muted-foreground">
        Stream chat
      </p>
      <ol className="space-y-2.5 px-4 py-3 text-sm">
        {DEMO_SESSION.chat.map((line) =>
          line.kind === "command" ? (
            <li key={`${line.user}:${line.text}`} className="break-words">
              <span className={cn("font-semibold", nameTone(line.user))}>{line.user}</span>
              <span className="text-muted-foreground">: </span>
              <code className="font-mono text-[0.8125rem]">{line.text}</code>
            </li>
          ) : (
            <li key={`bot:${line.text}`} className="break-words">
              <span className="font-semibold text-primary">{BRAND.name}</span>
              <span className="text-muted-foreground">: {line.text}</span>
            </li>
          ),
        )}
      </ol>
    </div>
  );
}

/**
 * A static co-working stream: overlays on the canvas, chat beside it. `compact` shows the two
 * overlays only (the claim page, where the chat is not the point and the column is narrow).
 */
export function StreamScene({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <figure className={cn("panel-hero", className)}>
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <StatusChip tone="live" size="sm" label="Live" />
        <span className="text-sm text-muted-foreground">Co-working stream</span>
        <StatusChip tone="idle" size="sm" label="Example" className="ml-auto" />
      </div>
      <div className={cn("grid", !compact && "lg:grid-cols-[minmax(0,1fr)_20rem]")}>
        <div className="p-3 sm:p-4">
          <div className="panel-inset bg-grain flex flex-col items-center gap-4 p-4 sm:flex-row sm:items-start sm:p-6">
            <TimerOverlay />
            <TaskListOverlay />
          </div>
        </div>
        {!compact && <ChatStrip />}
      </div>
      <figcaption className="sr-only">
        {compact
          ? "An example co-working stream: the DireWork timer and task list overlays."
          : "An example co-working stream: the DireWork timer and task list overlays, and viewers using chat commands that the bot answers."}
      </figcaption>
    </figure>
  );
}
