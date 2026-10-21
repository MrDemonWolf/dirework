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
  docs: "apps/fumadocs/src/app/tokens.generated.css",
  overlayThemes: "apps/fumadocs/src/app/(home)/_widgets/overlay-themes.generated.ts",
} as const;

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

/** Every generated file, keyed by its repo-relative path. */
export function renderAll(tokens: DesignTokens): Record<string, string> {
  return {
    [OUTPUTS.web]: renderTokensCss(tokens, { target: "web" }),
    [OUTPUTS.docs]: renderTokensCss(tokens, { target: "docs" }),
    [OUTPUTS.overlayThemes]: renderOverlayThemesTs(tokens),
  };
}
