/**
 * Pure renderers for the Dirework design tokens.
 *
 * `generate.ts` does the file I/O; this module only turns `tokens.json` into
 * strings, so the web test suite can import it and assert the committed files
 * match (apps/web/src/lib/__tests__/design-tokens.test.ts). Keep it free of
 * Node and Bun APIs: it is type-checked by the web app's `tsc`.
 */

export type ColorScheme = Record<string, string>;

export interface DesignTokens {
  meta: { name: string; version: string; description: string };
  color: {
    brand: Record<string, string>;
    brandDark: Record<string, string>;
    semantic: Record<string, string>;
    phase: Record<string, string>;
    partner: { twitch: string; twitchHover: string } & Record<string, string>;
    /** Bot console (`/bot/<token>`): a fixed dark terminal that never follows the theme. */
    console: Record<string, string>;
    /**
     * Bot dock (`/bot/<token>?view=dock`): OBS Studio's default dark theme (Yami,
     * obs-studio `frontend/data/themes/Yami.obt`), so the dock looks native in OBS.
     */
    obs: Record<string, string>;
    scheme: { light: ColorScheme; dark: ColorScheme };
  };
  font: {
    family: Record<string, string>;
    size: Record<string, number>;
    lineHeight: Record<string, number>;
  };
  tracking: Record<string, string>;
  radius: Record<string, number> & { lg: number };
  motion: {
    easing: Record<string, string>;
    animation: Record<string, { keyframes: string; duration: number; easing: string }>;
  };
  layout: {
    container: Record<string, string>;
    spacing: Record<string, string>;
  };
  z: Record<string, number>;
  overlay: {
    ringShape: string;
    squircleRadius: number;
    defaultTheme: string;
    themes: Record<string, { bg: string; accent: string; text: string; username: string }>;
  };
}

export type CssTarget = "web" | "docs";

/** Repo-relative paths of every generated file. */
export const OUTPUTS = {
  web: "apps/web/src/tokens.generated.css",
  webHex: "apps/web/src/tokens.generated.ts",
  docs: "apps/fumadocs/src/app/tokens.generated.css",
  overlayThemes: "apps/fumadocs/src/app/(home)/_widgets/overlay-themes.generated.ts",
  shareCardHex: "packages/overlay-kit/src/share-card-colors.generated.ts",
} as const;

/**
 * `color.scheme` keys the web app needs as hex (`OUTPUTS.webHex`), where a CSS variable
 * can't reach: the manifest and theme-color tags take the background, and the crash page
 * (`global-error.tsx`, which may render without the stylesheet) takes all four. `input` is
 * the border of a dark outline button (ui/button.tsx).
 */
const HEX_KEYS = ["background", "foreground", "muted-foreground", "input"] as const;

/**
 * Type steps Tailwind already ships (tailwindcss/theme.css). tokens.json lists
 * them for reference; only the steps outside this list are emitted.
 * design-tokens.test.ts checks the listed values against Tailwind's own file.
 */
export const TAILWIND_TEXT_STEPS = [
  "xs",
  "sm",
  "base",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "6xl",
  "7xl",
  "8xl",
  "9xl",
] as const;

/** Keyframe bodies referenced by `motion.animation.*.keyframes`. */
const KEYFRAMES: Record<string, string[]> = {
  "console-rise": [
    "from {",
    "  opacity: 0;",
    "  transform: translateY(10px);",
    "}",
    "to {",
    "  opacity: 1;",
    "  transform: translateY(0);",
    "}",
  ],
};

const BANNER_LINES = [
  "Dirework Design System — GENERATED FILE. Do not edit by hand.",
  "Source: design-system/tokens.json",
  "Run `bun run tokens` to regenerate.",
];

/** camelCase → kebab-case (`longBreak` → `long-break`). */
export function kebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/** px → rem at the 16px root (`11` → `0.6875rem`). */
export function rem(px: number): string {
  return `${px / 16}rem`;
}

