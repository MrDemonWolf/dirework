# Glass Card

Frosted, translucent surface used for hero product mocks and "premium" feature cards. Evokes the Liquid Glass overlay theme.

## Anatomy

- Background: `color-mix(--ds-color-surface-elev 65%, transparent)`.
- Backdrop: `saturate(180%) blur(30px)`.
- Border: 1px hairline at 80% opacity.
- Radius: `1.25rem`.
- Inner top highlight via `::before` gradient.

## Tokens

`--ds-color-surface-elev`, `--ds-color-surface-hairline`, `--ds-shadow-lg`.

## Accessibility

- Backdrop blur is decorative — ensure text contrast holds against the *worst-case* background behind the card.
- Provide a solid fallback color for browsers without `backdrop-filter`.

## Example

```tsx
<div className="dw-card dw-glass">…</div>
```
