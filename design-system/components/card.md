# Card

General content container for feature grids, comparison tables, and dev sections.

## Anatomy

- Background: `--ds-color-surface-surface`.
- Radius: `1.25rem` (≈ `--ds-radius-xl`).
- Padding: `--ds-space-7` (2rem).
- `dw-card-hover` adds a `translateY(-2px)` lift on hover.

## Tokens

`--ds-color-surface-surface`, `--ds-color-surface-hairline` (border), `--ds-shadow-md` (hover lift).

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
