# Card

General content container for feature grids, comparison tables, and dev sections.

## Anatomy

- Background: set per use (typically `--bg-surface` or `--bg-elev`).
- Radius: `1.25rem`.
- Padding: `2rem`.
- `dw-card-hover` adds a `translateY(-2px)` lift on hover.

## Tokens

`--hairline` (border), `--brand-500` (hover border tint and lift shadow).

## Accessibility

- If the whole card is a link, wrap content in a single `<a>`/`<Link>` and give it an accessible label via the heading.
- Don't nest interactive elements inside a card-level link.

## Example

```tsx
<div className="dw-card dw-card-hover">
  <h3 className="dw-display dw-text-1 text-xl mb-2">Pomodoro Timer</h3>
  <p className="dw-text-2 text-base leading-relaxed">Work, break, long break…</p>
</div>
```
