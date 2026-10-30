import { describe, expect, it } from "vitest";

import {
  clampInt,
  clampLength,
  clampPhaseLabel,
  describeLengthLimit,
  lengthIssue,
  OVERLAY_ICON_LABELS,
  OVERLAY_ICONS,
  PHASE_LABEL_MAX_BYTES,
  PHASE_LABEL_MAX_GRAPHEMES,
  phaseLabelIssue,
  TASK_LENGTH_LIMITS,
  TIMER_LENGTH_LIMITS,
  toOverlayIcon,
  unitRange,
} from "../style-limits";
import { limitPlaceholderRepeats, mostRepeatedPlaceholder } from "../chat-text";
import {
  DEFAULT_TASK_STYLES,
  DEFAULT_TIMER_STYLES,
  DEFAULT_PHASE_LABELS,
} from "../config-defaults";

const valueAt = (root: unknown, path: string) =>
  path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], root);

describe("length limits", () => {
  const label = TIMER_LENGTH_LIMITS["fontSizes.label"];
  const padding = TASK_LENGTH_LIMITS["task.padding"];
  const size = TIMER_LENGTH_LIMITS["dimensions.width"];

  it("accepts in-range values in every absolute unit", () => {
    expect(lengthIssue("14px", label)).toBeNull();
    expect(lengthIssue("48px", label)).toBeNull();
    expect(lengthIssue("1.5rem", label)).toBeNull(); // 24px
    expect(lengthIssue(" 20px ", label)).toBeNull();
  });

  it("rejects negatives, out-of-range values and units the field doesn't take", () => {
    expect(lengthIssue("-4px", TASK_LENGTH_LIMITS["task.marginBottom"])).toBe("range");
    expect(lengthIssue("13px", label)).toBe("range");
    expect(lengthIssue("49px", label)).toBe("range");
    expect(lengthIssue("4rem", label)).toBe("range"); // 64px
    expect(lengthIssue("50%", label)).toBe("unit");
    expect(lengthIssue("auto", label)).toBe("format");
    expect(lengthIssue("12", label)).toBe("format");
    expect(lengthIssue("12px 12px", label)).toBe("count");
  });

  it("takes shorthands only where the field allows them, each part in range", () => {
    expect(lengthIssue("10px 14px", padding)).toBeNull();
    expect(lengthIssue("0 0 12px 12px", TASK_LENGTH_LIMITS["body.border.radius"])).toBeNull();
    expect(lengthIssue("10px 49px", padding)).toBe("range");
    expect(lengthIssue("1px 2px 3px 4px 5px", padding)).toBe("count");
  });

  it("keeps vw/vh and % for the timer size, with bounds", () => {
    expect(lengthIssue("50vw", size)).toBeNull();
    expect(lengthIssue("100%", size)).toBeNull();
    expect(lengthIssue("5vh", size)).toBe("range");
    expect(lengthIssue("119px", size)).toBe("range");
    expect(lengthIssue("1201px", size)).toBe("range");
  });

  it("gives the range in the unit typed, for arrow stepping", () => {
    expect(unitRange(label, "px")).toEqual([14, 48]);
    expect(unitRange(label, "rem")).toEqual([14 / 16, 3]);
    expect(unitRange(size, "vw")).toEqual([10, 100]);
    expect(unitRange(label, "%")).toBeNull();
  });

  it("describes each limit for the inline error", () => {
    expect(describeLengthLimit(label)).toBe("14–48px or 2–40vw/vh");
    expect(describeLengthLimit(padding)).toBe("0–48px; up to 4 values");
    expect(describeLengthLimit(size)).toBe("120–1200px, 10–100% or 10–100vw/vh");
  });

  it("every default style value sits inside its limit", () => {
    for (const [path, limit] of Object.entries(TIMER_LENGTH_LIMITS)) {
      expect(lengthIssue(valueAt(DEFAULT_TIMER_STYLES, path) as string, limit), path).toBeNull();
    }
    for (const [path, limit] of Object.entries(TASK_LENGTH_LIMITS)) {
      expect(lengthIssue(valueAt(DEFAULT_TASK_STYLES, path) as string, limit), path).toBeNull();
    }
  });
});

