import { TRPCError } from "@trpc/server";
import { getErrorShape } from "@trpc/server/unstable-core-do-not-import";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { t, validationErrorMessage } from "../index";
import { commandAliasesInput } from "../routers/input-schemas";

/** Run the REAL errorFormatter the way tRPC does when building a response. */
function shapeOf(error: TRPCError) {
  return getErrorShape({
    config: t._config,
    error,
    type: "mutation",
    path: "config.updateCommandAliases",
    input: undefined,
    ctx: undefined,
  });
}

/** An input-parse failure, wrapped exactly as tRPC wraps a failed `.input()`. */
function inputError(schema: z.ZodType, value: unknown): TRPCError {
  const parsed = schema.safeParse(value);
  if (parsed.success) throw new Error("expected the input to be rejected");
  return new TRPCError({ code: "BAD_REQUEST", cause: parsed.error });
}

describe("validation error shape", () => {
  it("replaces the raw ZodError JSON with the issue messages", () => {
    const error = inputError(commandAliasesInput, { commandAliases: { t: "t" } });
    // What the toast used to show: the serialized issue list.
    expect(error.message.trim().startsWith("[")).toBe(true);

    const shape = shapeOf(error);
    expect(shape.message).toBe("Invalid aliases: t (recursive)");
    expect(shape.data.code).toBe("BAD_REQUEST");
  });

  it("joins multiple issues and drops duplicates", () => {
    const schema = z.object({
      a: z.string().min(2, "Too short"),
      b: z.string().min(2, "Too short"),
    });
    const shape = shapeOf(inputError(schema, { a: "x", b: "y" }));
    expect(shape.message).toBe("Too short");
  });

  it("leaves hand-written BAD_REQUEST messages alone", () => {
    const shape = shapeOf(new TRPCError({ code: "BAD_REQUEST", message: "Task text is required" }));
    expect(shape.message).toBe("Task text is required");
  });

  it("still redacts internal errors", () => {
    const shape = shapeOf(
      new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "D1_ERROR: select * from task" }),
    );
    expect(shape.message).toBe("Internal server error");
  });

  it("returns null for causes that are not validation errors", () => {
    expect(validationErrorMessage(new Error("boom"))).toBeNull();
    expect(validationErrorMessage({ issues: "nope" })).toBeNull();
    expect(validationErrorMessage({ issues: [{ message: "" }] })).toBeNull();
    expect(validationErrorMessage(null)).toBeNull();
  });
});
