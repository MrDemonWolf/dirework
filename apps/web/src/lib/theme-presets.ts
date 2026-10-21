// Theme Center presets: full timer + task overlay style trees the owner can apply
// in one click. Preview swatches and username colors must match
// design-system/tokens.json (theme-palette-sync test), and every preset must pass
// the WCAG AA contrast test (theme-contrast test) and the server's input schemas.

import {
  DEFAULT_TASK_STYLES,
  DEFAULT_TIMER_STYLES,
  type ThemePreset,
  type TimerStylesConfig,
  type TaskStylesConfig,
} from "./config-types";
import { isDeepEqual } from "./utils";

/**
 * Timer overlay styles used before the saved config loads and as the "Default"
 * preset: the shipped defaults from @dirework/db/defaults, which a fresh or
 * never-customized instance also gets from the API. Treat as read-only: clone
 * before mutating (as the presets below do).
 */
export const defaultTimerStyles: TimerStylesConfig = DEFAULT_TIMER_STYLES;

/** Task overlay counterpart of `defaultTimerStyles`; also the base `tasks()` merges onto. */
export const defaultTaskStyles: TaskStylesConfig = DEFAULT_TASK_STYLES;

// --- Helper to build a full task styles config quickly ---
function tasks(
  overrides: Partial<TaskStylesConfig> & {
    [K in keyof TaskStylesConfig]?: Partial<TaskStylesConfig[K]>;
  },
): TaskStylesConfig {
  // Deep-clone then shallow-merge each top-level group. Typed as an index map
  // rather than `any` so the dynamic key access below stays checked.
  const base = JSON.parse(JSON.stringify(defaultTaskStyles)) as Record<string, unknown>;
  for (const [k, v] of Object.entries(overrides)) {
    const existing = base[k];
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      existing &&
      typeof existing === "object"
    ) {
      Object.assign(existing, v);
    } else {
      base[k] = v;
    }
  }
  return base as unknown as TaskStylesConfig;
}

/**
 * The six built-in presets, in Theme Center display order. `id` is how
 * `detectMatchingPreset` reports the active one, so keep ids stable.
 */