/** Lowercases hex colors and turns a `{name}` alias into `var(--name)`. */
export function cssValue(value: string): string {
  const alias = /^\{([a-z0-9-]+)\}$/i.exec(value);
  if (alias) return `var(--${alias[1]})`;
  if (/^#[0-9a-f]{3,8}$/i.test(value)) return value.toLowerCase();
  return value;
}

/** A 0–1 channel as two hex digits, clipped to the sRGB gamut. */
function hexByte(channel: number): string {
  return Math.round(Math.min(1, Math.max(0, channel)) * 255)
    .toString(16)
    .padStart(2, "0");
}

/**
 * An `oklch(L C H)` token (alpha as ` / N%`) as sRGB hex: `#rrggbb`, or `#rrggbbaa` when
 * translucent. OKLab → LMS → linear sRGB with Björn Ottosson's matrices, the same math
 * tokens-contrast.test.ts measures with; a channel outside the sRGB gamut is clipped.
 */
export function oklchToHex(value: string): string {
  const m = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+)%)?\)$/.exec(value);
  if (!m) throw new Error(`not an oklch() literal: ${value}`);
  const [L, C, hue] = [Number(m[1]), Number(m[2]), (Number(m[3]) * Math.PI) / 180];
  const a = C * Math.cos(hue);
  const b = C * Math.sin(hue);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mid = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * mid + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mid - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mid + 1.707614701 * s,
  ];
  const encode = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  const alpha = m[4] === undefined ? "" : hexByte(Number(m[4]) / 100);
  return `#${linear.map((c) => hexByte(encode(c))).join("")}${alpha}`;
}

function block(selector: string, lines: string[], indent = ""): string[] {
  return [`${indent}${selector} {`, ...lines.map((l) => `${indent}  ${l}`), `${indent}}`];
}

function decls(entries: [string, string][]): string[] {
  return entries.map(([name, value]) => `--${name}: ${value};`);
}

function schemeDecls(scheme: ColorScheme): string[] {
  return decls(Object.entries(scheme).map(([k, v]) => [k, cssValue(v)]));
}

function rootDecls(tokens: DesignTokens, target: CssTarget): string[] {
  const { phase, partner } = tokens.color;
  return [
    ...schemeDecls(tokens.color.scheme.light),
    ...(target === "web" ? decls([["radius", rem(tokens.radius.lg)]]) : []),
    ...decls(Object.entries(phase).map(([k, v]) => [`phase-${kebab(k)}`, cssValue(v)])),
    ...decls([
      ["twitch", cssValue(partner.twitch)],
      ["twitch-hover", cssValue(partner.twitchHover)],
    ]),
    ...decls(Object.entries(tokens.z).map(([k, v]) => [`z-${kebab(k)}`, String(v)])),
  ];
}

function themeInlineDecls(tokens: DesignTokens, target: CssTarget): string[] {
  const { scheme, partner } = tokens.color;
  const lines = [
    ...decls(Object.keys(scheme.light).map((k) => [`color-${k}`, `var(--${k})`])),
    // Not theme-dependent, so the literal is inlined into `.bg-twitch` etc.
    ...decls([
      ["color-twitch", cssValue(partner.twitch)],
      ["color-twitch-hover", cssValue(partner.twitchHover)],
    ]),
  ];
  if (target === "web") {
    // The bot console is always dark, so its colors are literals like twitch.
    lines.push(
      ...decls(
        Object.entries(tokens.color.console).map(([k, v]) => [
          `color-console-${kebab(k)}`,
          cssValue(v),
        ]),
      ),
    );
    // The bot dock wears OBS's Yami palette in every app theme: literals too.
    lines.push(
      ...decls(
        Object.entries(tokens.color.obs).map(([k, v]) => [`color-obs-${kebab(k)}`, cssValue(v)]),
      ),
    );
    // Offsets from `--radius` (= radius.lg), so the whole scale follows the knob.
    for (const [step, px] of Object.entries(tokens.radius)) {
      const offset = px - tokens.radius.lg;
      const value =
        offset === 0
          ? "var(--radius)"
          : `calc(var(--radius) ${offset < 0 ? "-" : "+"} ${Math.abs(offset)}px)`;
      lines.push(`--radius-${step}: ${value};`);
    }
  }
  return lines;
}

