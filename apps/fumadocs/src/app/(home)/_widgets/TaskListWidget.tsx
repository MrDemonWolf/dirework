/**
 * Mock of the Dirework OBS task-list overlay. Tasks grouped by author,
 * each author gets a tinted header row (name + done/total). Mirrors
 * apps/web/src/components/task-list-display.tsx + groupTasksByAuthor().
 */

import { OVERLAY_THEMES, DEFAULT_OVERLAY_THEME, type OverlayTheme } from "./overlay-themes.generated";
import { authorPalette, hexToRgba } from "./theme-util";

type Task = { text: string; done: boolean };
type Group = { author: string; tasks: Task[] };

const GROUPS: Group[] = [
  {
    author: "streamer",
    tasks: [
      { text: "Finish the design system docs", done: false },
      { text: "Review overlay PR", done: true },
    ],
  },
  {
    author: "ada_codes",
    tasks: [
      { text: "Write migration tests", done: false },
      { text: "Coffee refill", done: true },
    ],
  },
  {
    author: "pixel_pat",
    tasks: [{ text: "Sketch new logo concepts", done: false }],
  },
];

function CheckBox({ done, theme }: { done: boolean; theme: OverlayTheme }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 20,
        height: 20,
        flexShrink: 0,
        marginTop: 2,
        marginRight: 8,
        borderRadius: 6,
        border: `2px solid ${done ? theme.accent : hexToRgba(theme.text, 0.4)}`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: theme.accent,
        fontSize: 12,
        lineHeight: 1,
      }}
    >
      {done ? "✔" : ""}
    </span>
  );
}

export function TaskListWidget({
  theme = OVERLAY_THEMES[DEFAULT_OVERLAY_THEME],
}: {
  theme?: OverlayTheme;
}) {
  return (
    <div
      role="img"
      aria-label="Task list overlay grouped by viewer"
      style={{
        width: 300,
        fontFamily: "var(--font-body)",
        userSelect: "none",
        filter: "drop-shadow(0 24px 48px rgba(0,0,0,0.45))",
      }}
    >
      {GROUPS.map((g, gi) => {
        const done = g.tasks.filter((t) => t.done).length;
        const authorColor = authorPalette(theme.bg)[gi % 3];
        return (
          <div key={g.author} style={{ marginBottom: gi === GROUPS.length - 1 ? 0 : 10 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: hexToRgba(theme.bg, 0.95),
                borderTopLeftRadius: 12,
                borderTopRightRadius: 12,
                padding: "10px 14px",
                fontFamily: "var(--font-display)",
                fontWeight: 600,
              }}
            >
              <span style={{ color: authorColor }}>{g.author}</span>
              <span style={{ color: hexToRgba(theme.text, 0.55), fontSize: 14 }}>
                {done}/{g.tasks.length}
              </span>
            </div>
            <div
              style={{
                background: hexToRgba(theme.bg, 0.85),
                borderBottomLeftRadius: 12,
                borderBottomRightRadius: 12,
                padding: 6,
              }}
            >
              {g.tasks.map((t, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    background: t.done ? hexToRgba(theme.text, 0.04) : hexToRgba(theme.text, 0.08),
                    borderRadius: 10,
                    padding: "9px 12px",
                    marginBottom: i === g.tasks.length - 1 ? 0 : 4,
                  }}
                >
                  <CheckBox done={t.done} theme={theme} />
                  <span
                    style={{
                      color: t.done ? hexToRgba(theme.text, 0.5) : theme.text,
                      fontSize: 15,
                      textDecoration: t.done ? "line-through" : "none",
                      lineHeight: 1.35,
                    }}
                  >
                    {t.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
