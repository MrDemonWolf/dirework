/**
 * Mock of the DireWork OBS task-list overlay. Tasks grouped by author,
 * each author gets a tinted header row (name + done/total). Mirrors
 * apps/web/src/components/task-list-display.tsx + groupTasksByAuthor().
 * Sample data is the shared DEMO_SESSION from @dirework/overlay-kit, so the
 * list agrees with the hero scene, chat preview and share cards; restyled
 * per theme by OverlayThemePreview.
 */

import { DEMO_SESSION, type DemoTask } from "@dirework/overlay-kit";

import {
  OVERLAY_THEMES,
  DEFAULT_OVERLAY_THEME,
  type OverlayTheme,
} from "./overlay-themes.generated";
import { authorPalette, hexToRgba } from "./theme-util";

type Group = { author: string; tasks: DemoTask[] };

/** DEMO_SESSION's tasks grouped by author, in first-appearance order (as the overlay does). */
const GROUPS: Group[] = (() => {
  const byAuthor = new Map<string, DemoTask[]>();
  for (const task of DEMO_SESSION.tasks) {
    const list = byAuthor.get(task.author);
    if (list) list.push(task);
    else byAuthor.set(task.author, [task]);
  }
  return [...byAuthor].map(([author, tasks]) => ({ author, tasks }));
})();

/** Decorative checkbox (aria-hidden); the row's strikethrough text carries the done state. */
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

/**
 * Task-list overlay mock. Exposed as a single `role="img"` with a summary label, so screen
 * readers get one description rather than every sample task. Defaults to the Default theme.
 */
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
        maxWidth: "100%",
        fontFamily: "var(--font-body)",
        userSelect: "none",
        filter: "drop-shadow(0 24px 48px rgba(0,0,0,0.45))",
      }}
    >
      {GROUPS.map((g, gi) => {
        const done = g.tasks.filter((t) => t.status === "done").length;
        // Palette picks AA-safe name colors for light vs dark theme backgrounds; it has
        // three entries, so groups cycle through them.
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
                // Montserrat is loaded at 700/800 only (see app/layout.tsx).
                fontWeight: 700,
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
              {g.tasks.map((t, i) => {
                const isDone = t.status === "done";
                const isActive = t.status === "active";
                return (
                  <div
                    key={t.text}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      background: isDone
                        ? hexToRgba(theme.text, 0.04)
                        : hexToRgba(theme.text, isActive ? 0.12 : 0.08),
                      // Accent edge marks the task the viewer is working on right now.
                      boxShadow: isActive ? `inset 3px 0 0 ${theme.accent}` : undefined,
                      borderRadius: 10,
                      padding: "9px 12px",
                      marginBottom: i === g.tasks.length - 1 ? 0 : 4,
                    }}
                  >
                    <CheckBox done={isDone} theme={theme} />
                    <span
                      style={{
                        color: isDone ? hexToRgba(theme.text, 0.5) : theme.text,
                        fontSize: 15,
                        textDecoration: isDone ? "line-through" : "none",
                        lineHeight: 1.35,
                      }}
                    >
                      {t.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
