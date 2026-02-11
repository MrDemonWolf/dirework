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
  scroll: { enabled: boolean; pixelsPerSecond: number; gapBetweenLoops: number };
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
  authorTwitchId?: string;
  authorDisplayName: string;
  authorColor: string | null;
  text: string;
  status: string;
}

interface TaskGroup {
  authorKey: string;
  authorDisplayName: string;
  authorColor: string | null;
  pending: number;
  done: number;
  tasks: Task[];
}

function groupTasksByAuthor(tasks: Task[]): TaskGroup[] {
  const groups = new Map<string, TaskGroup>();
  for (const task of tasks) {
    const key = task.authorTwitchId || task.authorDisplayName;
    let group = groups.get(key);
    if (!group) {
      group = {
        authorKey: key,
        authorDisplayName: task.authorDisplayName,
        authorColor: task.authorColor,
        pending: 0,
        done: 0,
        tasks: [],
      };
      groups.set(key, group);
    }
    if (task.status === "done") group.done++;
    else group.pending++;
    group.tasks.push(task);
  }
  return Array.from(groups.values());
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
  isLast,
}: {
  task: Task;
  config: TaskStylesConfig;
  isLast: boolean;
}) {
  const isDone = task.status === "done";

  return (
    <div
      className="flex flex-row items-start gap-0"
      style={{
        backgroundColor: isDone
          ? `${config.taskDone.background.color}${toHexOpacity(config.taskDone.background.opacity)}`
          : "transparent",
        padding: config.task.padding,
        marginBottom: isLast ? "0" : "1px",
        maxWidth: config.task.maxWidth,
        opacity: isDone ? 0.6 : 1,
        transition: "opacity 300ms",
      }}
    >
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

function AuthorGroup({
  group,
  config,
}: {
  group: TaskGroup;
  config: TaskStylesConfig;
}) {
  const authorColor = group.authorColor || config.task.usernameColor || "#ffffff";

  return (
    <div
      style={{
        backgroundColor: `${config.task.background.color}${toHexOpacity(config.task.background.opacity)}`,
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
          backgroundColor: `${authorColor}10`,
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
            opacity: 0.7,
            whiteSpace: "nowrap",
            marginLeft: "8px",
          }}
        >
          {group.done}/{group.tasks.length}
        </span>
      </div>

      {/* Tasks */}
      {group.tasks.map((task, i) => (
        <TaskItem
          key={task.id}
          task={task}
          config={config}
          isLast={i === group.tasks.length - 1}
        />
      ))}
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
  const displayTasks = config.display.showDone
    ? tasks
    : tasks.filter((t) => t.status === "pending");
  const groups = groupTasksByAuthor(displayTasks);
  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const doneTasks = tasks.filter((t) => t.status === "done");

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
