/**
 * Overlay theme gallery. Each swatch renders a theme's bg/accent/text from
 * OVERLAY_THEMES, generated from design-system/tokens.json (overlay.themes).
 */
import { OVERLAY_THEMES, OVERLAY_THEME_NAMES } from "./overlay-themes.generated";

export function ThemeGallery() {
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
      role="list"
      aria-label="Overlay themes"
    >
      {OVERLAY_THEME_NAMES.map((name) => {
        const t = OVERLAY_THEMES[name];
        return (
          <div
            key={name}
            role="listitem"
            className="dw-card-hover"
            style={{
              borderRadius: 16,
              border: "1px solid var(--hairline)",
              overflow: "hidden",
              background: "var(--bg-elev)",
            }}
          >
            <div
              style={{
                background: t.bg,
                padding: "18px 14px",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "26%",
                  border: `3px solid ${t.accent}`,
                  borderRightColor: "transparent",
                  transform: "rotate(-45deg)",
                  flexShrink: 0,
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    color: t.text,
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 14,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  18:24
                </div>
                <div style={{ color: t.username, fontSize: 11, fontWeight: 600 }}>@viewer</div>
              </div>
            </div>
            <div
              className="dw-text-1"
              style={{ padding: "8px 12px", fontSize: 13, fontWeight: 500 }}
            >
              {name}
            </div>
          </div>
        );
      })}
    </div>
  );
}
