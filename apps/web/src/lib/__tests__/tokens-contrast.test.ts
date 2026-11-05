import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * WCAG contrast for every text, icon and control colour the web app paints, in both schemes,
 * computed from the oklch values in design-system/tokens.json. Each pairing carries the level
 * chosen for it (design-system/contrast.md explains each choice):
 *
 * - `AAA`  text, ≥ 7:1 (1.4.6)
 * - `AA`   text, ≥ 4.5:1 (1.4.3) — the floor for every text pairing
 * - `UI`   non-text, ≥ 3:1 (1.4.11): input borders, focus ring, checked fills, chart marks
 *
 * A pairing is `fg` on a stack of surfaces painted bottom-up; `token/NN` is that token at NN%
 * opacity (a Tailwind `/NN` modifier), composited over what is under it, which is how the
 * browser draws it. Decorative-only colours (`--border`, `--input`, `--hairline` rules, the
 * aria-hidden separators, disabled controls) are exempt from 1.4.3/1.4.11 and listed in
 * contrast.md instead.
 */

type Rgb = [number, number, number];
type Scheme = "light" | "dark";
type Level = "AAA" | "AA" | "UI";

const MIN: Record<Level, number> = { AAA: 7, AA: 4.5, UI: 3 };

const tokens = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../../../../design-system/tokens.json", import.meta.url)),
    "utf8",
  ),
) as {
  color: {
    scheme: Record<Scheme, Record<string, string>>;
    partner: { twitch: string; twitchHover: string };
  };
};

/** oklch → gamma-encoded sRGB (0–1, clamped) plus alpha. */
function parseOklch(value: string): { rgb: Rgb; alpha: number } {
  const m = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+)%)?\)$/.exec(value);
  if (!m) throw new Error(`not an oklch() literal: ${value}`);
  const [L, C, h] = [Number(m[1]), Number(m[2]), (Number(m[3]) * Math.PI) / 180];
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear: Rgb = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ];
  const encode = (c: number) => {
    const x = Math.min(1, Math.max(0, c));
    return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  };
  return { rgb: linear.map(encode) as Rgb, alpha: m[4] === undefined ? 1 : Number(m[4]) / 100 };
}

function parseHex(value: string): Rgb {
  const m = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value);
  if (!m) throw new Error(`not a #rrggbb literal: ${value}`);
  return [m[1], m[2], m[3]].map((x) => Number.parseInt(x ?? "0", 16) / 255) as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(fg: Rgb, bg: Rgb): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** `top` at `alpha` over an opaque `bottom`, in sRGB. */
function composite(top: Rgb, alpha: number, bottom: Rgb): Rgb {
  return top.map((c, i) => c * alpha + (bottom[i] ?? 0) * (1 - alpha)) as Rgb;
}

/** Resolve `token` / `token/NN` in a scheme, compositing anything translucent over `under`. */
function paint(scheme: Scheme, expr: string, under?: Rgb): Rgb {
  const [name = "", pct] = expr.split("/");
  const partner: Record<string, string> = {
    twitch: tokens.color.partner.twitch,
    "twitch-hover": tokens.color.partner.twitchHover,
    white: "#ffffff",
  };
  let rgb: Rgb;
  let alpha = 1;
  if (partner[name]) {
    rgb = parseHex(partner[name]);
  } else {
    let raw = tokens.color.scheme[scheme][name];
    const alias = raw && /^\{(.+)\}$/.exec(raw)?.[1];
    if (alias) raw = tokens.color.scheme[scheme][alias];
    if (!raw) throw new Error(`color.scheme.${scheme}.${name} missing`);
    ({ rgb, alpha } = parseOklch(raw));
  }
  alpha *= pct === undefined ? 1 : Number(pct) / 100;
  if (alpha >= 1) return rgb;
  if (!under) throw new Error(`${expr} is translucent and needs a surface under it`);
  return composite(rgb, alpha, under);
}

function ratio(scheme: Scheme, fg: string, on: readonly string[]): number {
  const bg = on.reduce<Rgb | undefined>((acc, layer) => paint(scheme, layer, acc), undefined);
  if (!bg) throw new Error("empty surface stack");
  return contrast(paint(scheme, fg, bg), bg);
}

type Pairing = {
  /** Where it shows up; also the test name. */
  use: string;
  fg: string;
  /** Surfaces bottom-up. */
  on: readonly string[];
  /** One level for both schemes, or `[dark, light]`; `null` = the class is not used there. */
  level: Level | readonly [Level | null, Level | null];
};

const SURFACES = ["background", "card", "popover", "muted"] as const;

