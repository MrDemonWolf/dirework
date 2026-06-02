# Button

Calls to action on the marketing/docs surfaces.

## Variants

| Class | Use | Tokens |
|---|---|---|
| `dw-btn dw-btn-primary` | Primary action ("Get Started") | `--ds-color-brand-500/600`, white text |
| `dw-btn dw-btn-secondary` | Inline brand link action | `--ds-color-brand-500` |
| `dw-btn dw-btn-ghost` | Tertiary / neutral | `--ds-color-surface-surface`, `--ds-color-text-primary` |

## Anatomy

- Shape: `--ds-radius-pill` (fully rounded).
- Padding: `0.85rem 1.4rem`.
- Type: `--ds-font-weight-medium`, Roboto.
- Press feedback: `scale(0.98)` on `:active`.

## Accessibility

- Always render real `<a>`/`<button>` — never a clickable `<div>`.
- Maintain 4.5:1 contrast: primary uses white on brand-500/600 (passes in both modes).
- Focus ring inherited from global `:focus-visible` (brand outline).

## Example

```tsx
<Link href="/docs/getting-started" className="dw-btn dw-btn-primary">
  <Rocket className="w-4 h-4" /> Get Started
</Link>
```
