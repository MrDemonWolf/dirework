"use client";

// The task list as the stream sees it, driven entirely by the streamer's TaskStylesConfig.
// Rendered by the OBS task overlay (/overlay/l/[token]) and by the Theme Center live preview,
// so the preview matches the overlay. Style values are interpolated into inline CSS here;
// saved values have passed the allowlist schemas in config-shared (cssColorSchema etc.).

import { useEffect, useRef, useState } from "react";

import { countDoneByAuthor, groupTasksByAuthor } from "@/lib/task-utils";
import {
  AUTHOR_COUNT_OPACITY,
  AUTHOR_HEADER_TINT_PERCENT,
  HEADER_COUNT_OPACITY,
} from "@/lib/overlay-view";
import { colorWithOpacity, quoteFontFamily } from "@/lib/timer-utils";
import { cn } from "@/lib/utils";
import type { Task, TaskGroup } from "@/lib/task-utils";
// Style shape comes from the shared config source of truth (audit M4)
import type { TaskStylesConfig } from "@/lib/config-types";

/**
 * Infinite scroll using a dual-container system like Chat-Task-Tic.
 * When content overflows, both containers animate upward seamlessly.
 * The children render twice: the second copy is absolutely positioned
 * (`.animate-scroll-secondary` in index.css) and trails the first by
 * `gapBetweenLoops`, so the loop has no visible jump. The duration is derived
 * from content height so the speed stays `pixelsPerSecond` however long the list is.
 */
