import type { ThemePreset, TimerStylesConfig, TaskStylesConfig } from "./config-types";

export const defaultTimerStyles: TimerStylesConfig = {
  dimensions: { width: "250px", height: "250px" },
  background: { color: "#091533", opacity: 0.85, borderRadius: "22%" },
  ring: {
    enabled: true,
    trackColor: "#ffffff",
    trackOpacity: 0.1,
    fillColor: "#00aced",
    fillOpacity: 1,
    width: 8,
    gap: 6,
  },
  text: { color: "#ffffff", outlineColor: "#000000", outlineSize: "0px", fontFamily: "Montserrat" },
  fontSizes: { label: "18px", time: "48px", cycle: "16px" },
};

export const defaultTaskStyles: TaskStylesConfig = {
  display: {
    showDone: true,
    showCount: true,
    useCheckboxes: true,
    crossOnDone: true,
    numberOfLines: 2,
  },
  fonts: { header: "Montserrat", body: "Roboto" },
  scroll: { enabled: true, pixelsPerSecond: 70, gapBetweenLoops: 100 },
  header: {
    height: "52px",
    background: { color: "#091533", opacity: 0.95 },
    border: { color: "#1b2b52", width: "1px", radius: "12px 12px 0 0" },
    fontSize: "24px",
    fontColor: "#ffffff",
    padding: "12px 16px",
  },
  body: {
    background: { color: "#091533", opacity: 0.85 },
    border: { color: "#1b2b52", width: "1px", radius: "0 0 12px 12px" },
    padding: { vertical: "6px", horizontal: "6px" },
  },
  task: {
    background: { color: "#12244a", opacity: 0.9 },
    border: { color: "#1b2b52", width: "0px", radius: "10px" },
    fontSize: "22px",
    fontColor: "#eaf2ff",
    usernameColor: "#6b8bf5",
    padding: "10px 14px",
    marginBottom: "4px",
    maxWidth: "100%",
  },
  taskDone: {
    background: { color: "#091533", opacity: 0.5 },
    fontColor: "#7c8db0",
  },
  checkbox: {
    size: "20px",
    background: { color: "#000000", opacity: 0 },
    border: { color: "#4a5b82", width: "2px", radius: "6px" },
    margin: { top: "4px", left: "2px", right: "8px" },
    tickChar: "✔",
    tickSize: "14px",
    tickColor: "#00aced",
  },
  bullet: {
    char: "•",
    size: "20px",
    color: "#7c8db0",
    margin: { top: "0px", left: "2px", right: "8px" },
  },
};

// --- Helper to build a full task styles config quickly ---
function tasks(overrides: Partial<TaskStylesConfig> & { [K in keyof TaskStylesConfig]?: Partial<TaskStylesConfig[K]> }): TaskStylesConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const base = JSON.parse(JSON.stringify(defaultTaskStyles)) as any;
  for (const [k, v] of Object.entries(overrides)) {
    if (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object") {
      Object.assign(base[k], v);
    } else {
      base[k] = v;
    }
  }
  return base as TaskStylesConfig;
}

