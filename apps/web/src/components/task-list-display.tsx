"use client";

import { useEffect, useRef, useState } from "react";

interface TaskStylesConfig {
  display: {
    showDone: boolean;
    showCount: boolean;
    useCheckboxes: boolean;
    crossOnDone: boolean;
    numberOfLines: number;
  };
  fonts: { header: string; body: string };
  scroll: { pixelsPerSecond: number; gapBetweenLoops: number };
  header: {
    height: string;
    background: { color: string; opacity: number };
    border: { color: string; width: string; radius: string };
    fontSize: string;
    fontColor: string;
    padding: string;
  };
  body: {
    background: { color: string; opacity: number };
    border: { color: string; width: string; radius: string };
    padding: { vertical: string; horizontal: string };
  };
  task: {
    background: { color: string; opacity: number };
    border: { color: string; width: string; radius: string };
    fontSize: string;
    fontColor: string;
    usernameColor: string;
    padding: string;
    marginBottom: string;
    maxWidth: string;
    direction: string;
  };
  taskDone: {
    background: { color: string; opacity: number };
    fontColor: string;
  };
  checkbox: {
    size: string;
    background: { color: string; opacity: number };
    border: { color: string; width: string; radius: string };
    margin: { top: string; left: string; right: string };
    tickChar: string;
    tickSize: string;
    tickColor: string;
  };
  bullet: {
    char: string;
    size: string;
    color: string;
    margin: { top: string; left: string; right: string };
  };
}

interface Task {
  id: string;
  authorDisplayName: string;
  authorColor: string | null;
  text: string;
  status: string;
}

function toHexOpacity(opacity: number): string {
  return Math.round(opacity * 255)
    .toString(16)
    .padStart(2, "0");
}

/**
 * Infinite scroll using a dual-container system like Chat-Task-Tic.
 * When content overflows, both containers animate upward seamlessly.
 */
function InfiniteScroll({
  children,
  pixelsPerSecond = 70,
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
      if (contentHeight > wrapperHeight) {
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
    return () => observer.disconnect();
  }, [children, pixelsPerSecond, gapBetweenLoops]);

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

function TaskItem({
  task,
  config,
}: {
  task: Task;
  config: TaskStylesConfig;
}) {
  const isDone = task.status === "done";
  const isRow = config.task.direction === "row";

  return (
    <div
      className={`flex ${isRow ? "flex-row items-start" : "flex-col"} gap-0`}
      style={{
        backgroundColor: isDone
          ? `${config.taskDone.background.color}${toHexOpacity(config.taskDone.background.opacity)}`
          : `${config.task.background.color}${toHexOpacity(config.task.background.opacity)}`,
        borderRadius: config.task.border.radius,
        borderWidth: config.task.border.width,
        borderColor: config.task.border.color,
        borderStyle: "solid",
        padding: config.task.padding,
        marginBottom: config.task.marginBottom,
        maxWidth: config.task.maxWidth,
        opacity: isDone ? 0.6 : 1,
        transition: "opacity 300ms",
      }}
    >
      {/* Username row with checkbox */}
      <div className="flex flex-row items-center">
        {/* Checkbox or bullet */}
        {config.display.useCheckboxes ? (
          <div
            className="flex flex-shrink-0 items-center justify-center"
            style={{
              width: config.checkbox.size,
              height: config.checkbox.size,
              backgroundColor: `${config.checkbox.background.color}${toHexOpacity(config.checkbox.background.opacity)}`,
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

        {/* Username */}
        <span
          className="truncate font-bold"
          style={{
            color: task.authorColor || config.task.usernameColor || "#ffffff",
            fontSize: config.task.fontSize,
          }}
        >
          {task.authorDisplayName}
        </span>

        {/* Colon separator */}
        <span
          className="mr-1.5 flex-shrink-0"
          style={{
            color: config.task.fontColor,
            fontSize: config.task.fontSize,
            opacity: 0.6,
          }}
        >
          :
        </span>
      </div>

      {/* Task text */}
      <span
        style={{
          color: isDone ? config.taskDone.fontColor : config.task.fontColor,
          fontSize: config.task.fontSize,
          display: "-webkit-box",
          WebkitLineClamp: config.display.numberOfLines,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          textDecoration:
            isDone && config.display.crossOnDone ? "line-through" : "none",
        }}
      >
        {task.text}
      </span>
    </div>
  );
}

export function TaskListDisplay({
  config,
  tasks,
}: {
  config: TaskStylesConfig;
  tasks: Task[];
}) {
  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const doneTasks = tasks.filter((t) => t.status === "done");
  const displayTasks = config.display.showDone
    ? [...pendingTasks, ...doneTasks]
    : pendingTasks;

  return (
    <div
      className="flex h-full w-full flex-col"
      style={{ fontFamily: config.fonts.body }}
    >
      {/* Header */}
      <div
        className="flex flex-shrink-0 items-center justify-between"
        style={{
          height: config.header.height,
          backgroundColor: `${config.header.background.color}${toHexOpacity(config.header.background.opacity)}`,
          borderWidth: config.header.border.width,
          borderStyle: "solid",
          borderColor: config.header.border.color,
          borderRadius: config.header.border.radius,
          padding: config.header.padding,
          fontFamily: config.fonts.header,
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
              opacity: 0.8,
            }}
          >
            {doneTasks.length}/{tasks.length}
          </span>
        )}
      </div>

      {/* Body with task list */}
      <div
        className="flex flex-1 flex-col overflow-hidden"
        style={{
          backgroundColor: `${config.body.background.color}${toHexOpacity(config.body.background.opacity)}`,
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
        ) : (
          <InfiniteScroll
            pixelsPerSecond={config.scroll.pixelsPerSecond}
            gapBetweenLoops={config.scroll.gapBetweenLoops}
          >
            {displayTasks.map((task) => (
              <TaskItem key={task.id} task={task} config={config} />
            ))}
          </InfiniteScroll>
        )}
      </div>
    </div>
  );
}
