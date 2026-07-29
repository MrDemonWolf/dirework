import { describe, expect, it } from "vitest";

import {
  buildTimerStylesConfig,
  chatMessageSchema,
  cssColorSchema,
  cssLengthSchema,
  fontFamilySchema,
  MAX_CHAT_BYTES,
  MAX_MESSAGE_TEMPLATE_BYTES,
  opacitySchema,
  taskStylesInputSchema,
  timerStylesInputSchema,
  truncateToBytes,
  utf8ByteLength,
} from "../../config-shared";
import { updateTimerConfigInput } from "../input-schemas";

describe("cssColorSchema", () => {
  it.each(["#000000", "#ffffff", "#00aced", "#fff", "#ffffffcc", "rgb(0, 0, 0)", "rgba(1,2,3,0.5)", "hsl(210 50% 40%)", "transparent", "currentColor", "red"])(
    "accepts %s",
    (v) => expect(cssColorSchema.safeParse(v).success).toBe(true),
  );

  // These are the reason the field is an allowlist: every one of them would be
  // injected verbatim into the overlay's inline CSS.
  it.each([
    "red; background: url(https://evil.example/x)",
    "#fff}\n.x{color:red",
    "url(javascript:alert(1))",
    "expression(alert(1))",
    "var(--x); --y: url(evil)",
    "#zzzzzz",
    "",
  ])("rejects %j", (v) => expect(cssColorSchema.safeParse(v).success).toBe(false));

  it("rejects an over-long value", () => {
    expect(cssColorSchema.safeParse(`#${"a".repeat(200)}`).success).toBe(false);
  });
});

describe("cssLengthSchema", () => {
  it.each(["0", "0px", "10px", "100%", "22%", "1.5rem", "48px", "auto", "12px 16px", "0 0 12px 12px", "12px 12px 0 0", "-4px"])(
    "accepts %s",
    (v) => expect(cssLengthSchema.safeParse(v).success).toBe(true),
  );

  it.each([
    "10px; color: red",
    "calc(100% - 10px)",
    "10px 10px 10px 10px 10px", // more than 4 tokens
    "10",                        // bare number with no unit
    "url(x)",
    "",
  ])("rejects %j", (v) => expect(cssLengthSchema.safeParse(v).success).toBe(false));
});

describe("fontFamilySchema", () => {
  it.each(["Montserrat", "Roboto", "IBM Plex Sans", "Helvetica, Arial"])(
    "accepts %s",
    (v) => expect(fontFamilySchema.safeParse(v).success).toBe(true),
  );

  it.each(['Roboto"; background: url(evil)', "Roboto; }", "font\\face"])(
    "rejects %j",
    (v) => expect(fontFamilySchema.safeParse(v).success).toBe(false),
  );
});

