import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  chatDisplayName,
  MAX_DISPLAY_NAME_LENGTH,
  sanitizeDisplayText,
  truncateToLength,
} from "../chat-text";
import {
  cssColorSchema,
  cssLengthSchema,
  fontFamilySchema,
  phaseLabelSchema,
} from "../config-shared";
import { isRestorableAuthor, taskRestoreInput, taskTextInput } from "../routers/input-schemas";

const RLO = "‮";
const ZWSP = "​";
const ZWJ = "‍";
const ZWNJ = "‌";

describe("sanitizeDisplayText", () => {
  it("drops bidi embeddings, overrides and isolates", () => {
    expect(sanitizeDisplayText(`${RLO}gnp.exe`)).toBe("gnp.exe");
    expect(sanitizeDisplayText("a‪b‫c‬d‭e")).toBe("abcde");
    expect(sanitizeDisplayText("⁦a⁧b⁨c⁩")).toBe("abc");
  });

  it("drops invisible zero-width characters", () => {
    expect(sanitizeDisplayText(`a${ZWSP}b﻿c⁠d`)).toBe("abcd");
    expect(sanitizeDisplayText(`${ZWSP}${ZWSP}`)).toBe("");
  });

  it("keeps ZWJ inside emoji sequences", () => {
    for (const emoji of [
      `\u{1F469}${ZWJ}\u{1F4BB}`, // woman technologist
      `\u{1F3F3}️${ZWJ}\u{1F308}`, // rainbow flag (variation selector before the ZWJ)
      `\u{1F9D1}\u{1F3FD}${ZWJ}\u{1F4BB}`, // technologist with a skin tone
      `\u{1F3C3}${ZWJ}♀️`, // woman running
      `\u{1F468}${ZWJ}\u{1F469}${ZWJ}\u{1F467}`, // family
    ]) {
      expect(sanitizeDisplayText(`go ${emoji}!`)).toBe(`go ${emoji}!`);
    }
  });

  it("keeps ZWNJ/ZWJ between letters (Persian, Indic) and drops them elsewhere", () => {
    const persian = `می${ZWNJ}خواهم`;
    expect(sanitizeDisplayText(persian)).toBe(persian);
    const malayalam = `ന്${ZWJ}റ`;
    expect(sanitizeDisplayText(malayalam)).toBe(malayalam);
    expect(sanitizeDisplayText(`${ZWJ}a ${ZWNJ} b${ZWJ}`)).toBe("a  b");
    expect(sanitizeDisplayText(`\u{1F469}${ZWJ} x`)).toBe("\u{1F469} x");
  });

  it("turns control characters and line separators into spaces", () => {
    expect(sanitizeDisplayText("a\tb\nc\u0085d e\u007F")).toBe("a b c d e ");
  });

  it("still trims Zalgo stacks", () => {
    expect(sanitizeDisplayText("Z̷̢̛̖̗")).toBe("Z̷̢");
  });

  it("leaves real text as typed", () => {
    for (const text of [
      "write the intro",
      "việt",
      "שָׁלוֹם",
      "مراجعة الكود",
      "1️⃣ 👍🏽 🇺🇸",
      "日本語のテキスト",
    ]) {
      expect(sanitizeDisplayText(text)).toBe(text);
    }
  });

  it("is idempotent", () => {
    const messy = `${RLO}a${ZWSP}b\u{1F469}${ZWJ}\u{1F4BB}\tc`;
    expect(sanitizeDisplayText(sanitizeDisplayText(messy))).toBe(sanitizeDisplayText(messy));
  });
});

describe("chatDisplayName", () => {
  it("sanitizes and caps at MAX_DISPLAY_NAME_LENGTH", () => {
    expect(chatDisplayName(`${RLO}Viewer`, "viewer")).toBe("Viewer");
    expect(chatDisplayName("x".repeat(40), "viewer")).toHaveLength(MAX_DISPLAY_NAME_LENGTH);
  });

  it("falls back to the login when nothing visible is left", () => {
    expect(chatDisplayName(`${ZWSP}${RLO} `, "viewer")).toBe("viewer");
    expect(chatDisplayName(undefined, "viewer")).toBe("viewer");
  });
});

