/**
 * Mock of the Dirework OBS task-list overlay. Tasks grouped by author,
 * each author gets a tinted header row (name + done/total). Mirrors
 * apps/web/src/components/task-list-display.tsx + groupTasksByAuthor().
 */

type Task = { text: string; done: boolean };
type Group = { author: string; color: string; tasks: Task[] };

const GROUPS: Group[] = [
  {
    author: "streamer",
    color: "#bf5af2",
    tasks: [
      { text: "Finish the design system docs", done: false },
      { text: "Review overlay PR", done: true },
    ],
  },
  {
    author: "ada_codes",
    color: "#34c759",
    tasks: [
      { text: "Write migration tests", done: false },
      { text: "Coffee refill", done: true },
    ],
  },
  {
    author: "pixel_pat",
    color: "#0a84ff",
    tasks: [{ text: "Sketch new logo concepts", done: false }],
  },
];

function CheckBox({ done }: { done: boolean }) {
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
        border: `2px solid ${done ? "#34c759" : "#636366"}`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#34c759",
        fontSize: 12,
        lineHeight: 1,
      }}
    >
      {done ? "✔" : ""}
    </span>
  );
}

export function TaskListWidget() {
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
        const first = gi === 0;
        const last = gi === GROUPS.length - 1;
        return (
          <div key={g.author} style={{ marginBottom: gi === GROUPS.length - 1 ? 0 : 10 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(28,28,30,0.95)",
                borderTopLeftRadius: 12,
                borderTopRightRadius: 12,
                padding: "10px 14px",
                fontFamily: "var(--font-display)",
                fontWeight: 600,
              }}
            >
              <span style={{ color: g.color }}>{g.author}</span>
              <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 14 }}>
                {done}/{g.tasks.length}
              </span>
            </div>
            <div
              style={{
                background: "rgba(28,28,30,0.85)",
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
                    background: t.done ? "rgba(28,28,30,0.5)" : "rgba(44,44,46,0.9)",
                    borderRadius: 10,
                    padding: "9px 12px",
                    marginBottom: i === g.tasks.length - 1 ? 0 : 4,
                  }}
                >
                  <CheckBox done={t.done} />
                  <span
                    style={{
                      color: t.done ? "#8e8e93" : "#f5f5f7",
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