describe("opacitySchema", () => {
  it.each([0, 0.5, 1])("accepts %s", (v) => expect(opacitySchema.safeParse(v).success).toBe(true));
  it.each([-0.1, 1.1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects %s",
    (v) => expect(opacitySchema.safeParse(v).success).toBe(false),
  );
});

describe("style schemas accept every shipped default", () => {
  // The regexes must never reject a config the app itself ships, or saving an
  // untouched Theme Center would fail. These rows mirror the .default() values
  // on the timer_style / task_style tables verbatim.
  const defaultTimerStyleRow = {
    id: "singleton",
    width: "300px",
    height: "300px",
    bgColor: "#091533",
    bgOpacity: 0.85,
    bgBorderRadius: "22%",
    ringEnabled: true,
    ringTrackColor: "#ffffff",
    ringTrackOpacity: 0.18,
    ringFillColor: "#00aced",
    ringFillOpacity: 1.0,
    ringWidth: 8,
    ringGap: 6,
    textColor: "#ffffff",
    textOutlineColor: "#000000",
    textOutlineSize: "0px",
    textFontFamily: "Montserrat",
    fontSizeLabel: "18px",
    fontSizeTime: "48px",
    fontSizeCycle: "16px",
  };

  it("round-trips the shipped default timer styles through the input schema", () => {
    const built = buildTimerStylesConfig(defaultTimerStyleRow as never);
    // Guard against the row above silently going empty and making this vacuous.
    expect(built.dimensions.width).toBe("300px");
    expect(built.background.color).toBe("#091533");
    const parsed = timerStylesInputSchema.safeParse(built);
    expect(parsed.success).toBe(true);
  });

  it("accepts every shipped string default individually", () => {
    // Pulled from the .default() values across timer_style / task_style.
    const colors = ["#000000", "#00aced", "#091533", "#12244a", "#1b2b52", "#4a5b82", "#6b8bf5", "#7c8db0", "#eaf2ff", "#ffffff"];
    const lengths = ["0 0 12px 12px", "0px", "100%", "10px", "10px 14px", "12px 12px 0 0", "12px 16px", "14px", "16px", "18px", "1px", "20px", "22%", "22px", "24px", "2px", "300px", "48px", "4px", "52px", "6px", "8px"];
    for (const c of colors) expect(cssColorSchema.safeParse(c).success, c).toBe(true);
    for (const l of lengths) expect(cssLengthSchema.safeParse(l).success, l).toBe(true);
    for (const f of ["Montserrat", "Roboto"]) expect(fontFamilySchema.safeParse(f).success, f).toBe(true);
  });
});

describe("numeric style bounds", () => {
  it("rejects a non-finite ring width", () => {
    const parsed = timerStylesInputSchema.safeParse({
      ring: { width: Number.POSITIVE_INFINITY },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an absurd scroll speed", () => {
    expect(taskStylesInputSchema.safeParse({ scroll: { pixelsPerSecond: 1e9 } }).success).toBe(false);
  });

  it("rejects a negative line count", () => {
    expect(taskStylesInputSchema.safeParse({ display: { numberOfLines: -1 } }).success).toBe(false);
  });
});

describe("timer duration bounds", () => {
  it("accepts a normal 25 minute work phase", () => {
    expect(updateTimerConfigInput.safeParse({ workDuration: 25 * 60 * 1000 }).success).toBe(true);
  });

  it("rejects a duration beyond 24h", () => {
    expect(updateTimerConfigInput.safeParse({ workDuration: 25 * 60 * 60 * 1000 }).success).toBe(false);
  });

  it("rejects non-finite durations", () => {
    expect(updateTimerConfigInput.safeParse({ breakDuration: Number.POSITIVE_INFINITY }).success).toBe(false);
    expect(updateTimerConfigInput.safeParse({ breakDuration: Number.NaN }).success).toBe(false);
  });
});

describe("chat message byte bounds", () => {
  it("accepts a normal template", () => {
    expect(chatMessageSchema.safeParse("Task added, {user}!").success).toBe(true);
  });

  it("rejects a template over the byte cap even when the char count is legal", () => {
    // 200 emoji = 200 chars but 800 bytes — a char-based cap would let it pass.
    const emoji = "🐺".repeat(200);
    expect(emoji.length).toBeLessThanOrEqual(500);
    expect(utf8ByteLength(emoji)).toBeGreaterThan(MAX_MESSAGE_TEMPLATE_BYTES);
    expect(chatMessageSchema.safeParse(emoji).success).toBe(false);
  });
});

describe("truncateToBytes", () => {
  it("leaves a short string untouched", () => {
    expect(truncateToBytes("hello", 100)).toBe("hello");
  });

  it("never exceeds the byte budget", () => {
    const out = truncateToBytes("🐺".repeat(500), MAX_CHAT_BYTES);
    expect(utf8ByteLength(out)).toBeLessThanOrEqual(MAX_CHAT_BYTES);
  });

  it("never splits a multi-byte character", () => {
    // 🐺 is 4 bytes; a 6-byte budget must yield exactly one wolf, not a
    // half-encoded replacement char.
    const out = truncateToBytes("🐺🐺", 6);
    expect(out).toBe("🐺");
    expect(out).not.toContain("�");
  });

  it("handles a budget smaller than the first character", () => {
    expect(truncateToBytes("🐺", 2)).toBe("");
  });
});