export const themePresets: ThemePreset[] = [
  // ─── 1. Default (MrDemonWolf midnight blue) ──────────────────────────
  {
    id: "default",
    name: "Default",
    description: "MrDemonWolf midnight blue with cerulean accents",
    preview: { bg: "#091533", accent: "#00aced", text: "#ffffff" },
    // Deep-clone so nested objects (ring, header, checkbox…) aren't shared
    // with the exported defaults — same isolation the tasks() helper gives.
    timerStyles: JSON.parse(JSON.stringify(defaultTimerStyles)) as TimerStylesConfig,
    taskStyles: JSON.parse(JSON.stringify(defaultTaskStyles)) as TaskStylesConfig,
  },

  // ─── 2. Ocean Depths (calm navy + teal) ─────────────────────────────
  {
    id: "ocean-depths",
    name: "Ocean Depths",
    description: "Deep navy and teal with luminous accents",
    preview: { bg: "#0a1628", accent: "#2dd4bf", text: "#e0f2fe" },
    timerStyles: {
      dimensions: { width: "250px", height: "250px" },
      background: { color: "#0a1628", opacity: 0.88, borderRadius: "22%" },
      ring: { enabled: true, trackColor: "#2dd4bf", trackOpacity: 0.12, fillColor: "#2dd4bf", fillOpacity: 1, width: 8, gap: 6 },
      text: { color: "#e0f2fe", outlineColor: "#0a1628", outlineSize: "0px", fontFamily: "Montserrat" },
      fontSizes: { label: "18px", time: "48px", cycle: "16px" },
    },
    taskStyles: tasks({
      header: { height: "52px", background: { color: "#0c1e3a", opacity: 0.95 }, border: { color: "#2dd4bf", width: "1px", radius: "12px 12px 0 0" }, fontSize: "24px", fontColor: "#e0f2fe", padding: "12px 16px" },
      body: { background: { color: "#0a1628", opacity: 0.85 }, border: { color: "#163050", width: "1px", radius: "0 0 12px 12px" }, padding: { vertical: "6px", horizontal: "6px" } },
      task: { background: { color: "#0e2240", opacity: 0.9 }, border: { color: "#1a3a5f", width: "1px", radius: "10px" }, fontSize: "22px", fontColor: "#e0f2fe", usernameColor: "#2dd4bf", padding: "10px 14px", marginBottom: "4px", maxWidth: "100%" },
      taskDone: { background: { color: "#0a1628", opacity: 0.5 }, fontColor: "#5a8aaa" },
      checkbox: { size: "20px", background: { color: "#000000", opacity: 0 }, border: { color: "#2dd4bf", width: "2px", radius: "6px" }, margin: { top: "4px", left: "2px", right: "8px" }, tickChar: "✔", tickSize: "14px", tickColor: "#2dd4bf" },
    }),
  },

  // ─── 3. Liquid Glass Dark (macOS Tahoe) ─────────────────────────────
  {
    id: "glass-dark",
    name: "Liquid Glass Dark",
    description: "macOS Tahoe dark mode — translucent dark panels",
    preview: { bg: "#1c1c1e", accent: "#0a84ff", text: "#f5f5f7" },
    timerStyles: {
      dimensions: { width: "250px", height: "250px" },
      background: { color: "#2c2c2e", opacity: 0.78, borderRadius: "22%" },
      ring: { enabled: true, trackColor: "#48484a", trackOpacity: 0.6, fillColor: "#0a84ff", fillOpacity: 1, width: 7, gap: 6 },
      text: { color: "#f5f5f7", outlineColor: "#000000", outlineSize: "0px", fontFamily: "Montserrat" },
      fontSizes: { label: "17px", time: "48px", cycle: "15px" },
    },
    taskStyles: tasks({
      fonts: { header: "Montserrat", body: "Roboto" },
      header: { height: "52px", background: { color: "#2c2c2e", opacity: 0.82 }, border: { color: "#48484a", width: "1px", radius: "16px 16px 0 0" }, fontSize: "24px", fontColor: "#f5f5f7", padding: "12px 16px" },
      body: { background: { color: "#1c1c1e", opacity: 0.72 }, border: { color: "#48484a", width: "1px", radius: "0 0 16px 16px" }, padding: { vertical: "6px", horizontal: "6px" } },
      task: { background: { color: "#3a3a3c", opacity: 0.6 }, border: { color: "#48484a", width: "1px", radius: "12px" }, fontSize: "22px", fontColor: "#f5f5f7", usernameColor: "#0a84ff", padding: "10px 14px", marginBottom: "4px", maxWidth: "100%" },
      taskDone: { background: { color: "#2c2c2e", opacity: 0.4 }, fontColor: "#636366" },
      checkbox: { size: "20px", background: { color: "#3a3a3c", opacity: 0.4 }, border: { color: "#636366", width: "1.5px", radius: "6px" }, margin: { top: "4px", left: "2px", right: "8px" }, tickChar: "✔", tickSize: "14px", tickColor: "#0a84ff" },
    }),
  },

  // ─── 4. Cozy Cottage (warm cream + gold) ────────────────────────────
  {
    id: "cozy-cottage",
    name: "Cozy Cottage",
    description: "Warm earth tones with a soft cream palette",
    preview: { bg: "#faf3e8", accent: "#b8860b", text: "#5c3d1a" },
    timerStyles: {
      dimensions: { width: "250px", height: "250px" },
      background: { color: "#faf3e8", opacity: 0.92, borderRadius: "22%" },
      ring: { enabled: true, trackColor: "#d4b896", trackOpacity: 0.3, fillColor: "#b8860b", fillOpacity: 0.9, width: 8, gap: 6 },
      text: { color: "#5c3d1a", outlineColor: "#faf3e8", outlineSize: "0px", fontFamily: "Montserrat" },
      fontSizes: { label: "18px", time: "48px", cycle: "16px" },
    },
    taskStyles: tasks({
      fonts: { header: "Montserrat", body: "Roboto" },
      header: { height: "52px", background: { color: "#b8860b", opacity: 0.9 }, border: { color: "#d4a843", width: "0px", radius: "14px 14px 0 0" }, fontSize: "24px", fontColor: "#fef9f0", padding: "12px 16px" },
      body: { background: { color: "#faf3e8", opacity: 0.88 }, border: { color: "#e0d0b8", width: "0px", radius: "0 0 14px 14px" }, padding: { vertical: "6px", horizontal: "6px" } },
      task: { background: { color: "#fff8ee", opacity: 0.95 }, border: { color: "#e8d8c0", width: "1px", radius: "10px" }, fontSize: "22px", fontColor: "#5c3d1a", usernameColor: "#b8860b", padding: "10px 14px", marginBottom: "4px", maxWidth: "100%" },
      taskDone: { background: { color: "#f0e8d8", opacity: 0.6 }, fontColor: "#b0a090" },
      checkbox: { size: "20px", background: { color: "#fff8ee", opacity: 0.5 }, border: { color: "#d4a843", width: "2px", radius: "6px" }, margin: { top: "4px", left: "2px", right: "8px" }, tickChar: "✔", tickSize: "14px", tickColor: "#b8860b" },
    }),
  },

  // ─── 5. Minimal Light (clean white) ─────────────────────────────────
  {
    id: "minimal-light",
    name: "Minimal Light",
    description: "Ultra-clean white design for readability",
    preview: { bg: "#ffffff", accent: "#6366f1", text: "#111827" },
    timerStyles: {
      dimensions: { width: "250px", height: "250px" },
      background: { color: "#ffffff", opacity: 0.96, borderRadius: "22%" },
      ring: { enabled: true, trackColor: "#e5e7eb", trackOpacity: 1, fillColor: "#6366f1", fillOpacity: 1, width: 8, gap: 6 },
      text: { color: "#111827", outlineColor: "#ffffff", outlineSize: "0px", fontFamily: "Montserrat" },
      fontSizes: { label: "18px", time: "48px", cycle: "16px" },
    },
    taskStyles: tasks({
      header: { height: "52px", background: { color: "#f9fafb", opacity: 0.98 }, border: { color: "#e5e7eb", width: "1px", radius: "10px 10px 0 0" }, fontSize: "24px", fontColor: "#111827", padding: "12px 16px" },
      body: { background: { color: "#ffffff", opacity: 0.96 }, border: { color: "#e5e7eb", width: "1px", radius: "0 0 10px 10px" }, padding: { vertical: "6px", horizontal: "6px" } },
      task: { background: { color: "#f9fafb", opacity: 0.98 }, border: { color: "#e5e7eb", width: "1px", radius: "8px" }, fontSize: "22px", fontColor: "#111827", usernameColor: "#6366f1", padding: "10px 14px", marginBottom: "4px", maxWidth: "100%" },
      taskDone: { background: { color: "#f3f4f6", opacity: 0.7 }, fontColor: "#9ca3af" },
      checkbox: { size: "20px", background: { color: "#ffffff", opacity: 1 }, border: { color: "#d1d5db", width: "2px", radius: "6px" }, margin: { top: "4px", left: "2px", right: "8px" }, tickChar: "✔", tickSize: "14px", tickColor: "#6366f1" },
    }),
  },

  // ─── 6. Twitch Purple (brand) ───────────────────────────────────────
  {
    id: "twitch-purple",
    name: "Twitch Purple",
    description: "Official Twitch brand colors and feel",
    preview: { bg: "#0e0e10", accent: "#9146ff", text: "#efeff1" },
    timerStyles: {
      dimensions: { width: "250px", height: "250px" },
      background: { color: "#0e0e10", opacity: 0.92, borderRadius: "22%" },
      ring: { enabled: true, trackColor: "#9146ff", trackOpacity: 0.15, fillColor: "#9146ff", fillOpacity: 1, width: 8, gap: 6 },
      text: { color: "#efeff1", outlineColor: "#0e0e10", outlineSize: "0px", fontFamily: "Montserrat" },
      fontSizes: { label: "18px", time: "48px", cycle: "16px" },
    },
    taskStyles: tasks({
      header: { height: "52px", background: { color: "#9146ff", opacity: 0.95 }, border: { color: "#bf94ff", width: "0px", radius: "12px 12px 0 0" }, fontSize: "24px", fontColor: "#ffffff", padding: "12px 16px" },
      body: { background: { color: "#0e0e10", opacity: 0.9 }, border: { color: "#1f1f23", width: "1px", radius: "0 0 12px 12px" }, padding: { vertical: "6px", horizontal: "6px" } },
      task: { background: { color: "#18181b", opacity: 0.95 }, border: { color: "#26262c", width: "1px", radius: "10px" }, fontSize: "22px", fontColor: "#efeff1", usernameColor: "#bf94ff", padding: "10px 14px", marginBottom: "4px", maxWidth: "100%" },
      taskDone: { background: { color: "#0e0e10", opacity: 0.5 }, fontColor: "#53535f" },
      checkbox: { size: "20px", background: { color: "#000000", opacity: 0 }, border: { color: "#9146ff", width: "2px", radius: "6px" }, margin: { top: "4px", left: "2px", right: "8px" }, tickChar: "✔", tickSize: "14px", tickColor: "#9146ff" },
    }),
  },
];
