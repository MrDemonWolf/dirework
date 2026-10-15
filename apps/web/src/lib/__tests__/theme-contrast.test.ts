import { describe, expect, it } from "vitest";

import { themePresets } from "../theme-presets";

/**
 * WCAG 2.x contrast for the viewer-facing text every theme preset ships on the
 * task overlay, computed against the background that text actually renders on
 * (mirrors task-list-display.tsx):
 *
 *   - task text + username sit on the author group: `task.background` composited
 *     over `body.background`;
 *   - done text sits on `taskDone.background` composited over that group;
 *   - header text sits on `header.background`.
 *
 * The body and header backgrounds are treated as opaque — what is behind them
 * is the stream itself, which no preset can know.
 */

const AA_NORMAL_TEXT = 4.5;

type Rgb = [number, number, number];

function parseHex(hex: string): Rgb {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`Expected #rrggbb, got ${hex}`);
  return [match[1], match[2], match[3]].map((c) => Number.parseInt(c!, 16)) as Rgb;
}

/** Source-over compositing of `top` at `alpha` onto an opaque `bottom`. */
function composite(top: Rgb, alpha: number, bottom: Rgb): Rgb {
  return top.map((c, i) => c * alpha + bottom[i]! * (1 - alpha)) as Rgb;
}

function relativeLuminance([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr! + 0.7152 * lg! + 0.0722 * lb!;
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe("contrastRatio", () => {
  it("matches the WCAG reference values", () => {
    expect(contrastRatio(parseHex("#000000"), parseHex("#ffffff"))).toBeCloseTo(21, 5);
    expect(contrastRatio(parseHex("#777777"), parseHex("#ffffff"))).toBeCloseTo(4.48, 2);
  });
});

describe.each(themePresets)("$name preset task overlay contrast", (preset) => {
  const styles = preset.taskStyles;
  const body = parseHex(styles.body.background.color);
  const group = composite(
    parseHex(styles.task.background.color),
    styles.task.background.opacity,
    body,
  );
  const doneRow = composite(
    parseHex(styles.taskDone.background.color),
    styles.taskDone.background.opacity,
    group,
  );

  it("task text meets AA", () => {
    expect(contrastRatio(parseHex(styles.task.fontColor), group)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    );
  });

  it("done-task text meets AA", () => {
    expect(contrastRatio(parseHex(styles.taskDone.fontColor), doneRow)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    );
  });

  it("fallback username color meets AA", () => {
    expect(contrastRatio(parseHex(styles.task.usernameColor), group)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    );
  });

  it("header text meets AA", () => {
    expect(
      contrastRatio(parseHex(styles.header.fontColor), parseHex(styles.header.background.color)),
    ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });
});
