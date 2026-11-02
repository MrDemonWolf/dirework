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
 * overlays, computed against the background that text actually renders on
 * (mirrors task-list-display.tsx and timer-display.tsx):
 *
 *   - the header and the body are translucent over the stream; the task group
 *     (`task.background`) is composited over the body;
 *   - the fallback username sits on the author header, which tints that group
 *     with the username color itself (AUTHOR_HEADER_TINT_PERCENT);
 *   - the focus row is a username-color tint over the group (its task text and
 *     "Active" label sit on it); a "Started" row has no tint;
 *   - done text sits on `taskDone.background` composited over that group.
 *
 * A preset can't know the stream behind the overlay, so every check runs with the
 * translucent layers composited over BOTH extremes, black and white.
 *
 * The bar: every piece of text meets AA (4.5:1; 3:1 only for large text). The
 * primary text — task text (on its own row and on the focus tint), the "Tasks"
 * header, the "Started" label and the timer digits — also meets AAA (7:1). The
 * username, "Active" label, counters and done text are secondary by design and
 * stay at AA where AAA would wash a preset's accent out.
 */

const AA_NORMAL_TEXT = 4.5;
/** WCAG AA for large text: at least 24px regular (18pt). */
const AA_LARGE_TEXT = 3;
const AAA_NORMAL_TEXT = 7;

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

const STREAMS = [
  ["a black stream", "#000000"],
  ["a white stream", "#ffffff"],
] as const;

describe.each(themePresets)("$name preset task overlay contrast", (preset) => {
  const styles = preset.taskStyles;

  describe.each(STREAMS)("over %s", (_name, behind) => {
    const stream = parseHex(behind);
    const body = composite(
      parseHex(styles.body.background.color),
      styles.body.background.opacity,
      stream,
    );
    const group = composite(
      parseHex(styles.task.background.color),
      styles.task.background.opacity,
      body,
    );
    const header = composite(
      parseHex(styles.header.background.color),
      styles.header.background.opacity,
      stream,
    );
    const username = parseHex(styles.task.usernameColor);
    const taskText = parseHex(styles.task.fontColor);
    const authorHeader = composite(username, AUTHOR_HEADER_TINT_PERCENT / 100, group);
    const activeRow = composite(username, ACTIVE_ROW_TINT_PERCENT / 100, group);
    const doneRow = composite(
      parseHex(styles.taskDone.background.color),
      styles.taskDone.background.opacity,
      group,
    );

    it("task text meets AAA", () => {
      expect(contrastRatio(taskText, group)).toBeGreaterThanOrEqual(AAA_NORMAL_TEXT);
    });

    it("task text on the focus-row tint meets AAA", () => {
      expect(contrastRatio(taskText, activeRow)).toBeGreaterThanOrEqual(AAA_NORMAL_TEXT);
    });

    it("done-task text meets AA", () => {
      expect(contrastRatio(parseHex(styles.taskDone.fontColor), doneRow)).toBeGreaterThanOrEqual(
        AA_NORMAL_TEXT,
      );
    });

    it("fallback username color meets AA on the author header", () => {
      expect(contrastRatio(username, authorHeader)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });

    it("header text meets AAA", () => {
      expect(contrastRatio(parseHex(styles.header.fontColor), header)).toBeGreaterThanOrEqual(
        AAA_NORMAL_TEXT,
      );
    });

    // The counters are faded with opacity, so composite the text over what is
    // behind it before measuring.
    it("author {done}/{total} counter meets AA", () => {
      const text = composite(taskText, AUTHOR_COUNT_OPACITY, authorHeader);
      expect(contrastRatio(text, authorHeader)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });

    it("header {done}/{total} counter meets AA", () => {
      const text = composite(parseHex(styles.header.fontColor), HEADER_COUNT_OPACITY, header);
      // Rendered at header.fontSize: WCAG "large text" (>= 24px) needs only 3:1.
      const bar = Number.parseFloat(styles.header.fontSize) >= 24 ? AA_LARGE_TEXT : AA_NORMAL_TEXT;
      expect(contrastRatio(text, header)).toBeGreaterThanOrEqual(bar);
    });

    // The "Active" label is set in the username color on its own row's tint.
    it('"Active" label meets AA on the focus-row tint', () => {
      expect(contrastRatio(username, activeRow)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });

    // A started row has no tint: its "Started" label, also in the username color,
    // sits straight on the author group.
    it('"Started" label meets AAA on the untinted row', () => {
      expect(contrastRatio(username, group)).toBeGreaterThanOrEqual(AAA_NORMAL_TEXT);
    });

    it('"+N more" footer meets AA on the body', () => {
      const text = composite(taskText, MORE_FOOTER_OPACITY, body);
      expect(contrastRatio(text, body)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });
  });
});

/** The timer background is translucent too, so it is checked over both extremes. */
describe.each(themePresets)("$name preset timer contrast", (preset) => {
  const styles = preset.timerStyles;
  const text = parseHex(styles.text.color);

  describe.each(STREAMS)("over %s", (_name, behind) => {
    const bg = composite(
      parseHex(styles.background.color),
      styles.background.opacity,
      parseHex(behind),
    );

    it("label and countdown text meet AAA", () => {
      expect(contrastRatio(text, bg)).toBeGreaterThanOrEqual(AAA_NORMAL_TEXT);
    });

    it("faded cycle counter meets AA", () => {
      const cycle = composite(text, TIMER_CYCLE_OPACITY, bg);
      expect(contrastRatio(cycle, bg)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });
  });
});
