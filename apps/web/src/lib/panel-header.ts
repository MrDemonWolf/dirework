// The dashboard panels' one-line header (timer console, task board): a plain `h2` with its
// live state beside it, no eyebrow or subtitle. Shared with their placeholders in
// components/dashboard-skeleton.tsx, so a section filling in keeps the header's height.

/** The header row: one line on desktop, wrapping only when a phone runs out of room. */
export const PANEL_HEADER_CLASS =
  "flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border/40 px-5 py-3";

/** The panel's `h2`. */
export const PANEL_TITLE_CLASS = "font-heading text-lg font-semibold tracking-tight";
