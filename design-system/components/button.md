# Button

Calls to action on the marketing/docs surfaces.

## Variants

| Class | Use | Tokens |
|---|---|---|
| `dw-btn dw-btn-primary` | Primary action ("Get Started") | `--brand-500` fill, near-black `#04141f` label |
| `dw-btn dw-btn-secondary` | Inline brand link action | `--brand-600` text (light) / `--brand-500` (dark), brand-tinted border |
| `dw-btn dw-btn-ghost` | Tertiary / neutral | `--bg-surface`, `--txt-1`, `--hairline` |

## Anatomy

- Shape: `--dw-radius-control` (9px).
- Padding: `0.8rem 1.35rem`.
- Type: weight 500, IBM Plex Sans (`--font-body`).
- Press feedback: `scale(0.98)` on `:active`.

## Accessibility

- Always render real `<a>`/`<button>` — never a clickable `<div>`.
- Maintain 4.5:1 contrast: primary uses the near-black label on `--brand-500` (passes in both modes).
- Focus ring inherited from global `:focus-visible` (brand outline).

## Example

```tsx
<Link href="/docs/getting-started" className="dw-btn dw-btn-primary">
  <Rocket className="w-4 h-4" /> Get Started
</Link>
```