export const themePresets: ThemePreset[] = [
  // ─── 1. Default (MrDemonWolf midnight blue) ──────────────────────────
  {
    id: "default",
    name: "Default",
    description: "Midnight blue with bright cyan accents",
    preview: { bg: "#091533", accent: "#00aced", text: "#ffffff" },
    // The shipped defaults (a fresh instance matches this preset). Deep-clone so
    // nested objects (ring, header, checkbox…) aren't shared with the exported
    // defaults — same isolation the tasks() helper gives.
    timerStyles: JSON.parse(JSON.stringify(defaultTimerStyles)) as TimerStylesConfig,
    taskStyles: JSON.parse(JSON.stringify(defaultTaskStyles)) as TaskStylesConfig,
  },

  // ─── 2. Ocean Depths (calm navy + teal) ─────────────────────────────
  {
    id: "ocean-depths",
    name: "Ocean Depths",
    description: "Deep navy with teal accents",
    preview: { bg: "#0a1628", accent: "#2dd4bf", text: "#e0f2fe" },
    timerStyles: {
      dimensions: { width: "300px", height: "300px" },
      background: { color: "#0a1628", opacity: 0.92, borderRadius: "22%" },
      ring: {
        enabled: true,
        trackColor: "#2dd4bf",
        trackOpacity: 0.12,
        fillColor: "#2dd4bf",
        fillOpacity: 1,
        width: 14,
        gap: 10,
      },
      text: {
        color: "#e0f2fe",
        outlineColor: "#0a1628",
        outlineSize: "0px",
        fontFamily: "Montserrat",
      },
      fontSizes: { label: "24px", time: "76px", cycle: "20px" },
    },
    taskStyles: tasks({
      header: {
        height: "56px",
        background: { color: "#0c1e3a", opacity: 0.95 },
        border: { color: "#2dd4bf", width: "0px", radius: "12px 12px 0 0" },
        fontSize: "26px",
        fontColor: "#e0f2fe",
        padding: "12px 18px",
      },
      body: {
        background: { color: "#0a1628", opacity: 0.9 },
        border: { color: "#163050", width: "0px", radius: "0 0 12px 12px" },
        padding: { vertical: "8px", horizontal: "8px" },
      },
      task: {
        background: { color: "#0e2240", opacity: 0.92 },
        border: { color: "#1a3a5f", width: "0px", radius: "10px" },
        fontSize: "24px",
        fontColor: "#e0f2fe",
        usernameColor: "#2dd4bf",
        padding: "10px 14px",
        marginBottom: "8px",
        maxWidth: "100%",
      },
      taskDone: { background: { color: "#0a1628", opacity: 0.5 }, fontColor: "#7fa6bf" },
      checkbox: {
        size: "20px",
        background: { color: "#000000", opacity: 0 },
        border: { color: "#2dd4bf", width: "2px", radius: "6px" },
        margin: { top: "4px", left: "2px", right: "8px" },
        tickChar: "✔",
        tickSize: "14px",
        tickColor: "#2dd4bf",
      },
    }),
  },

  // ─── 3. Liquid Glass Dark (macOS Tahoe) ─────────────────────────────
  {
    id: "glass-dark",
    name: "Liquid Glass Dark",
    description: "Translucent dark panels with a frosted-glass look",
    preview: { bg: "#1c1c1e", accent: "#0a84ff", text: "#f5f5f7" },
    timerStyles: {
      dimensions: { width: "300px", height: "300px" },
      background: { color: "#2c2c2e", opacity: 0.86, borderRadius: "22%" },
      ring: {
        enabled: true,
        trackColor: "#48484a",
        trackOpacity: 0.6,
        fillColor: "#0a84ff",
        fillOpacity: 1,
        width: 14,
        gap: 10,
      },
      text: {
        color: "#f5f5f7",
        outlineColor: "#000000",
        outlineSize: "0px",
        fontFamily: "Montserrat",
      },
      fontSizes: { label: "24px", time: "76px", cycle: "20px" },
    },
    taskStyles: tasks({
      fonts: { header: "Montserrat", body: "Roboto" },
      header: {
        height: "56px",
        background: { color: "#2c2c2e", opacity: 0.88 },
        border: { color: "#48484a", width: "0px", radius: "16px 16px 0 0" },
        fontSize: "26px",
        fontColor: "#f5f5f7",
        padding: "12px 18px",
      },
      body: {
        background: { color: "#1c1c1e", opacity: 0.82 },
        border: { color: "#48484a", width: "0px", radius: "0 0 16px 16px" },
        padding: { vertical: "8px", horizontal: "8px" },
      },
      task: {
        background: { color: "#3a3a3c", opacity: 0.7 },
        border: { color: "#48484a", width: "0px", radius: "12px" },
        fontSize: "24px",
        fontColor: "#f5f5f7",
        usernameColor: "#6db3ff",
        padding: "10px 14px",
        marginBottom: "8px",
        maxWidth: "100%",
      },
      taskDone: { background: { color: "#2c2c2e", opacity: 0.4 }, fontColor: "#a1a1a6" },
      checkbox: {
        size: "20px",
        background: { color: "#3a3a3c", opacity: 0.4 },
        border: { color: "#636366", width: "1.5px", radius: "6px" },
        margin: { top: "4px", left: "2px", right: "8px" },
        tickChar: "✔",
        tickSize: "14px",
        tickColor: "#0a84ff",
      },
    }),
  },

  // ─── 4. Cozy Cottage (warm cream + gold) ────────────────────────────
  {
    id: "cozy-cottage",
    name: "Cozy Cottage",
    description: "Warm earth tones on soft cream",
    preview: { bg: "#faf3e8", accent: "#b8860b", text: "#5c3d1a" },
    timerStyles: {
      dimensions: { width: "300px", height: "300px" },
      background: { color: "#faf3e8", opacity: 0.94, borderRadius: "22%" },
      ring: {
        enabled: true,
        trackColor: "#d4b896",
        trackOpacity: 0.3,
        fillColor: "#b8860b",
        fillOpacity: 0.9,
        width: 14,
        gap: 10,
      },
      text: {
        color: "#5c3d1a",
        outlineColor: "#faf3e8",
        outlineSize: "0px",
        fontFamily: "Montserrat",
      },
      fontSizes: { label: "24px", time: "76px", cycle: "20px" },
    },
    taskStyles: tasks({
      fonts: { header: "Montserrat", body: "Roboto" },
      header: {
        height: "56px",
        background: { color: "#faf3e8", opacity: 0.95 },
        border: { color: "#d4a843", width: "0px", radius: "14px 14px 0 0" },
        fontSize: "26px",
        fontColor: "#5c3d1a",
        padding: "12px 18px",
      },
      body: {
        background: { color: "#faf3e8", opacity: 0.92 },
        border: { color: "#e0d0b8", width: "0px", radius: "0 0 14px 14px" },
        padding: { vertical: "8px", horizontal: "8px" },
      },
      task: {
        background: { color: "#fff8ee", opacity: 0.95 },
        border: { color: "#e8d8c0", width: "0px", radius: "10px" },
        fontSize: "24px",
        fontColor: "#5c3d1a",
        usernameColor: "#8a5a00",
        padding: "10px 14px",
        marginBottom: "8px",
        maxWidth: "100%",
      },
      taskDone: { background: { color: "#f0e8d8", opacity: 0.6 }, fontColor: "#6f5c45" },
      checkbox: {
        size: "20px",
        background: { color: "#fff8ee", opacity: 0.5 },
        border: { color: "#d4a843", width: "2px", radius: "6px" },
        margin: { top: "4px", left: "2px", right: "8px" },
        tickChar: "✔",
        tickSize: "14px",
        tickColor: "#b8860b",
      },
    }),
  },

  // ─── 5. Minimal Light (clean white) ─────────────────────────────────
  {
    id: "minimal-light",
    name: "Minimal Light",
    description: "Plain white, easy to read",
    preview: { bg: "#ffffff", accent: "#6366f1", text: "#111827" },
    timerStyles: {
      dimensions: { width: "300px", height: "300px" },
      background: { color: "#ffffff", opacity: 0.96, borderRadius: "22%" },
      ring: {
        enabled: true,
        trackColor: "#e5e7eb",
        trackOpacity: 1,
        fillColor: "#6366f1",
        fillOpacity: 1,
        width: 14,
        gap: 10,
      },
      text: {
        color: "#111827",
        outlineColor: "#ffffff",
        outlineSize: "0px",
        fontFamily: "Montserrat",
      },
      fontSizes: { label: "24px", time: "76px", cycle: "20px" },
    },
    taskStyles: tasks({
      header: {
        height: "56px",
        background: { color: "#ffffff", opacity: 0.98 },
        border: { color: "#e5e7eb", width: "1px", radius: "10px 10px 0 0" },
        fontSize: "26px",
        fontColor: "#111827",
        padding: "12px 18px",
      },
      body: {
        background: { color: "#ffffff", opacity: 0.96 },
        border: { color: "#e5e7eb", width: "1px", radius: "0 0 10px 10px" },
        padding: { vertical: "8px", horizontal: "8px" },
      },
      task: {
        background: { color: "#f9fafb", opacity: 0.98 },
        border: { color: "#e5e7eb", width: "0px", radius: "8px" },
        fontSize: "24px",
        fontColor: "#111827",
        usernameColor: "#4f46e5",
        padding: "10px 14px",
        marginBottom: "8px",
        maxWidth: "100%",
      },
      taskDone: { background: { color: "#f3f4f6", opacity: 0.7 }, fontColor: "#5f6672" },
      checkbox: {
        size: "20px",
        background: { color: "#ffffff", opacity: 1 },
        border: { color: "#d1d5db", width: "2px", radius: "6px" },
        margin: { top: "4px", left: "2px", right: "8px" },
        tickChar: "✔",
        tickSize: "14px",
        tickColor: "#6366f1",
      },
    }),
  },

  // ─── 6. Twitch Purple (brand) ───────────────────────────────────────
  {
    id: "twitch-purple",
    name: "Twitch Purple",
    description: "Twitch purple on dark panels",
    preview: { bg: "#0e0e10", accent: "#9146ff", text: "#efeff1" },
    timerStyles: {
      dimensions: { width: "300px", height: "300px" },
      background: { color: "#0e0e10", opacity: 0.92, borderRadius: "22%" },
      ring: {
        enabled: true,
        trackColor: "#9146ff",
        trackOpacity: 0.15,
        fillColor: "#9146ff",
        fillOpacity: 1,
        width: 14,
        gap: 10,
      },
      text: {
        color: "#efeff1",
        outlineColor: "#0e0e10",
        outlineSize: "0px",
        fontFamily: "Montserrat",
      },
      fontSizes: { label: "24px", time: "76px", cycle: "20px" },
    },
    taskStyles: tasks({
      header: {
        height: "56px",
        background: { color: "#0e0e10", opacity: 0.95 },
        border: { color: "#bf94ff", width: "0px", radius: "12px 12px 0 0" },
        fontSize: "26px",
        fontColor: "#efeff1",
        padding: "12px 18px",
      },
      body: {
        background: { color: "#0e0e10", opacity: 0.92 },
        border: { color: "#1f1f23", width: "0px", radius: "0 0 12px 12px" },
        padding: { vertical: "8px", horizontal: "8px" },
      },
      task: {
        background: { color: "#18181b", opacity: 0.95 },
        border: { color: "#26262c", width: "0px", radius: "10px" },
        fontSize: "24px",
        fontColor: "#efeff1",
        usernameColor: "#bf94ff",
        padding: "10px 14px",
        marginBottom: "8px",
        maxWidth: "100%",
      },
      taskDone: { background: { color: "#0e0e10", opacity: 0.5 }, fontColor: "#8a8a96" },
      checkbox: {
        size: "20px",
        background: { color: "#000000", opacity: 0 },
        border: { color: "#9146ff", width: "2px", radius: "6px" },
        margin: { top: "4px", left: "2px", right: "8px" },
        tickChar: "✔",
        tickSize: "14px",
        tickColor: "#9146ff",
      },
    }),
  },
];

/** The id of the preset these styles exactly match, or null for custom styles. */
export function detectMatchingPreset(
  timerStyles: TimerStylesConfig,
  taskStyles: TaskStylesConfig,
): string | null {
  const match = themePresets.find(
    (preset) =>
      isDeepEqual(preset.timerStyles, timerStyles) && isDeepEqual(preset.taskStyles, taskStyles),
  );
  return match?.id ?? null;
}
