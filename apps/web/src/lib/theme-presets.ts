import type { ThemePreset, TimerStylesConfig, TaskStylesConfig } from "./config-types";

export const defaultTimerStyles: TimerStylesConfig = {
  dimensions: { width: "250px", height: "250px" },
  background: { color: "#1c1c1e", opacity: 0.85, borderRadius: "22%" },
  ring: {
    enabled: true,
    trackColor: "#ffffff",
    trackOpacity: 0.1,
    fillColor: "#34c759",
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
    background: { color: "#1c1c1e", opacity: 0.95 },
    border: { color: "#3a3a3c", width: "1px", radius: "12px 12px 0 0" },
    fontSize: "24px",
    fontColor: "#ffffff",
    padding: "12px 16px",
  },
  body: {
    background: { color: "#1c1c1e", opacity: 0.85 },
    border: { color: "#3a3a3c", width: "1px", radius: "0 0 12px 12px" },
    padding: { vertical: "6px", horizontal: "6px" },
  },
  task: {
    background: { color: "#2c2c2e", opacity: 0.9 },
    border: { color: "#3a3a3c", width: "0px", radius: "10px" },
    fontSize: "22px",
    fontColor: "#f5f5f7",
    usernameColor: "#bf5af2",
    padding: "10px 14px",
    marginBottom: "4px",
    maxWidth: "100%",
  },
  taskDone: {
    background: { color: "#1c1c1e", opacity: 0.5 },
    fontColor: "#8e8e93",
  },
  checkbox: {
    size: "20px",
    background: { color: "#000000", opacity: 0 },
    border: { color: "#636366", width: "2px", radius: "6px" },
    margin: { top: "4px", left: "2px", right: "8px" },
    tickChar: "\u2714",
    tickSize: "14px",
    tickColor: "#34c759",
  },
  bullet: {
    char: "\u2022",
    size: "20px",
    color: "#8e8e93",
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
  // ─── 1. Default (Apple-inspired dark) ────────────────────────────────
  {
    id: "default",
    name: "Default",
    description: "Clean dark theme with Apple-style progress ring",
    preview: { bg: "#1c1c1e", accent: "#34c759", text: "#ffffff" },
    timerStyles: { ...defaultTimerStyles },
    taskStyles: { ...defaultTaskStyles },
  },

  // ─── 2. Liquid Glass Light (macOS Tahoe) ────────────────────────────
  {
    id: "glass-light",
    name: "Liquid Glass",
    description: "macOS Tahoe light mode — frosted glass widgets",
    preview: { bg: "#e8ecf0", accent: "#007aff", text: "#000000" },
    timerStyles: {
      dimensions: { width: "250px", height: "250px" },
      background: { color: "#f5f5f7", opacity: 0.82, borderRadius: "22%" },
      ring: { enabled: true, trackColor: "#d1d1d6", trackOpacity: 0.6, fillColor: "#007aff", fillOpacity: 1, width: 7, gap: 6 },
      text: { color: "#000000", outlineColor: "#000000", outlineSize: "0px", fontFamily: "Montserrat" },
      fontSizes: { label: "17px", time: "48px", cycle: "15px" },
    },
    taskStyles: tasks({
      fonts: { header: "Montserrat", body: "Roboto" },
      header: { height: "52px", background: { color: "#f5f5f7", opacity: 0.85 }, border: { color: "#c7c7cc", width: "1px", radius: "16px 16px 0 0" }, fontSize: "24px", fontColor: "#000000", padding: "12px 16px" },
      body: { background: { color: "#f0f0f2", opacity: 0.75 }, border: { color: "#c7c7cc", width: "1px", radius: "0 0 16px 16px" }, padding: { vertical: "6px", horizontal: "6px" } },
      task: { background: { color: "#ffffff", opacity: 0.65 }, border: { color: "#d1d1d6", width: "1px", radius: "12px" }, fontSize: "22px", fontColor: "#000000", usernameColor: "#007aff", padding: "10px 14px", marginBottom: "4px", maxWidth: "100%" },
      taskDone: { background: { color: "#f5f5f7", opacity: 0.4 }, fontColor: "#86868b" },
      checkbox: { size: "20px", background: { color: "#ffffff", opacity: 0.5 }, border: { color: "#c7c7cc", width: "1.5px", radius: "6px" }, margin: { top: "4px", left: "2px", right: "8px" }, tickChar: "\u2714", tickSize: "14px", tickColor: "#007aff" },
    }),
  },

  // ─── 3. Liquid Glass Dark (macOS Tahoe) ────────────────────────────
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
      checkbox: { size: "20px", background: { color: "#3a3a3c", opacity: 0.4 }, border: { color: "#636366", width: "1.5px", radius: "6px" }, margin: { top: "4px", left: "2px", right: "8px" }, tickChar: "\u2714", tickSize: "14px", tickColor: "#0a84ff" },
    }),
  },

  // ─── 4. Neon Cyberpunk ──────────────────────────────────────────────
  {
    id: "neon-cyberpunk",
    name: "Neon Cyberpunk",
    description: "Electric neon accents on deep dark backgrounds",
    preview: { bg: "#0d0221", accent: "#00ff9f", text: "#00ff9f" },
    timerStyles: {
      dimensions: { width: "250px", height: "250px" },
      background: { color: "#0d0221", opacity: 0.9, borderRadius: "22%" },
      ring: { enabled: true, trackColor: "#00ff9f", trackOpacity: 0.12, fillColor: "#00ff9f", fillOpacity: 1, width: 6, gap: 6 },
      text: { color: "#e0ffe0", outlineColor: "#00ff9f", outlineSize: "2px", fontFamily: "Montserrat" },
      fontSizes: { label: "18px", time: "48px", cycle: "16px" },
    },
    taskStyles: tasks({
      fonts: { header: "Montserrat", body: "Roboto" },
      header: { height: "52px", background: { color: "#0d0221", opacity: 0.95 }, border: { color: "#00ff9f", width: "1px", radius: "2px 2px 0 0" }, fontSize: "24px", fontColor: "#00ff9f", padding: "12px 16px" },
      body: { background: { color: "#0d0221", opacity: 0.85 }, border: { color: "#1a0a3e", width: "1px", radius: "0 0 2px 2px" }, padding: { vertical: "6px", horizontal: "6px" } },
      task: { background: { color: "#1a0a3e", opacity: 0.9 }, border: { color: "#00ff9f", width: "1px", radius: "2px" }, fontSize: "22px", fontColor: "#d0ffd0", usernameColor: "#ff006e", padding: "10px 14px", marginBottom: "4px", maxWidth: "100%" },
      taskDone: { background: { color: "#0d0221", opacity: 0.5 }, fontColor: "#336644" },
      checkbox: { size: "20px", background: { color: "#000000", opacity: 0 }, border: { color: "#00ff9f", width: "2px", radius: "0px" }, margin: { top: "4px", left: "2px", right: "8px" }, tickChar: "\u2588", tickSize: "14px", tickColor: "#00ff9f" },
      bullet: { char: ">", size: "20px", color: "#00ff9f", margin: { top: "0px", left: "2px", right: "8px" } },
    }),
  },

  // ─── 5. Cozy Cottage ────────────────────────────────────────────────
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
      checkbox: { size: "20px", background: { color: "#fff8ee", opacity: 0.5 }, border: { color: "#d4a843", width: "2px", radius: "6px" }, margin: { top: "4px", left: "2px", right: "8px" }, tickChar: "\u2714", tickSize: "14px", tickColor: "#b8860b" },
    }),
  },

  // ─── 6. Ocean Depths ────────────────────────────────────────────────
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
      checkbox: { size: "20px", background: { color: "#000000", opacity: 0 }, border: { color: "#2dd4bf", width: "2px", radius: "6px" }, margin: { top: "4px", left: "2px", right: "8px" }, tickChar: "\u2714", tickSize: "14px", tickColor: "#2dd4bf" },
    }),
  },

  // ─── 7. Sakura ──────────────────────────────────────────────────────
  {
    id: "sakura",
    name: "Sakura",
    description: "Soft cherry blossom pinks with gentle pastels",
    preview: { bg: "#fff0f5", accent: "#ec4899", text: "#9d174d" },
    timerStyles: {
      dimensions: { width: "250px", height: "250px" },
      background: { color: "#fff0f5", opacity: 0.92, borderRadius: "22%" },
      ring: { enabled: true, trackColor: "#f9a8d4", trackOpacity: 0.3, fillColor: "#ec4899", fillOpacity: 0.9, width: 8, gap: 6 },
      text: { color: "#9d174d", outlineColor: "#ffffff", outlineSize: "0px", fontFamily: "Montserrat" },
      fontSizes: { label: "18px", time: "48px", cycle: "16px" },
    },
    taskStyles: tasks({
      fonts: { header: "Montserrat", body: "Roboto" },
      header: { height: "52px", background: { color: "#ec4899", opacity: 0.85 }, border: { color: "#f9a8d4", width: "0px", radius: "14px 14px 0 0" }, fontSize: "24px", fontColor: "#ffffff", padding: "12px 16px" },
      body: { background: { color: "#fff0f5", opacity: 0.85 }, border: { color: "#fce7f3", width: "0px", radius: "0 0 14px 14px" }, padding: { vertical: "6px", horizontal: "6px" } },
      task: { background: { color: "#ffffff", opacity: 0.9 }, border: { color: "#fce7f3", width: "1px", radius: "12px" }, fontSize: "22px", fontColor: "#4a1030", usernameColor: "#ec4899", padding: "10px 14px", marginBottom: "4px", maxWidth: "100%" },
      taskDone: { background: { color: "#fdf2f8", opacity: 0.5 }, fontColor: "#d4a0b8" },
      checkbox: { size: "20px", background: { color: "#fff0f5", opacity: 0.5 }, border: { color: "#f9a8d4", width: "2px", radius: "50%" }, margin: { top: "4px", left: "2px", right: "8px" }, tickChar: "\u2764", tickSize: "12px", tickColor: "#ec4899" },
    }),
  },

  // ─── 8. Retro Terminal ──────────────────────────────────────────────
  {
    id: "retro-terminal",
    name: "Retro Terminal",
    description: "Green phosphor CRT on pure black",
    preview: { bg: "#050505", accent: "#33ff33", text: "#33ff33" },
    timerStyles: {
      dimensions: { width: "250px", height: "250px" },
      background: { color: "#050505", opacity: 0.95, borderRadius: "22%" },
      ring: { enabled: true, trackColor: "#33ff33", trackOpacity: 0.08, fillColor: "#33ff33", fillOpacity: 0.85, width: 4, gap: 8 },
      text: { color: "#33ff33", outlineColor: "#003300", outlineSize: "1px", fontFamily: "Montserrat" },
      fontSizes: { label: "18px", time: "48px", cycle: "16px" },
    },
    taskStyles: tasks({
      display: { showDone: true, showCount: true, useCheckboxes: false, crossOnDone: true, numberOfLines: 2 },
      fonts: { header: "Montserrat", body: "Roboto" },
      header: { height: "52px", background: { color: "#050505", opacity: 0.95 }, border: { color: "#33ff33", width: "1px", radius: "0px" }, fontSize: "24px", fontColor: "#33ff33", padding: "12px 16px" },
      body: { background: { color: "#050505", opacity: 0.9 }, border: { color: "#1a3a1a", width: "1px", radius: "0px" }, padding: { vertical: "6px", horizontal: "6px" } },
      task: { background: { color: "#0a1a0a", opacity: 0.9 }, border: { color: "#1a3a1a", width: "1px", radius: "0px" }, fontSize: "22px", fontColor: "#33ff33", usernameColor: "#66ff66", padding: "10px 14px", marginBottom: "4px", maxWidth: "100%" },
      taskDone: { background: { color: "#050505", opacity: 0.5 }, fontColor: "#1a661a" },
      bullet: { char: ">", size: "20px", color: "#33ff33", margin: { top: "0px", left: "2px", right: "8px" } },
    }),
  },

  // ─── 9. Minimal Light ───────────────────────────────────────────────
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
      checkbox: { size: "20px", background: { color: "#ffffff", opacity: 1 }, border: { color: "#d1d5db", width: "2px", radius: "6px" }, margin: { top: "4px", left: "2px", right: "8px" }, tickChar: "\u2714", tickSize: "14px", tickColor: "#6366f1" },
    }),
  },

  // ─── 10. Sunset ─────────────────────────────────────────────────────
  {
    id: "sunset",
    name: "Sunset",
    description: "Warm oranges and purples like a dusk sky",
    preview: { bg: "#1a0a2e", accent: "#ff6b35", text: "#fbbf24" },
    timerStyles: {
      dimensions: { width: "250px", height: "250px" },
      background: { color: "#1a0a2e", opacity: 0.88, borderRadius: "22%" },
      ring: { enabled: true, trackColor: "#ff6b35", trackOpacity: 0.15, fillColor: "#ff6b35", fillOpacity: 1, width: 8, gap: 6 },
      text: { color: "#fef3c7", outlineColor: "#1a0a2e", outlineSize: "0px", fontFamily: "Montserrat" },
      fontSizes: { label: "18px", time: "48px", cycle: "16px" },
    },
    taskStyles: tasks({
      fonts: { header: "Montserrat", body: "Roboto" },
      header: { height: "52px", background: { color: "#ff6b35", opacity: 0.92 }, border: { color: "#ff8c5a", width: "0px", radius: "12px 12px 0 0" }, fontSize: "24px", fontColor: "#ffffff", padding: "12px 16px" },
      body: { background: { color: "#1a0a2e", opacity: 0.85 }, border: { color: "#2d1050", width: "0px", radius: "0 0 12px 12px" }, padding: { vertical: "6px", horizontal: "6px" } },
      task: { background: { color: "#2d1050", opacity: 0.88 }, border: { color: "#3d1870", width: "1px", radius: "10px" }, fontSize: "22px", fontColor: "#fef3c7", usernameColor: "#ff6b35", padding: "10px 14px", marginBottom: "4px", maxWidth: "100%" },
      taskDone: { background: { color: "#1a0a2e", opacity: 0.5 }, fontColor: "#7a5880" },
      checkbox: { size: "20px", background: { color: "#000000", opacity: 0 }, border: { color: "#ff6b35", width: "2px", radius: "6px" }, margin: { top: "4px", left: "2px", right: "8px" }, tickChar: "\u2714", tickSize: "14px", tickColor: "#ff6b35" },
    }),
  },

  // ─── 11. Twitch Purple ──────────────────────────────────────────────
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
      checkbox: { size: "20px", background: { color: "#000000", opacity: 0 }, border: { color: "#9146ff", width: "2px", radius: "6px" }, margin: { top: "4px", left: "2px", right: "8px" }, tickChar: "\u2714", tickSize: "14px", tickColor: "#9146ff" },
    }),
  },
];