function themeStaticDecls(tokens: DesignTokens): string[] {
  const lines: string[] = [];
  const defaults: readonly string[] = TAILWIND_TEXT_STEPS;
  for (const [step, px] of Object.entries(tokens.font.size)) {
    if (defaults.includes(step)) continue;
    lines.push(`--text-${step}: ${rem(px)};`);
    const lh = tokens.font.lineHeight[step];
    if (lh !== undefined) lines.push(`--text-${step}--line-height: ${rem(lh)};`);
  }
  for (const [name, value] of Object.entries(tokens.tracking)) {
    lines.push(`--tracking-${name}: ${value};`);
  }
  for (const [name, value] of Object.entries(tokens.motion.easing)) {
    lines.push(`--ease-${name}: ${value};`);
  }
  const keyframes = new Set<string>();
  for (const [name, anim] of Object.entries(tokens.motion.animation)) {
    if (!KEYFRAMES[anim.keyframes]) {
      throw new Error(`motion.animation.${name}: unknown keyframes "${anim.keyframes}"`);
    }
    if (!tokens.motion.easing[anim.easing]) {
      throw new Error(`motion.animation.${name}: unknown easing "${anim.easing}"`);
    }
    keyframes.add(anim.keyframes);
    lines.push(
      `--animate-${name}: ${anim.keyframes} ${anim.duration / 1000}s var(--ease-${anim.easing}) both;`,
    );
  }
  for (const [name, value] of Object.entries(tokens.layout.container)) {
    lines.push(`--container-${name}: ${value};`);
  }
  for (const [name, value] of Object.entries(tokens.layout.spacing)) {
    lines.push(`--spacing-${name}: ${value};`);
  }
  for (const name of keyframes) {
    lines.push("", ...block(`@keyframes ${name}`, KEYFRAMES[name] ?? []));
  }
  return lines;
}

const TARGET_NOTES: Record<CssTarget, string[]> = {
  web: ["Imported by apps/web/src/index.css."],
  docs: [
    "Imported by apps/fumadocs/src/app/global.css, which maps these onto the",
    "fumadocs (--color-fd-*) and landing-page (--bg-*, --txt-*) names. No radius",
    "scale here: fumadocs-ui compiles its own rounded-* utilities against the",
    "docs theme, so overriding it would restyle every fumadocs component.",
  ],
};

/** Renders one of the two token stylesheets. */
export function renderTokensCss(tokens: DesignTokens, options: { target: CssTarget }): string {
  const { target } = options;
  const dark = schemeDecls(tokens.color.scheme.dark);
  const out = [
    "/*",
    ...[...BANNER_LINES, "", ...TARGET_NOTES[target]].map((l) => (l ? ` * ${l}` : " *")),
    " */",
    "",
    ...block(":root", rootDecls(tokens, target)),
    "",
    ...block(".dark", dark),
  ];
  if (target === "docs") {
    // No class yet (before next-themes hydrates): follow the OS preference.
    out.push(
      "",
      "@media (prefers-color-scheme: dark) {",
      ...block(":root:not(.light)", dark, "  "),
      "}",
    );
  }
  out.push(
    "",
    ...block("@theme inline", themeInlineDecls(tokens, target)),
    "",
    ...block("@theme static", themeStaticDecls(tokens)),
    "",
  );
  // Blank lines inside blocks must not carry the indent.
  return out.map((l) => l.replace(/^\s+$/, "")).join("\n");
}

/** Renders the docs theme-gallery module (Biome-formatted by generate.ts). */
export function renderOverlayThemesTs(tokens: DesignTokens): string {
  const banner = `/*\n * ${BANNER_LINES.join("\n * ")}\n */`;
  const themes = tokens.overlay.themes;
  return [
    banner,
    "",
    `export const OVERLAY_THEMES = ${JSON.stringify(themes, null, 2)} as const;`,
    "",
    "export type OverlayThemeName = keyof typeof OVERLAY_THEMES;",
    "export type OverlayTheme = (typeof OVERLAY_THEMES)[OverlayThemeName];",
    "",
    `export const OVERLAY_THEME_NAMES = ${JSON.stringify(Object.keys(themes))} as OverlayThemeName[];`,
    "",
    `export const DEFAULT_OVERLAY_THEME: OverlayThemeName = ${JSON.stringify(
      tokens.overlay.defaultTheme ?? Object.keys(themes)[0],
    )};`,
    "",
  ].join("\n");
}