const PAIRINGS: Pairing[] = [
  // Body text on every surface it sits on.
  ...SURFACES.map((s) => ({
    use: `body text on ${s}`,
    fg: "foreground",
    on: [s],
    level: "AAA" as const,
  })),
  {
    use: "dialog, menu, tooltip, toast text",
    fg: "popover-foreground",
    on: ["popover"],
    level: "AAA",
  },
  { use: "tinted row / idle chip text", fg: "foreground", on: ["card", "muted/60"], level: "AAA" },
  { use: "secondary button label", fg: "secondary-foreground", on: ["secondary"], level: "AAA" },
  {
    use: "highlighted menu item",
    fg: "accent-foreground",
    on: ["popover", "accent"],
    level: "AAA",
  },
  {
    use: "collapsed section summary (text-foreground/80)",
    fg: "foreground/80",
    on: ["card"],
    level: "AAA",
  },
  {
    use: "inactive tab (light text-foreground/75)",
    fg: "foreground/75",
    on: ["muted"],
    level: [null, "AAA"],
  },
  // Muted text: AAA on every surface in both schemes.
  ...[...SURFACES, "secondary", "accent"].map((s) => ({
    use: `muted text on ${s}`,
    fg: "muted-foreground",
    on: [s],
    level: "AAA" as const,
  })),
  { use: "idle status chip", fg: "muted-foreground", on: ["card", "muted/60"], level: "AAA" },
  {
    use: "input placeholder (dark input fill)",
    fg: "muted-foreground",
    on: ["card", "input/30"],
    level: ["AAA", null],
  },
  {
    use: "save bar hint over the page",
    fg: "muted-foreground",
    on: ["card", "background/80"],
    level: "AAA",
  },
  {
    use: "callout body (destructive)",
    fg: "muted-foreground",
    on: ["card", "destructive/10"],
    level: "AA",
  },
  // Link: AAA on plain surfaces and docs inline code; light keeps AA on primary tints.
  ...SURFACES.map((s) => ({
    use: `link on ${s}`,
    fg: "link",
    on: [s],
    level: "AAA" as const,
  })),
  ...(["background", "card"] as const).map((s) => ({
    use: `link on docs inline code over ${s} (muted/70)`,
    fg: "link",
    on: [s, "muted/70"],
    level: "AAA" as const,
  })),
  {
    // sign-in-notice.tsx: the link inside the destructive Callout is linkVariants'
    // `proseOnTint` (foreground + underline), since text-link is only AA on this tint in light.
    use: "link in a destructive callout (foreground on destructive/10)",
    fg: "foreground",
    on: ["background", "destructive/10"],
    level: "AAA",
  },
  {
    use: "active nav (primary/10 tint)",
    fg: "link",
    on: ["background", "primary/10"],
    level: ["AAA", "AA"],
  },
  {
    use: "accent chip (primary/10 tint)",
    fg: "link",
    on: ["card", "primary/10"],
    level: ["AAA", "AA"],
  },
  // Fills under white labels: AA (a 7:1 blue would read navy).
  { use: "primary button", fg: "primary-foreground", on: ["primary"], level: "AA" },
  {
    use: "primary button hover (primary/90)",
    fg: "primary-foreground",
    on: ["background", "primary/90"],
    level: "AA",
  },
  { use: "Twitch button (brand purple)", fg: "white", on: ["twitch"], level: "AA" },
  { use: "Twitch button hover", fg: "white", on: ["twitch-hover"], level: "AA" },
  // Status tones. Dark: success/warning/cornflower AAA. Light and destructive: AA.
  ...(["background", "card", "popover"] as const).map((s) => ({
    use: `destructive text on ${s}`,
    fg: "destructive",
    on: [s],
    level: "AA" as const,
  })),
  {
    use: "danger chip / destructive menu highlight",
    fg: "destructive",
    on: ["popover", "destructive/10"],
    level: "AA",
  },
  { use: "danger chip on card", fg: "destructive", on: ["card", "destructive/10"], level: "AA" },
  ...(["success", "warning", "cornflower"] as const).flatMap((tone) => [
    {
      use: `${tone} text on background`,
      fg: tone,
      on: ["background"],
      level: ["AAA", "AA"] as const,
    },
    { use: `${tone} text on card`, fg: tone, on: ["card"], level: ["AAA", "AA"] as const },
    {
      use: `${tone} chip (${tone}/10 tint)`,
      fg: tone,
      on: ["card", `${tone}/10`],
      level: ["AAA", "AA"] as const,
    },
  ]),
  // Destructive menu rows (ui/dropdown-menu.tsx `destructiveItem`): highlighted, the label
  // turns `destructive-strong` on the /10 tint and keyboard focus draws a red inset ring.
  // Every popup sits on --popover (`popupSurfaceRecipe`; menu-consistency.test.ts fails on
  // a call site that repaints it).
  {
    use: "highlighted destructive menu row label",
    fg: "destructive-strong",
    on: ["popover", "destructive/10"],
    level: "AA",
  },
  {
    use: "destructive menu row focus ring",
    fg: "destructive",
    on: ["popover", "destructive/10"],
    level: "UI",
  },
  // Destructive button hover (ui/button.tsx): dark /30, light /20 tint.
  {
    use: "destructive button hover label (dark /30)",
    fg: "destructive-strong",
    on: ["card", "destructive/30"],
    level: ["AA", null],
  },
  {
    use: "destructive button hover label (light /20)",
    fg: "destructive-strong",
    on: ["card", "destructive/20"],
    level: [null, "AA"],
  },
  // Red keyboard focus border of destructive icon buttons (`destructiveIconButton`).
  ...(["background", "card"] as const).map((s) => ({
    use: `destructive focus border on ${s}`,
    fg: "destructive",
    on: [s],
    level: "UI" as const,
  })),
  // Non-text (1.4.11).
  ...(["background", "card", "popover"] as const).map((s) => ({
    use: `focus ring on ${s}`,
    fg: "ring",
    on: [s],
    level: "UI" as const,
  })),
  {
    use: "menu row focus ring on a highlighted row",
    fg: "ring",
    on: ["popover", "accent"],
    level: "UI",
  },
  {
    use: "checked switch / checkbox / today bar on card",
    fg: "primary",
    on: ["card"],
    level: "UI",
  },
  { use: "checked control on background", fg: "primary", on: ["background"], level: "UI" },
  { use: "input + select border on card", fg: "muted-foreground/70", on: ["card"], level: "UI" },
  {
    use: "input + select border on background",
    fg: "muted-foreground/70",
    on: ["background"],
    level: "UI",
  },
  {
    use: "unchecked switch track, planned cycle dot",
    fg: "muted-foreground/70",
    on: ["card"],
    level: "UI",
  },
  { use: "idle chip dot", fg: "muted-foreground/70", on: ["card", "muted/60"], level: "UI" },
  {
    use: "focus chart bar (light /70)",
    fg: "muted-foreground/70",
    on: ["card"],
    level: [null, "UI"],
  },
  {
    use: "focus chart bar (dark /55)",
    fg: "muted-foreground/55",
    on: ["card"],
    level: ["UI", null],
  },
  { use: "Twitch icon on its /15 tile", fg: "twitch", on: ["card", "twitch/15"], level: "UI" },
  ...(["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"] as const).map((c) => ({
    use: `${c} mark on card`,
    fg: c,
    on: ["card"],
    level: "UI" as const,
  })),
];

