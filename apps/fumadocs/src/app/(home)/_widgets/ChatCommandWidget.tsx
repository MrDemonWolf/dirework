/**
 * Twitch chat preview for the marketing home page: viewers issue DireWork commands, the bot
 * replies. Static markup (no client JS, no Twitch connection). The exchange is the shared
 * DEMO_SESSION from @dirework/overlay-kit: real commands, issued by someone allowed to run them
 * (`!timer` is broadcaster/mod only), answered with the bot's real default replies — apps/web's
 * demo-session test holds every reply to the default template it names.
 */

import { BRAND, DEMO_SESSION } from "@dirework/overlay-kit";

// Username colors are theme-aware CSS vars (defined in global.css) so they clear WCAG AA on
// both the near-white and near-black chat panel. Speakers take them in first-appearance order.
const USER_COLORS = ["var(--chat-user-1)", "var(--chat-user-2)", "var(--chat-user-3)"];

const speakers: string[] = [];
for (const line of DEMO_SESSION.chat) {
  if (line.kind === "command" && !speakers.includes(line.user)) speakers.push(line.user);
}

function userColor(user: string): string {
  return USER_COLORS[speakers.indexOf(user) % USER_COLORS.length] ?? USER_COLORS[0];
}

/** Mock `#stream chat` panel rendering the demo session's chat exchange. */
export function ChatCommandWidget() {
  return (
    <section className="panel overflow-hidden" aria-label="Twitch chat command preview">
      {/* Channel header bar */}
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{ borderBottom: "1px solid var(--hairline)" }}
      >
        <span className="dw-chip-dot" style={{ background: "var(--color-twitch)" }} aria-hidden />
        <span className="dw-mono text-xs tracking-[0.12em] uppercase dw-text-2">#stream chat</span>
      </div>

      <div style={{ padding: "1.1rem 1.35rem", display: "flex", flexDirection: "column", gap: 10 }}>
        {DEMO_SESSION.chat.map((l) =>
          l.kind === "command" ? (
            <div
              key={`${l.user}:${l.text}`}
              style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 14 }}
            >
              <span style={{ fontWeight: 700, color: userColor(l.user) }}>{l.user}</span>
              <span className="dw-mono dw-text-1">{l.text}</span>
            </div>
          ) : (
            <div
              key={`bot:${l.text}`}
              style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 14 }}
            >
              <span className="dw-text-brand" style={{ fontWeight: 700 }}>
                {BRAND.name}
              </span>
              <span className="dw-text-2">{l.text}</span>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