describe("zod's string .max() counts code points, never more than truncateToLength's units", () => {
  it("a string clamped by truncateToLength always passes .max() with the same cap", () => {
    // Pins the comment on truncateToLength: 4 emoji are 8 UTF-16 units but 4 code
    // points, and zod measures code points, so a unit clamp always fits its cap.
    const emoji = "\u{1F600}".repeat(4);
    expect(z.string().max(4).safeParse(emoji).success).toBe(true);
    expect(z.string().max(3).safeParse(emoji).success).toBe(false);
    const clamped = truncateToLength(emoji, 5);
    expect(clamped.length).toBeLessThanOrEqual(5);
    expect(z.string().max(5).safeParse(clamped).success).toBe(true);
  });
});

describe("CSS allowlists never run the pattern on an oversized string", () => {
  const budgetMs = 5;

  function timed(run: () => unknown): number {
    const start = performance.now();
    run();
    return performance.now() - start;
  }

  it.each([
    ["cssColorSchema", cssColorSchema, `rgb(${" ".repeat(20_000)}`],
    ["cssColorSchema (digits)", cssColorSchema, `hsl(${"1 ".repeat(10_000)}`],
    ["cssLengthSchema", cssLengthSchema, "1px ".repeat(5_000)],
    ["fontFamilySchema", fontFamilySchema, "a".repeat(20_000)],
  ])("%s rejects a 20k string in under 5ms", (_name, schema, input) => {
    // Warm up once so module/JIT setup isn't counted.
    schema.safeParse(input);
    const elapsed = timed(() => expect(schema.safeParse(input).success).toBe(false));
    expect(elapsed).toBeLessThan(budgetMs);
  });

  it("the color pattern itself no longer backtracks on a long unterminated function", () => {
    // Under the cap, so the regex does run: 60 spaces and no ")" must fail fast.
    expect(cssColorSchema.safeParse(`rgb(${" ".repeat(58)}`).success).toBe(false);
    expect(cssColorSchema.safeParse("rgb( 1, 2, 3 )").success).toBe(true);
    expect(cssColorSchema.safeParse("hsla( 210 50% 40% / 0.5)").success).toBe(true);
  });
});

describe("phaseLabelSchema", () => {
  it("strips bidi overrides and invisible characters from a label shown on stream", () => {
    expect(phaseLabelSchema.parse(`${RLO}Focus${ZWSP}`)).toBe("Focus");
  });
});

describe("taskTextInput", () => {
  it("sanitizes the text and refuses text with nothing visible", () => {
    expect(taskTextInput.parse(`  ${RLO}write${ZWSP} it `)).toBe("write it");
    expect(taskTextInput.safeParse(`${ZWSP}${RLO}`).success).toBe(false);
  });
});

describe("taskRestoreInput author fields follow chat's limits", () => {
  const base = {
    id: "t1",
    authorTwitchId: "100",
    authorUsername: "viewer",
    authorDisplayName: "Viewer",
    authorColor: null,
    text: "write the docs",
    status: "pending" as const,
    priority: 1,
    order: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
  };

  it("accepts a chat-shaped author", () => {
    expect(taskRestoreInput.safeParse(base).success).toBe(true);
  });

  it.each([
    ["an id over 32 characters", { authorTwitchId: "1".repeat(33) }],
    ["an id with symbols", { authorTwitchId: "12;34" }],
    ["a login over 25 characters", { authorUsername: "v".repeat(26) }],
    ["a display name over 25 characters", { authorDisplayName: "V".repeat(26) }],
    ["a display name with a control character", { authorDisplayName: "Vi\newer" }],
  ])("rejects %s", (_label, patch) => {
    expect(taskRestoreInput.safeParse({ ...base, ...patch }).success).toBe(false);
  });
});

describe("isRestorableAuthor", () => {
  const owner = { taskId: "ownerkey123", name: "Wolf Streamer" };

  it("accepts a Twitch id + login, or the owner's own key and name", () => {
    expect(isRestorableAuthor({ authorTwitchId: "100", authorUsername: "Viewer_1" }, owner)).toBe(
      true,
    );
    expect(
      isRestorableAuthor({ authorTwitchId: "ownerkey123", authorUsername: "Wolf Streamer" }, owner),
    ).toBe(true);
  });

  it("refuses a made-up id or a login chat could never send", () => {
    expect(isRestorableAuthor({ authorTwitchId: "someone", authorUsername: "viewer" }, owner)).toBe(
      false,
    );
    expect(isRestorableAuthor({ authorTwitchId: "100", authorUsername: "two words" }, owner)).toBe(
      false,
    );
  });
});