/** An object key as Biome prints it: bare when it is an identifier, quoted otherwise. */
function tsKey(name: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);
}

/**
 * Renders the web app's hex module (`OUTPUTS.webHex`): `HEX_KEYS` of both schemes. The
 * output is already Biome-formatted, so design-tokens.test.ts can compare it exactly.
 */
export function renderSchemeHexTs(tokens: DesignTokens): string {
  const schemes = (["light", "dark"] as const).flatMap((scheme) => [
    `  ${scheme}: {`,
    ...HEX_KEYS.map((key) => {
      const value = tokens.color.scheme[scheme][key];
      if (value === undefined) throw new Error(`color.scheme.${scheme}.${key} missing`);
      return `    ${tsKey(key)}: "${oklchToHex(value)}",`;
    }),
    "  },",
  ]);
  return [
    `/*\n * ${BANNER_LINES.join("\n * ")}\n */`,
    "",
    "/**",
    " * `color.scheme` colors as sRGB hex, converted from oklch at generation, for where a CSS",
    " * variable can't reach: the web app manifest, the theme-color tags and the crash page",
    " * (`global-error.tsx`). A translucent token keeps its alpha (`#rrggbbaa`).",
    " */",
    "export const SCHEME_HEX = {",
    ...schemes,
    "} as const;",
    "",
  ].join("\n");
}

/**
 * The dark `color.scheme` keys the social share card paints (`OUTPUTS.shareCardHex`), by the
 * name the card uses. next/og (Satori) can't read CSS variables, so the card takes them as hex.
 */
const SHARE_CARD_KEYS = {
  background: "background",
  surface: "card",
  text: "foreground",
  muted: "muted-foreground",
  border: "border",
  accent: "link",
} as const;

/**
 * Renders the share card's palette module (`OUTPUTS.shareCardHex`) into
 * @dirework/overlay-kit, which can't import the web app's hex module. Already
 * Biome-formatted, so design-tokens.test.ts can compare it exactly.
 */
export function renderShareCardHexTs(tokens: DesignTokens): string {
  const entries = Object.entries(SHARE_CARD_KEYS).map(([name, key]) => {
    const value = tokens.color.scheme.dark[key];
    if (value === undefined) throw new Error(`color.scheme.dark.${key} missing`);
    return `  ${tsKey(name)}: "${oklchToHex(value)}",`;
  });
  return [
    `/*\n * ${BANNER_LINES.join("\n * ")}\n */`,
    "",
    "/**",
    " * The social share card's colors (share-card.tsx): the app's dark `color.scheme` as sRGB",
    " * hex, because next/og can't read CSS variables. `surface` is `--card`, `text`",
    " * `--foreground`, `muted` `--muted-foreground`, `border` `--border` (translucent, so",
    " * `#rrggbbaa`) and `accent` `--link`, the blue that reads as text on the dark surfaces.",
    " */",
    "export const SHARE_CARD_COLORS = {",
    ...entries,
    "} as const;",
    "",
  ].join("\n");
}

/** Every generated file, keyed by its repo-relative path. */
export function renderAll(tokens: DesignTokens): Record<string, string> {
  return {
    [OUTPUTS.web]: renderTokensCss(tokens, { target: "web" }),
    [OUTPUTS.webHex]: renderSchemeHexTs(tokens),
    [OUTPUTS.shareCardHex]: renderShareCardHexTs(tokens),
    [OUTPUTS.docs]: renderTokensCss(tokens, { target: "docs" }),
    [OUTPUTS.overlayThemes]: renderOverlayThemesTs(tokens),
  };
}
