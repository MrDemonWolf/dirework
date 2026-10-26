"use client";

// The task list as the stream sees it, driven entirely by the streamer's TaskStylesConfig.
// Rendered by the OBS task overlay (/overlay/l/[token]) and by the Theme Center live preview,
// so the preview matches the overlay. Style values are interpolated into inline CSS here;
// saved values have passed the allowlist schemas in config-shared (cssColorSchema etc.).

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { limitCombiningMarks } from "@dirework/api/chat-text";
import { clampTaskLines } from "@dirework/api/config-defaults";

import { countDoneByAuthor, groupTasksByAuthor } from "@/lib/task-utils";
import {
  ACTIVE_LABEL_MIN_PX,
  ACTIVE_ROW_TINT_PERCENT,
  AUTHOR_COUNT_OPACITY,
  AUTHOR_HEADER_TINT_PERCENT,
  HEADER_COUNT_OPACITY,
  fitStaticList,
  MORE_FOOTER_OPACITY,
  type StaticListFit,
  TASK_ROW_GAP_PX,
} from "@/lib/overlay-view";
import { colorWithOpacity, quoteFontFamily } from "@/lib/timer-utils";
import type { Task, TaskGroup } from "@/lib/task-utils";
// Style shape comes from the shared config source of truth (audit M4)
import type { TaskStylesConfig } from "@/lib/config-types";
import { OverlayIcon } from "@/components/overlay-icon";

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
      {/* The loop's second copy is decoration: screen readers get the list once. */}
      {shouldScroll && (
        <div
          aria-hidden
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

/**
 * Hide what `fitStaticList` says doesn't fit, straight on the DOM. Only
 * `visibility` and `clip-path` change, and neither affects layout, so the next
 * measurement sees the same boxes (no resize loop) and React's own inline styles
 * are untouched. A group cut after some rows is clipped to end at its last shown
 * row, keeping the card's rounded corners.
 */
function applyStaticListFit(
  groupEls: readonly HTMLElement[],
  rowEls: readonly HTMLElement[][],
  fit: StaticListFit,
  radius: string,
) {
  groupEls.forEach((groupEl, g) => {
    const { visibleRows, clipBottom } = fit.groups[g] ?? { visibleRows: 0, clipBottom: 0 };
    groupEl.style.visibility = visibleRows === 0 ? "hidden" : "";
    groupEl.style.clipPath = clipBottom > 0 ? `inset(0 0 ${clipBottom}px 0 round ${radius})` : "";
    rowEls[g]?.forEach((rowEl, r) => {
      rowEl.style.visibility = r < visibleRows ? "" : "hidden";
    });
  });
}

/**
 * The list when scrolling is off. Only whole rows show: a row that doesn't fit is
 * hidden rather than cut in half, an author header never shows without at least
 * one of its rows, and a "+N more" footer says how many rows are hidden
 * (`fitStaticList`). The footer is overlaid on the bottom of the list area
 * (always laid out, hidden while nothing is cut off) instead of taking layout
 * space, so the area every row is measured against never changes size with it:
 * when the list shrinks back to fit, `hidden` returns to 0. Measured after each
 * render (a render means the poll brought new data) and whenever the area, the
 * rows or the footer resize — never per frame.
 */
function StaticList({ children, config }: { children: React.ReactNode; config: TaskStylesConfig }) {
  const areaRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const radius = config.task.border.radius;

  const measure = useCallback(() => {
    const area = areaRef.current;
    const content = contentRef.current;
    const footer = footerRef.current;
    if (!area || !content || !footer) return;
    // The clip box sits at the area's top edge and is the offsetParent of the
    // groups and their rows, so every edge is measured from the top of the area.
    const groupEls = Array.from(content.querySelectorAll<HTMLElement>("[data-task-group]"));
    const rowEls = groupEls.map((groupEl) =>
      Array.from(groupEl.querySelectorAll<HTMLElement>("[data-task-row]")),
    );
    const fit = fitStaticList(
      groupEls.map((groupEl, g) => ({
        bottom: groupEl.offsetTop + groupEl.offsetHeight,
        rowBottoms: (rowEls[g] ?? []).map((row) => row.offsetTop + row.offsetHeight),
      })),
      area.clientHeight,
      footer.offsetHeight,
    );
    applyStaticListFit(groupEls, rowEls, fit, radius);
    setFooterHeight(footer.offsetHeight);
    setHidden(fit.hidden);
  }, [radius]);

  // New rows arrive as a re-render; a swapped row can leave every size unchanged,
  // so the ResizeObserver alone would miss it. setState bails out on equal values.
  useLayoutEffect(measure);

  useEffect(() => {
    const area = areaRef.current;
    const content = contentRef.current;
    const footer = footerRef.current;
    if (!area || !content || !footer) return;
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    observer.observe(content);
    observer.observe(footer);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <div ref={areaRef} className="relative min-h-0 flex-1 overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 overflow-hidden"
        style={{ bottom: hidden > 0 ? footerHeight : 0 }}
      >
        <div ref={contentRef}>{children}</div>
      </div>
      <div
        ref={footerRef}
        aria-hidden={hidden === 0}
        className="absolute inset-x-0 bottom-0"
        style={{
          visibility: hidden > 0 ? "visible" : "hidden",
          color: config.task.fontColor,
          opacity: MORE_FOOTER_OPACITY,
          fontSize: `calc(${config.task.fontSize} * 0.75)`,
          paddingTop: config.body.padding.vertical,
        }}
      >
        +{hidden} more
      </div>
    </div>
  );
}

/**
 * One task row: checkbox (or bullet), the line-clamped task text, and for the
 * active task a static username-color tint plus an "Active" label (no glow, no
 * pulse: a perpetual animation on a stream overlay is noise).
 */
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
      data-task-row
      className="flex flex-row items-start gap-0"
      style={{
        backgroundColor: isDone
          ? colorWithOpacity(config.taskDone.background.color, config.taskDone.background.opacity)
          : isActive
            ? `color-mix(in srgb, ${config.task.usernameColor} ${ACTIVE_ROW_TINT_PERCENT}%, transparent)`
            : "transparent",
        borderRadius: config.task.border.radius,
        padding: config.task.padding,
        marginBottom: isLast ? 0 : TASK_ROW_GAP_PX,
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
            <OverlayIcon
              icon={config.checkbox.tickIcon}
              size={config.checkbox.tickSize}
              style={{ color: config.checkbox.tickColor }}
            />
          )}
        </div>
      ) : (
        <span
          data-overlay-bullet={config.bullet.icon}
          className="flex flex-shrink-0"
          style={{
            color: config.bullet.color,
            marginTop: config.bullet.margin.top,
            marginLeft: config.bullet.margin.left,
            marginRight: config.bullet.margin.right,
          }}
        >
          <OverlayIcon icon={config.bullet.icon} size={config.bullet.size} />
        </span>
      )}

      {/* Task text: wraps (anywhere, so a URL or a no-space string breaks instead
          of running off the row), ends in an ellipsis after `numberOfLines`, and
          lays out right-to-left on its own when it starts in Arabic or Hebrew. */}
      <span
        data-task-text
        dir="auto"
        style={{
          color: isDone ? config.taskDone.fontColor : config.task.fontColor,
          fontSize: config.task.fontSize,
          display: "-webkit-box",
          WebkitLineClamp: clampTaskLines(config.display.numberOfLines),
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          overflowWrap: "anywhere",
          minWidth: 0,
          textDecoration: isDone && config.display.crossOnDone ? "line-through" : "none",
          // Done → done-colour fades instead of snapping; colour only, so the
          // stream's layout never moves.
          transition: "color 200ms ease",
        }}
      >
        {limitCombiningMarks(task.text)}
      </span>

      {isActive && (
        // Plain visible text, so screen readers announce it as-is (an aria-label
        // on a role-less span is ignored).
        <span
          className="ml-auto shrink-0 self-center font-bold uppercase"
          style={{
            color: config.task.usernameColor,
            fontSize: `max(${ACTIVE_LABEL_MIN_PX}px, calc(${config.task.fontSize} * 0.55))`,
            letterSpacing: "0.1em",
            // Padding, not margin: an inline margin-left would override `ml-auto`,
            // which pushes the label to the end of the row.
            paddingLeft: 12,
            whiteSpace: "nowrap",
          }}
        >
          Active
        </span>
      )}
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
      data-task-group
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
          dir="auto"
          style={{
            color: authorColor,
            fontSize: config.task.fontSize,
          }}
        >
          {limitCombiningMarks(group.authorDisplayName)}
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
          <StaticList config={config}>
            {groups.map((group) => (
              <AuthorGroup key={group.authorKey} group={group} config={config} />
            ))}
          </StaticList>
        )}
      </div>
    </div>
  );
}
