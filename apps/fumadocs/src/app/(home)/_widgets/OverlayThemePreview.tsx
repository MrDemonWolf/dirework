"use client";

import { useState } from "react";

import {
  OVERLAY_THEMES,
  OVERLAY_THEME_NAMES,
  DEFAULT_OVERLAY_THEME,
  type OverlayThemeName,
} from "./overlay-themes.generated";
import { TimerOverlayWidget } from "./TimerOverlayWidget";
import { TaskListWidget } from "./TaskListWidget";

/**
 * Interactive theme previewer: the real timer + task overlays inside a mock OBS
 * browser source, restyled live as you pick a preset. Drives both widgets from
 * OVERLAY_THEMES (generated from design-system/tokens.json).
 */
export function OverlayThemePreview() {
  const [name, setName] = useState<OverlayThemeName>(DEFAULT_OVERLAY_THEME);
  const theme = OVERLAY_THEMES[name];

  return (
    <div className="w-full">
      <figure
        className="mx-auto panel-inset overflow-hidden w-full"
        style={{ maxWidth: 520 }}
        aria-label={`Timer and task overlays in the ${name} theme, inside an OBS browser source`}
      >
        <div
          className="px-4 py-2.5 flex items-center gap-2 text-xs dw-mono dw-text-2"
          style={{ borderBottom: "1px solid var(--hairline)" }}
          aria-hidden="true"
        >
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#ff5f57" }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#febc2e" }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#28c840" }} />
          <span className="ml-2">/overlay/t/•••</span>
        </div>
        <div
          className="bg-checker"
          style={{
            padding: "28px 24px",
            display: "flex",
            justifyContent: "center",
            gap: 24,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <TimerOverlayWidget theme={theme} />
          <TaskListWidget theme={theme} />
        </div>
      </figure>

      <div
        role="group"
        aria-label="Preview an overlay theme"
        className="mt-5 flex flex-wrap justify-center gap-2"
      >
        {OVERLAY_THEME_NAMES.map((n) => {
          const t = OVERLAY_THEMES[n];
          const active = n === name;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={active}
              onClick={() => setName(n)}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)]"
              style={{
                borderColor: active ? "var(--brand-500)" : "var(--hairline)",
                background: active ? "var(--brand-50)" : "var(--bg-elev)",
                color: active ? "var(--brand-600)" : "var(--txt-1)",
              }}
            >
              <span
                aria-hidden="true"
                className="rounded-full"
                style={{
                  width: 14,
                  height: 14,
                  background: t.bg,
                  boxShadow: `inset 0 0 0 2px ${t.accent}`,
                  flexShrink: 0,
                }}
              />
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