function InfiniteScroll({
  children,
  pixelsPerSecond = 40,
  gapBetweenLoops = 100,
}: {
  children: React.ReactNode;
  pixelsPerSecond?: number;
  gapBetweenLoops?: number;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLDivElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const primary = primaryRef.current;
    if (!wrapper || !primary) return;

    const check = () => {
      const contentHeight = primary.scrollHeight;
      const wrapperHeight = wrapper.clientHeight;
      // A non-positive speed has no finite duration ("Infinitys"), which would
      // leave the second copy stacked on the first — just don't scroll.
      if (pixelsPerSecond > 0 && contentHeight > wrapperHeight) {
        setShouldScroll(true);
        const totalDistance = contentHeight + gapBetweenLoops;
        setDuration(totalDistance / pixelsPerSecond);
      } else {
        setShouldScroll(false);
      }
    };

    check();
    const observer = new ResizeObserver(check);
    observer.observe(primary);
    // The wrapper resizes independently (OBS source size, header/padding edits).
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [pixelsPerSecond, gapBetweenLoops]);

  return (
    <div ref={wrapperRef} className="relative flex-1 overflow-hidden">
      <div
        ref={primaryRef}
        className={shouldScroll ? "animate-scroll-primary" : ""}
        style={
          shouldScroll
            ? ({
                "--scroll-duration": `${duration}s`,
                "--scroll-gap": `${gapBetweenLoops}px`,
              } as React.CSSProperties)
            : undefined
        }
      >
        {children}
      </div>
      {shouldScroll && (
        <div
          className="animate-scroll-secondary"
          style={
            {
              "--scroll-duration": `${duration}s`,
              "--scroll-gap": `${gapBetweenLoops}px`,
            } as React.CSSProperties
          }
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** One task row: checkbox (or bullet) plus the line-clamped task text. */
function TaskItem({
  task,
  config,
  isLast,
}: {
  task: Task;
  config: TaskStylesConfig;
  isLast: boolean;
}) {
  const isDone = task.status === "done";
  const isActive = task.status === "active";

  return (
    <div
      className={cn("flex flex-row items-start gap-0", isActive && "overlay-active-glow")}
      style={{
        backgroundColor: isDone
          ? colorWithOpacity(config.taskDone.background.color, config.taskDone.background.opacity)
          : "transparent",
        padding: config.task.padding,
        marginBottom: isLast ? "0" : "1px",
        maxWidth: config.task.maxWidth,
        // No extra row-wide fade for done rows: it multiplied over the
        // configured `taskDone.fontColor`, so the color the streamer picked (and
        // the presets' contrast-checked one) never rendered as chosen.
        transition: "background-color 300ms",
      }}
    >
      {/* Checkbox or bullet */}
      {config.display.useCheckboxes ? (
        <div
          className="flex flex-shrink-0 items-center justify-center"
          style={{
            width: config.checkbox.size,
            height: config.checkbox.size,
            backgroundColor: colorWithOpacity(
              config.checkbox.background.color,
              config.checkbox.background.opacity,
            ),
            borderWidth: config.checkbox.border.width,
            borderStyle: "solid",
            borderColor: isDone ? config.checkbox.tickColor : config.checkbox.border.color,
            borderRadius: config.checkbox.border.radius,
            marginTop: config.checkbox.margin.top,
            marginLeft: config.checkbox.margin.left,
            marginRight: config.checkbox.margin.right,
          }}
        >
          {isDone && (
            <span
              style={{
                fontSize: config.checkbox.tickSize,
                color: config.checkbox.tickColor,
                lineHeight: 1,
              }}
            >
              {config.checkbox.tickChar}
            </span>
          )}
        </div>
      ) : (
        <span
          className="flex-shrink-0"
          style={{
            fontSize: config.bullet.size,
            color: config.bullet.color,
            marginTop: config.bullet.margin.top,
            marginLeft: config.bullet.margin.left,
            marginRight: config.bullet.margin.right,
            lineHeight: 1,
          }}
        >
          {config.bullet.char}
        </span>
      )}

      {/* Task text */}
      <span
        style={{
          color: isDone ? config.taskDone.fontColor : config.task.fontColor,
          fontSize: config.task.fontSize,
          display: "-webkit-box",
          WebkitLineClamp: config.display.numberOfLines,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          textDecoration: isDone && config.display.crossOnDone ? "line-through" : "none",
        }}
      >
        {task.text}
      </span>
    </div>
  );
}

/**
 * One author's card: a header tinted with the author's chat color, their done/total count,
 * then their rows. On the overlay `group.done` comes from server totals, so it can exceed the
 * done rows actually shown.
 */
function AuthorGroup({ group, config }: { group: TaskGroup; config: TaskStylesConfig }) {
  // Twitch chat color first, then the configured username color, then white.
  const authorColor = group.authorColor || config.task.usernameColor || "#ffffff";

  return (
    <div
      style={{
        backgroundColor: colorWithOpacity(
          config.task.background.color,
          config.task.background.opacity,
        ),
        borderRadius: config.task.border.radius,
        borderWidth: config.task.border.width,
        borderColor: config.task.border.color,
        borderStyle: "solid",
        overflow: "hidden",
        marginBottom: config.task.marginBottom,
        maxWidth: config.task.maxWidth,
      }}
    >
      {/* Author header */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: config.task.padding,
          borderBottom: `${config.task.border.width} solid ${config.task.border.color}`,
          backgroundColor: `color-mix(in srgb, ${authorColor} ${AUTHOR_HEADER_TINT_PERCENT}%, transparent)`,
        }}
      >
        <span
          className="truncate font-bold"
          style={{
            color: authorColor,
            fontSize: config.task.fontSize,
          }}
        >
          {group.authorDisplayName}
        </span>
        <span
          style={{
            color: config.task.fontColor,
            fontSize: `calc(${config.task.fontSize} * 0.75)`,
            opacity: AUTHOR_COUNT_OPACITY,
            whiteSpace: "nowrap",
            marginLeft: "8px",
          }}
        >
          {group.done}/{group.pending + group.done}
        </span>
      </div>

      {/* Tasks */}
      {group.tasks.map((task, i) => (
        <TaskItem key={task.id} task={task} config={config} isLast={i === group.tasks.length - 1} />
      ))}
    </div>
  );
}

/**
 * Full task list (header with done/total counter + author-grouped body). Pure presentation:
 * it does no fetching, so the overlay page owns polling and the preview passes mock tasks.
 */
export function TaskListDisplay({
  config,
  tasks,
  counts,
}: {
  config: TaskStylesConfig;
  tasks: Task[];
  /**
   * Server-side totals. The server returns only the newest done tasks (and
   * none when showDone is off), so the header counter must come from these,
   * not from `tasks`. Omitted for local previews, which count `tasks`.
   */
  counts?: { open: number; done: number; doneByAuthor: Record<string, number> };
}) {
  const displayTasks = config.display.showDone ? tasks : tasks.filter((t) => t.status !== "done");
  // Per-author done totals come from the server too (or, for a local preview,
  // from the full list) so hiding done rows doesn't zero the group headers.
  const groups = groupTasksByAuthor(displayTasks, counts?.doneByAuthor ?? countDoneByAuthor(tasks));
  const doneCount = counts?.done ?? tasks.filter((t) => t.status === "done").length;
  const totalCount = counts ? counts.open + counts.done : tasks.length;

  return (
    <div
      className="flex h-full w-full flex-col"
      style={{ fontFamily: quoteFontFamily(config.fonts.body) }}
    >
      {/* Header */}
      <div
        className="flex flex-shrink-0 items-center justify-between"
        style={{
          height: config.header.height,
          backgroundColor: colorWithOpacity(
            config.header.background.color,
            config.header.background.opacity,
          ),
          borderWidth: config.header.border.width,
          borderStyle: "solid",
          borderColor: config.header.border.color,
          borderRadius: config.header.border.radius,
          padding: config.header.padding,
          fontFamily: quoteFontFamily(config.fonts.header),
        }}
      >
        <span
          className="font-bold"
          style={{
            fontSize: config.header.fontSize,
            color: config.header.fontColor,
          }}
        >
          Tasks
        </span>
        {config.display.showCount && (
          <span
            style={{
              fontSize: config.header.fontSize,
              color: config.header.fontColor,
              opacity: HEADER_COUNT_OPACITY,
            }}
          >
            {doneCount}/{totalCount}
          </span>
        )}
      </div>

      {/* Body with task list */}
      <div
        className="flex flex-1 flex-col overflow-hidden"
        style={{
          backgroundColor: colorWithOpacity(
            config.body.background.color,
            config.body.background.opacity,
          ),
          borderWidth: config.body.border.width,
          borderStyle: "solid",
          borderColor: config.body.border.color,
          borderRadius: config.body.border.radius,
          paddingTop: config.body.padding.vertical,
          paddingBottom: config.body.padding.vertical,
          paddingLeft: config.body.padding.horizontal,
          paddingRight: config.body.padding.horizontal,
        }}
      >
        {displayTasks.length === 0 ? (
          <div
            className="flex flex-1 items-center justify-center"
            style={{ color: config.task.fontColor, opacity: 0.4 }}
          >
            <p style={{ fontSize: config.task.fontSize }}>No tasks yet</p>
          </div>
        ) : config.scroll.enabled ? (
          <InfiniteScroll
            pixelsPerSecond={config.scroll.pixelsPerSecond}
            gapBetweenLoops={config.scroll.gapBetweenLoops}
          >
            {groups.map((group) => (
              <AuthorGroup key={group.authorKey} group={group} config={config} />
            ))}
          </InfiniteScroll>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {groups.map((group) => (
              <AuthorGroup key={group.authorKey} group={group} config={config} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
