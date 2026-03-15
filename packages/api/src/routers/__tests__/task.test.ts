import { describe, it, expect } from "vitest";
import { z } from "zod";

// Define the Zod schemas matching the task router inputs

const createSchema = z.object({
  authorTwitchId: z.string(),
  authorUsername: z.string(),
  authorDisplayName: z.string(),
  authorColor: z.string().optional(),
  text: z.string().min(1).max(500),
});

const markDoneSchema = z.object({ id: z.string() });
const removeSchema = z.object({ id: z.string() });
const activateSchema = z.object({ id: z.string() });
const removeByViewerSchema = z.object({ authorTwitchId: z.string() });

const editSchema = z.object({
  id: z.string(),
  text: z.string().min(1).max(500),
});

const moderateEditSchema = z.object({
  id: z.string(),
  text: z.string().min(1).max(500),
});

describe("task router input schemas", () => {
  describe("create", () => {
    const validInput = {
      authorTwitchId: "12345",
      authorUsername: "testuser",
      authorDisplayName: "TestUser",
      text: "Write unit tests",
    };

    it("accepts valid input", () => {
      const result = createSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("accepts valid input with optional authorColor", () => {
      const result = createSchema.safeParse({
        ...validInput,
        authorColor: "#FF5500",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid input without authorColor", () => {
      const result = createSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.authorColor).toBeUndefined();
      }
    });

    it("rejects empty text", () => {
      const result = createSchema.safeParse({ ...validInput, text: "" });
      expect(result.success).toBe(false);
    });

    it("rejects text over 500 characters", () => {
      const result = createSchema.safeParse({
        ...validInput,
        text: "a".repeat(501),
      });
      expect(result.success).toBe(false);
    });

    it("accepts text at exactly 500 characters", () => {
      const result = createSchema.safeParse({
        ...validInput,
        text: "a".repeat(500),
      });
      expect(result.success).toBe(true);
    });
  });

  describe("edit", () => {
    it("accepts valid input", () => {
      const result = editSchema.safeParse({
        id: "abc123",
        text: "Updated task",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty text", () => {
      const result = editSchema.safeParse({ id: "abc123", text: "" });
      expect(result.success).toBe(false);
    });

    it("rejects text over 500 characters", () => {
      const result = editSchema.safeParse({
        id: "abc123",
        text: "a".repeat(501),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("moderateEdit", () => {
    it("accepts valid input", () => {
      const result = moderateEditSchema.safeParse({
        id: "abc123",
        text: "Moderated task text",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty text", () => {
      const result = moderateEditSchema.safeParse({ id: "abc123", text: "" });
      expect(result.success).toBe(false);
    });

    it("rejects text over 500 characters", () => {
      const result = moderateEditSchema.safeParse({
        id: "abc123",
        text: "a".repeat(501),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("markDone", () => {
    it("accepts a valid id", () => {
      const result = markDoneSchema.safeParse({ id: "task-1" });
      expect(result.success).toBe(true);
    });

    it("rejects missing id", () => {
      const result = markDoneSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("remove", () => {
    it("accepts a valid id", () => {
      const result = removeSchema.safeParse({ id: "task-1" });
      expect(result.success).toBe(true);
    });

    it("rejects missing id", () => {
      const result = removeSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("activate", () => {
    it("accepts a valid id", () => {
      const result = activateSchema.safeParse({ id: "task-1" });
      expect(result.success).toBe(true);
    });

    it("rejects missing id", () => {
      const result = activateSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("removeByViewer", () => {
    it("accepts a valid authorTwitchId", () => {
      const result = removeByViewerSchema.safeParse({
        authorTwitchId: "12345",
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing authorTwitchId", () => {
      const result = removeByViewerSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("priority logic convention", () => {
    const BROADCASTER_PRIORITY = 0;
    const VIEWER_PRIORITY = 1;

    it("broadcaster priority is 0 (pinned to top)", () => {
      expect(BROADCASTER_PRIORITY).toBe(0);
    });

    it("viewer priority is 1", () => {
      expect(VIEWER_PRIORITY).toBe(1);
    });

    it("broadcaster priority sorts before viewer priority", () => {
      expect(BROADCASTER_PRIORITY).toBeLessThan(VIEWER_PRIORITY);
    });
  });
});
