# Pill

Compact metadata chip / trust badge ("Open source · MIT", "Self-hosted").

## Anatomy

- Shape: `--ds-radius-pill`.
- Padding: `0.4rem 0.9rem`.
- Background: `--ds-color-surface-surface`.
- Text: `--ds-color-text-secondary`, `--ds-font-size-sm`, medium weight.
- Optional leading icon, `0.4rem` gap.

## Accessibility

- Decorative icons get `aria-hidden`.
- If a pill is a link, give it a descriptive `aria-label`.

## Example

```tsx
<span className="dw-pill"><Github className="w-3 h-3" /> Open source · MIT</span>
```
