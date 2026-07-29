import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

import type { DbClient } from "@dirework/db";

import { loadTaskOverlayPayload, loadTimerOverlayPayload } from "../../services/overlay-service";
import { tokenInput, withOverlayToken } from "../../services/tokens";

const tokenSchema = z.object({ token: tokenInput });

/** DbClient stub covering the relational reads the overlay payloads perform. */
function makeOverlayDb(rows: {
  timerState?: Record<string, unknown>;
  timerConfig?: Record<string, unknown>;
  timerStyle?: Record<string, unknown>;
  taskStyle?: Record<string, unknown>;
  tasks?: Record<string, unknown>[];
}): DbClient {
  return {
    query: {
      timerState: { findFirst: async () => rows.timerState },
      timerConfig: { findFirst: async () => rows.timerConfig },
      timerStyle: { findFirst: async () => rows.timerStyle },
      taskStyle: { findFirst: async () => rows.taskStyle },
      task: { findMany: async () => rows.tasks ?? [] },
    },
  } as unknown as DbClient;
}

describe("overlay router input validation", () => {
  describe("token schema (bounded — L3)", () => {
    it("accepts a valid token string", () => {
      expect(tokenSchema.parse({ token: "abc-123-def" })).toEqual({ token: "abc-123-def" });
    });

    it("accepts a UUID token", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      expect(tokenSchema.parse({ token: uuid })).toEqual({ token: uuid });
    });

    it("rejects missing token", () => {
      expect(() => tokenSchema.parse({})).toThrow();
    });

    it("rejects non-string token", () => {
      expect(() => tokenSchema.parse({ token: 123 })).toThrow();
    });

    it("rejects empty string token", () => {
      expect(() => tokenSchema.parse({ token: "" })).toThrow();
    });

    it("rejects tokens shorter than 8 characters", () => {
      expect(() => tokenSchema.parse({ token: "abcdefg" })).toThrow();
    });

    it("rejects tokens longer than 128 characters", () => {
      expect(() => tokenSchema.parse({ token: "a".repeat(129) })).toThrow();
    });

    it("accepts tokens at the boundaries (8 and 128 chars)", () => {
      expect(tokenSchema.parse({ token: "a".repeat(8) })).toEqual({ token: "a".repeat(8) });
      expect(tokenSchema.parse({ token: "a".repeat(128) })).toEqual({ token: "a".repeat(128) });
    });
  });

  // These exercise the REAL payload builders. The previous version of this
  // block asserted on object literals it constructed in the test body, so it
  // passed regardless of what overlay-service actually returned.
  describe("loadTimerOverlayPayload", () => {
    const timerStyleRow = {
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
      ringFillOpacity: 1,
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

    it("returns the timer state plus built config and styles", async () => {
      const db = makeOverlayDb({
        timerState: {
          id: "singleton",
          status: "work",
          currentCycle: 1,
          totalCycles: 4,
          targetEndTime: new Date(Date.now() + 60_000),
          pausedWithRemaining: null,
          pausedFromStatus: null,
        },
        timerConfig: { workDuration: 1_500_000, defaultCycles: 4 },
        timerStyle: timerStyleRow,
      });

      const payload = await loadTimerOverlayPayload(db);

      expect(payload.timerState?.status).toBe("work");
      // Nested shape comes from the real build helpers, not a literal.
      expect(payload.timerConfig?.workDuration).toBe(1_500_000);
      expect(payload.timerStyles?.dimensions.width).toBe("300px");
      expect(payload.timerStyles?.ring.fillColor).toBe("#00aced");
    });

    it("returns nulls rather than throwing when config rows are missing", async () => {
      // A freshly provisioned instance can be polled before its singletons
      // exist; the overlay must render blank, not 500.
      const db = makeOverlayDb({});
      const payload = await loadTimerOverlayPayload(db);
      expect(payload).toEqual({ timerState: null, timerConfig: null, timerStyles: null });
    });
  });

  describe("loadTaskOverlayPayload", () => {
    it("returns tasks in list order with built styles", async () => {
      const db = makeOverlayDb({
        tasks: [
          { id: "1", text: "first", status: "active" },
          { id: "2", text: "second", status: "pending" },
        ],
        taskStyle: { id: "singleton", displayShowDone: true, displayNumberOfLines: 2 },
      });

      const payload = await loadTaskOverlayPayload(db);

      expect(payload.tasks).toHaveLength(2);
      expect(payload.tasks[0]).toMatchObject({ id: "1", text: "first" });
      expect(payload.taskStyles?.display.showDone).toBe(true);
    });

    it("returns an empty list and null styles on a bare instance", async () => {
      const payload = await loadTaskOverlayPayload(makeOverlayDb({}));
      expect(payload.tasks).toEqual([]);
      expect(payload.taskStyles).toBeNull();
    });
  });
});

describe("withOverlayToken gating (real token check)", () => {
  const TOKEN = "a".repeat(32);

  function dbWithTokens(overlayTimerToken: string | undefined) {
    return {
      query: {
        instanceConfig: {
          // undefined = the singleton row doesn't exist yet.
          findFirst: async () =>
            overlayTimerToken === undefined ? undefined : { overlayTimerToken },
        },
      },
    } as unknown as DbClient;
  }

  it("runs the loader when the token matches", async () => {
    const loader = vi.fn(async () => ({ ok: true }));
    const result = await withOverlayToken(dbWithTokens(TOKEN), "timer", TOKEN, loader);
    expect(result).toEqual({ ok: true });
    expect(loader).toHaveBeenCalledOnce();
  });

  it("returns null WITHOUT running the loader on a wrong token", async () => {
    // Overlays render blank rather than erroring, and a bad token must never
    // reach the DB-loading path.
    const loader = vi.fn(async () => ({ ok: true }));
    const result = await withOverlayToken(dbWithTokens(TOKEN), "timer", "b".repeat(32), loader);
    expect(result).toBeNull();
    expect(loader).not.toHaveBeenCalled();
  });

  it("returns null when the instance config row does not exist yet", async () => {
    // Reachable before the singletons are provisioned (first boot). The stored
    // token columns themselves are notNull, so a missing ROW — not a null
    // token — is the real "unprovisioned" case.
    const loader = vi.fn(async () => ({ ok: true }));
    expect(await withOverlayToken(dbWithTokens(undefined), "timer", TOKEN, loader)).toBeNull();
    expect(loader).not.toHaveBeenCalled();
  });
});
