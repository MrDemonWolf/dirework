---
source: apps/fumadocs/src/app/(home)/_widgets/ChatCommandWidget.tsx
tokens: [color.scheme, color.partner]
---

# Chat Bubble (ChatCommandWidget)

## Purpose

A mock `#stream chat` panel on the docs landing page: viewers issue DireWork commands and
the bot answers. Static markup, no client JS and no Twitch connection. The exchange is the
shared `DEMO_SESSION` from `@dirework/overlay-kit` (real commands, run by someone allowed
to run them, answered with the bot's real default replies; `demo-session.test.ts` holds
every reply to its template). The web app's viewer landing renders the same session
through `stream-scene`.

## Anatomy

- `panel` section with a header bar: a Twitch-purple dot and `#stream chat` in mono.
- One row per line, top to bottom in chronological order:
  - **Command**: speaker name (bold, `--chat-user-1..3` by first appearance) and the
    command in mono (`dw-mono dw-text-1`).
  - **Bot reply**: `BRAND.name` in the brand color (bold) and the reply in `dw-text-2`.

## Props and variants

`ChatCommandWidget()` takes no props and has no variants; edit `DEMO_SESSION` to change
the exchange.

## States

Static: one rendering, the same in light and dark (the speaker colors flip per theme in
`global.css` so each clears AA on the panel).

## Accessibility

- The section is labelled "Twitch chat command preview".
- Bot and viewer rows differ by name and weight, not by color alone.
- The header dot is `aria-hidden`.

## Do / Don't

- **Do** change the conversation in `DEMO_SESSION`, so the docs mock, the viewer landing
  and the share cards stay one story.
- **Don't** invent bot replies here; they must be the real defaults.
- **Don't** use Twitch purple beyond the channel dot.
