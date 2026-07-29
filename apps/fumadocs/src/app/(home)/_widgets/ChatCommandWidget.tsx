/**
 * Twitch chat preview: viewers issue Dirework commands, the bot replies.
 * Commands are the real ones from content/docs/chat-commands.mdx.
 */

type Line =
  | { kind: "cmd"; user: string; color: string; text: string }
  | { kind: "bot"; text: string };

// Username colors are theme-aware CSS vars (defined in global.css) so they
// clear WCAG AA on both the near-white and near-black chat panel.
const LINES: Line[] = [
  {
    kind: "cmd",
    user: "ada_codes",
    color: "var(--chat-user-1)",
    text: "!task write migration tests",
  },
  { kind: "bot", text: "@ada_codes added task #1 and set it as your focus ✅" },
  {
    kind: "cmd",
    user: "pixel_pat",
    color: "var(--chat-user-2)",
    text: "!task sketch logo concepts",
  },
  { kind: "cmd", user: "ada_codes", color: "var(--chat-user-1)", text: "!done" },
  { kind: "bot", text: "@ada_codes nice — task #1 complete 🎉" },
  { kind: "cmd", user: "night_owl", color: "var(--chat-user-3)", text: "!timer eta" },
  { kind: "bot", text: "Focus ends ~3:42pm · break in 18:24 · cycle 2/4" },
];

export function ChatCommandWidget() {
  return (
    <div className="panel overflow-hidden" aria-label="Twitch chat command preview">
      {/* Channel header bar */}
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{ borderBottom: "1px solid var(--hairline)" }}
      >
        <span
          className="dw-chip-dot animate-led-pulse"
          style={{ background: "var(--color-twitch)" }}
          aria-hidden
        />
        <span className="dw-mono text-[11px] tracking-[0.12em] uppercase dw-text-2">
          #stream chat
        </span>
      </div>

      <div style={{ padding: "1.1rem 1.35rem", display: "flex", flexDirection: "column", gap: 10 }}>
        {LINES.map((l, i) =>
          l.kind === "cmd" ? (
            <div key={i} style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 14 }}>
              <span style={{ fontWeight: 700, color: l.color }}>{l.user}</span>
              <span className="dw-mono dw-text-1">{l.text}</span>
            </div>
          ) : (
            <div key={i} style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 14 }}>
              <span className="dw-text-brand" style={{ fontWeight: 700 }}>
                Dirework
              </span>
              <span className="dw-text-2">{l.text}</span>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