describe("clampLength (read-time)", () => {
  const label = TIMER_LENGTH_LIMITS["fontSizes.label"];
  const margin = TASK_LENGTH_LIMITS["checkbox.margin.top"];
  const padding = TASK_LENGTH_LIMITS["task.padding"];

  it("leaves an in-range value exactly as stored", () => {
    expect(clampLength("1.25rem", label, "20px")).toBe("1.25rem");
  });

  it("moves an out-of-range value to the nearest bound", () => {
    expect(clampLength("-6px", margin, "4px")).toBe("0px");
    expect(clampLength("300px", label, "20px")).toBe("48px");
    expect(clampLength("10rem", label, "20px")).toBe("48px");
    expect(clampLength("4px 90px", padding, "10px 14px")).toBe("4px 48px");
    expect(clampLength("500vw", TIMER_LENGTH_LIMITS["dimensions.width"], "300px")).toBe("100vw");
  });

  it("checks every part's unit before any part's range, so a shorthand never half-clamps", () => {
    expect(lengthIssue("80px 10%", padding)).toBe("unit");
    expect(lengthIssue("10% 80px", padding)).toBe("unit");
    expect(clampLength("80px 10%", padding, "10px 14px")).toBe("10px 14px");
    expect(clampLength("-4px 2rem 60px", padding, "10px 14px")).toBe("0px 2rem 48px");
  });

  it("always returns a value inside the limit", () => {
    const stored = [
      "80px 10%",
      "-1px -2px -3px -4px",
      "9999pt 1rem",
      "0 0 0 0 0",
      "12px auto",
      "+4px",
      "50vw 50vh",
      "3.33333px",
      "",
    ];
    for (const [path, limit] of Object.entries(TASK_LENGTH_LIMITS)) {
      const fallback = valueAt(DEFAULT_TASK_STYLES, path) as string;
      for (const value of stored) {
        expect(
          lengthIssue(clampLength(value, limit, fallback), limit),
          `${path} ${value}`,
        ).toBeNull();
      }
    }
  });

  it("falls back when the stored value can't be read under the limit", () => {
    expect(clampLength("auto", margin, "4px")).toBe("4px");
    expect(clampLength("50%", label, "20px")).toBe("20px");
    expect(clampLength("1px 1px", label, "20px")).toBe("20px");
    expect(clampLength(undefined as unknown as string, label, "20px")).toBe("20px");
  });

  it("clampInt rounds and bounds, and a non-finite value falls back", () => {
    expect(clampInt(200, [0, 40], 14)).toBe(40);
    expect(clampInt(-3, [0, 40], 14)).toBe(0);
    expect(clampInt(Number.NaN, [0, 40], 14)).toBe(14);
  });
});

describe("overlay icons", () => {
  it("every icon has a label", () => {
    expect(Object.keys(OVERLAY_ICON_LABELS).sort()).toEqual([...OVERLAY_ICONS].sort());
  });

  it("reads ids, known old glyphs, and anything else as the fallback", () => {
    expect(toOverlayIcon("star", "dot")).toBe("star");
    expect(toOverlayIcon("✔", "dot")).toBe("check");
    expect(toOverlayIcon("•", "check")).toBe("dot");
    expect(toOverlayIcon("🐾", "dot")).toBe("paw-print");
    expect(toOverlayIcon("<b>", "dot")).toBe("dot");
    expect(toOverlayIcon(null, "check")).toBe("check");
  });
});

describe("phase labels", () => {
  it("count user-perceived characters, not code units", () => {
    expect(phaseLabelIssue("a".repeat(PHASE_LABEL_MAX_GRAPHEMES))).toBeNull();
    expect(phaseLabelIssue("a".repeat(PHASE_LABEL_MAX_GRAPHEMES + 1))).toBe("graphemes");
    // 12 flags: 12 graphemes but 96 bytes.
    expect(phaseLabelIssue("🇺🇸".repeat(12))).toBe("bytes");
    // 2 family emoji (25 bytes each): 2 graphemes, over the byte cap.
    expect(phaseLabelIssue("👨‍👩‍👧‍👦".repeat(2))).toBe("bytes");
    expect(phaseLabelIssue("👋🏽".repeat(4))).toBeNull();
  });

  it("every default label fits", () => {
    for (const label of Object.values(DEFAULT_PHASE_LABELS)) {
      expect(phaseLabelIssue(label), label).toBeNull();
    }
  });

  it("clamps a stored label to both caps without splitting a character", () => {
    expect(clampPhaseLabel("Gathering the Pack!")).toBe("Gathering the Pa");
    const flags = clampPhaseLabel("🇺🇸".repeat(12));
    expect(new TextEncoder().encode(flags).length).toBeLessThanOrEqual(PHASE_LABEL_MAX_BYTES);
    expect(flags).toBe("🇺🇸".repeat(6));
    expect(clampPhaseLabel("Focus")).toBe("Focus");
  });
});

describe("placeholder repeats", () => {
  it("finds the most repeated placeholder", () => {
    expect(mostRepeatedPlaceholder("{user} {task} {user}")).toEqual({ name: "user", count: 2 });
    expect(mostRepeatedPlaceholder("plain")).toBeNull();
  });

  it("drops every use past the fourth", () => {
    expect(limitPlaceholderRepeats("{user}{user}{user}{user}{user}{user} hi {task}")).toBe(
      "{user}{user}{user}{user} hi {task}",
    );
    expect(limitPlaceholderRepeats("{user} {task}")).toBe("{user} {task}");
  });
});
