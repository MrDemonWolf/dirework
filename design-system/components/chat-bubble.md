# Chat Bubble (ChatCommandWidget)

Twitch chat preview showing viewers issuing commands and the bot replying. Used on the landing page's Twitch section.

Commands reference: `apps/fumadocs/content/docs/chat-commands.mdx`. Examples: `!task <text>`, `!done`, `!focus <n>`, `!check`, `!timer start`.

## Anatomy

- Row = username (colored) + message text.
- Viewer usernames use Twitch-style accent colors; the bot uses the brand color.
- Commands render in mono (`--ds-font-family-mono`).

## Tokens

- Bot name: `--ds-color-brand-600` (light) / `brand-500` (dark).
- Username sample colors: Twitch palette (`#9146FF`, plus reds/greens/blues).
- Surface: `dw-glass` or `dw-card`.

## Accessibility

- Provide a real transcript order (top → bottom chronological).
- Don't rely on color alone to distinguish bot vs viewer — the bot row is also bold + labeled.
