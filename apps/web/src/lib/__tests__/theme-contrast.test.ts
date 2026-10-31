import { describe, expect, it } from "vitest";

import {
  ACTIVE_ROW_TINT_PERCENT,
  AUTHOR_COUNT_OPACITY,
  AUTHOR_HEADER_TINT_PERCENT,
  HEADER_COUNT_OPACITY,
  MORE_FOOTER_OPACITY,
  TIMER_CYCLE_OPACITY,
} from "../overlay-view";
import { themePresets } from "../theme-presets";

/**
 * WCAG 2.x contrast for the viewer-facing text every theme preset ships on the
 * task overlay, computed against the background that text actually renders on
 * (mirrors task-list-display.tsx):
 *
 *   - task text sits on the author group: `task.background` composited over
 *     `body.background`;
 *   - the fallback username sits on the author header, which tints that group
 *     with the username color itself (AUTHOR_HEADER_TINT_PERCENT);
 *   - done text sits on `taskDone.background` composited over that group;
 *   - header text sits on `header.background`.
 *
 * The body and header backgrounds are treated as opaque — what is behind them
 * is the stream itself, which no preset can know.
 */

const AA_NORMAL_TEXT = 4.5;
/** WCAG AA for large text: at least 24px regular (18pt). */
const AA_LARGE_TEXT = 3;

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
  const username = parseHex(styles.task.usernameColor);
  const authorHeader = composite(username, AUTHOR_HEADER_TINT_PERCENT / 100, group);
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
    expect(contrastRatio(username, authorHeader)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it("header text meets AA", () => {
    expect(
      contrastRatio(parseHex(styles.header.fontColor), parseHex(styles.header.background.color)),
    ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  // The counters are faded with opacity, so composite the text over what is
  // behind it before measuring.
  it("author {done}/{total} counter meets AA", () => {
    const text = composite(parseHex(styles.task.fontColor), AUTHOR_COUNT_OPACITY, authorHeader);
    expect(contrastRatio(text, authorHeader)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it("header {done}/{total} counter meets AA", () => {
    const bg = parseHex(styles.header.background.color);
    const text = composite(parseHex(styles.header.fontColor), HEADER_COUNT_OPACITY, bg);
    // Rendered at header.fontSize: WCAG "large text" (>= 24px) needs only 3:1.
    const bar = Number.parseFloat(styles.header.fontSize) >= 24 ? AA_LARGE_TEXT : AA_NORMAL_TEXT;
    expect(contrastRatio(text, bg)).toBeGreaterThanOrEqual(bar);
  });

  // The active row is a static username-color tint over the author group, and
  // its "Active" label is set in the username color itself.
  it('"Active" label meets AA on the active-row tint', () => {
    const activeRow = composite(username, ACTIVE_ROW_TINT_PERCENT / 100, group);
    expect(contrastRatio(username, activeRow)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  // A started row has no tint: its "Started" label, also in the username color,
  // sits straight on the author group.
  it('"Started" label meets AA on the untinted row', () => {
    expect(contrastRatio(username, group)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it('"+N more" footer meets AA on the body', () => {
    const text = composite(parseHex(styles.task.fontColor), MORE_FOOTER_OPACITY, body);
    expect(contrastRatio(text, body)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });
});

/**
 * The timer background is translucent, so the stream shows through it. A preset
 * can't know the stream, so check both extremes: the background composited over
 * black AND over white.
 */
describe.each(themePresets)("$name preset timer contrast", (preset) => {
  const styles = preset.timerStyles;
  const text = parseHex(styles.text.color);

  describe.each([
    ["black", "#000000"],
    ["white", "#ffffff"],
  ])("over %s", (_name, behind) => {
    const bg = composite(
      parseHex(styles.background.color),
      styles.background.opacity,
      parseHex(behind),
    );

    it("label and countdown text meet AA", () => {
      expect(contrastRatio(text, bg)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });

    it("faded cycle counter meets AA", () => {
      const cycle = composite(text, TIMER_CYCLE_OPACITY, bg);
      expect(contrastRatio(cycle, bg)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });
  });
});
