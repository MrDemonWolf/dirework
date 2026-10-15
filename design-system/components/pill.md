# Pill

Compact metadata chip / trust badge ("Open source · MIT", "Self-hosted").

## Anatomy

- Shape: `--dw-radius-control` (9px).
- Padding: `0.4rem 0.85rem`.
- Background: `--bg-surface` at 55%, `--hairline` border.
- Text: `--txt-2`, `0.8rem`, medium weight; icons in `--brand-500`.
- Optional leading icon, `0.4rem` gap.

## Accessibility

- Decorative icons get `aria-hidden`.
- If a pill is a link, give it a descriptive `aria-label`.

## Example

```tsx
<span className="dw-pill"><Github className="w-3 h-3" /> Open source · MIT</span>
```
