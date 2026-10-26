import { describe, expect, it } from "vitest";

import {
  formatGreeting,
  GREETINGS,
  greetingBucket,
  MAX_GREETING_SUBLINE_CHARS,
  MAX_GREETING_TITLE_CHARS,
  pickGreeting,
  type GreetingBucket,
} from "../greetings";

const BUCKETS = Object.keys(GREETINGS) as GreetingBucket[];
const allLines = BUCKETS.flatMap((bucket) => GREETINGS[bucket]);

describe("greeting pool", () => {
  it("has several lines in every bucket", () => {
    expect(BUCKETS.sort()).toEqual(
      ["afternoon", "earlyMorning", "evening", "lateNight", "morning"].sort(),
    );
    for (const bucket of BUCKETS) expect(GREETINGS[bucket].length).toBeGreaterThanOrEqual(3);
  });

  it("keeps every line under the length caps, with {name} once in each title", () => {
    for (const line of allLines) {
      expect(line.title.split("{name}")).toHaveLength(2);
      expect(line.title.replace("{name}", "").length).toBeLessThanOrEqual(MAX_GREETING_TITLE_CHARS);
      expect(line.subline.length).toBeLessThanOrEqual(MAX_GREETING_SUBLINE_CHARS);
      expect(line.subline).not.toContain("{name}");
    }
  });

  it("is plain text with no emoji", () => {
    for (const line of allLines) {
      expect(line.title + line.subline).toMatch(/^[\x20-\x7e]+$/);
    }
  });
});

describe("greetingBucket", () => {
  it("maps local hours to buckets", () => {
    expect(greetingBucket(0)).toBe("lateNight");
    expect(greetingBucket(3)).toBe("lateNight");
    expect(greetingBucket(4)).toBe("earlyMorning");
    expect(greetingBucket(7)).toBe("earlyMorning");
    expect(greetingBucket(8)).toBe("morning");
    expect(greetingBucket(11)).toBe("morning");
    expect(greetingBucket(12)).toBe("afternoon");
    expect(greetingBucket(16)).toBe("afternoon");
    expect(greetingBucket(17)).toBe("evening");
    expect(greetingBucket(20)).toBe("evening");
    expect(greetingBucket(21)).toBe("lateNight");
    expect(greetingBucket(23)).toBe("lateNight");
  });
});

describe("pickGreeting", () => {
  it("picks from the bucket for the local hour", () => {
    expect(GREETINGS.lateNight).toContain(pickGreeting(new Date(2026, 9, 25, 23, 30)));
    expect(GREETINGS.earlyMorning).toContain(pickGreeting(new Date(2026, 9, 25, 5, 0)));
    expect(GREETINGS.afternoon).toContain(pickGreeting(new Date(2026, 9, 25, 14, 0)));
  });

  it("is stable within a bucket on one local date", () => {
    const first = pickGreeting(new Date(2026, 9, 25, 12, 0, 0));
    expect(pickGreeting(new Date(2026, 9, 25, 13, 15, 42))).toBe(first);
    expect(pickGreeting(new Date(2026, 9, 25, 16, 59, 59))).toBe(first);
  });

  it("varies across days and reaches every line in a bucket", () => {
    for (const bucket of BUCKETS) {
      const hour = { earlyMorning: 5, morning: 9, afternoon: 14, evening: 18, lateNight: 22 }[
        bucket
      ];
      const seen = new Set<string>();
      for (let day = 1; day <= 60; day++) {
        seen.add(pickGreeting(new Date(2026, 0, day, hour)).title);
      }
      expect(seen.size).toBe(GREETINGS[bucket].length);
    }
  });
});

describe("formatGreeting", () => {
  it("fills {name} and leaves the subline alone", () => {
    expect(
      formatGreeting({ title: "Howl's it going, {name}?", subline: "Pick a task." }, "MrDemonWolf"),
    ).toEqual({ title: "Howl's it going, MrDemonWolf?", subline: "Pick a task." });
  });

  it("never treats the name as a replace pattern", () => {
    expect(formatGreeting(GREETINGS.lateNight[0]!, "$&$'").title).toBe("Working late, $&$'");
  });
});
