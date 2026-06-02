/**
 * Twitch chat preview: viewers issue Dirework commands, the bot replies.
 * Commands are the real ones from content/docs/chat-commands.mdx.
 */

type Line =
  | { kind: "cmd"; user: string; color: string; text: string }
  | { kind: "bot"; text: string };

const LINES: Line[] = [
  { kind: "cmd", user: "ada_codes", color: "#34c759", text: "!task write migration tests" },
  { kind: "bot", text: "@ada_codes added task #1 and set it as your focus ✅" },
  { kind: "cmd", user: "pixel_pat", color: "#0a84ff", text: "!task sketch logo concepts" },
  { kind: "cmd", user: "ada_codes", color: "#34c759", text: "!done" },
  { kind: "bot", text: "@ada_codes nice — task #1 complete 🎉" },
  { kind: "cmd", user: "night_owl", color: "#ff6b35", text: "!timer eta" },
  { kind: "bot", text: "Focus ends ~3:42pm · break in 18:24 · cycle 2/4" },
];

export function ChatCommandWidget() {
  return (
    <div
      className="dw-card dw-glass"
      style={{ padding: "1.25rem 1.4rem" }}
      aria-label="Twitch chat command preview"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