describe.each([
  ["dark", 0],
  ["light", 1],
] as const)("%s scheme contrast", (scheme, index) => {
  const rows = PAIRINGS.flatMap((p) => {
    const level = typeof p.level === "string" ? p.level : p.level[index];
    return level
      ? [[`${p.use} (${p.fg} on ${p.on.join(" > ")}) ≥ ${level}`, p, level] as const]
      : [];
  });

  it.each(rows)("%s", (_name, p, level) => {
    expect(ratio(scheme, p.fg, p.on)).toBeGreaterThanOrEqual(MIN[level]);
  });

  it("every surface the pairings name is opaque", () => {
    for (const s of [...SURFACES, "secondary", "accent", "primary"]) {
      expect(parseOklch(tokens.color.scheme[scheme][s] ?? "").alpha, s).toBe(1);
    }
  });
});

// The non-text pairings above assume these classes; a component that drifts to a fainter
// tint (the old dark switch track was `bg-input/80`, 1.5:1) must update the table too.
describe("component classes the pairings assume", () => {
  const source = (path: string) =>
    readFileSync(fileURLToPath(new URL(`../../components/${path}`, import.meta.url)), "utf8");

  it.each([
    ["ui/input.tsx", "border-muted-foreground/70"],
    ["ui/select.tsx", "border-muted-foreground/70"],
    ["ui/switch.tsx", "data-unchecked:bg-muted-foreground/70"],
    ["dashboard-stats.tsx", "fill-muted-foreground/70 dark:fill-muted-foreground/55"],
    ["status-chip.tsx", 'dot: "bg-muted-foreground/70"'],
    ["timer-controls.tsx", "border border-muted-foreground/70 bg-transparent"],
  ])("%s uses %s", (path, cls) => {
    expect(source(path)).toContain(cls);
  });

  it("the switch track keeps one unchecked tint in both schemes", () => {
    expect(source("ui/switch.tsx")).not.toMatch(/dark:data-unchecked:bg-input/);
  });
});

// The helpers above must agree with published reference ratios, or every assertion is moot.
describe("contrast math", () => {
  it("matches the WCAG reference values", () => {
    expect(contrast([0, 0, 0], [1, 1, 1])).toBeCloseTo(21, 5);
    expect(contrast(parseHex("#767676"), [1, 1, 1])).toBeCloseTo(4.54, 2);
    expect(contrast(parseHex("#595959"), [1, 1, 1])).toBeCloseTo(7.0, 1);
  });

  it("composites translucent layers over what is under them", () => {
    expect(ratio("dark", "foreground/0", ["card"])).toBeCloseTo(1, 5);
  });
});
