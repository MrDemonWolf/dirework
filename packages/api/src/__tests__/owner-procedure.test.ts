import { describe, expect, it } from "vitest";

import type { Context } from "../context";
// The REAL production procedures — not a re-implementation. `../index` only
// type-imports the context, so it loads cleanly under Node/Vitest.
import { ownerProcedure, protectedProcedure, publicProcedure, router } from "../index";

/**
 * Minimal router exercising each procedure tier through the real tRPC pipeline
 * via createCaller, so the middleware chain (not a copy of it) is under test.
 */
const testRouter = router({
  open: publicProcedure.query(() => "public-ok"),
  signedIn: protectedProcedure.query(() => "protected-ok"),
  ownerOnly: ownerProcedure.query(() => "owner-ok"),
  ownerMutation: ownerProcedure.mutation(() => "mutated"),
});

/** A context shaped like the real one, with only what the middleware reads. */
function ctxWith(session: unknown): Context {
  return { session, db: {} } as unknown as Context;
}

const ownerSession = { user: { id: "u1", isOwner: true } };
const nonOwnerSession = { user: { id: "u2", isOwner: false } };
/** A user row predating the isOwner field — must NOT be treated as owner. */
const legacySession = { user: { id: "u3" } };

describe("ownerProcedure", () => {
  it("allows an owner session through", async () => {
    const caller = testRouter.createCaller(ctxWith(ownerSession));
    await expect(caller.ownerOnly()).resolves.toBe("owner-ok");
    await expect(caller.ownerMutation()).resolves.toBe("mutated");
  });

  it("rejects an authenticated NON-owner with FORBIDDEN", async () => {
    const caller = testRouter.createCaller(ctxWith(nonOwnerSession));
    await expect(caller.ownerOnly()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.ownerMutation()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("fails closed when isOwner is missing entirely", async () => {
    const caller = testRouter.createCaller(ctxWith(legacySession));
    await expect(caller.ownerOnly()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("fails closed on a truthy-but-not-true isOwner", async () => {
    // Guards the strict `!== true` check against a coerced value from storage.
    const caller = testRouter.createCaller(ctxWith({ user: { id: "u4", isOwner: 1 } }));
    await expect(caller.ownerOnly()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects an anonymous caller with UNAUTHORIZED, not FORBIDDEN", async () => {
    // Ordering matters: the session check runs first, so an unauthenticated
    // caller never reaches the ownership check and can't probe it.
    const caller = testRouter.createCaller(ctxWith(null));
    await expect(caller.ownerOnly()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("leaves public procedures reachable without any session", async () => {
    const caller = testRouter.createCaller(ctxWith(null));
    await expect(caller.open()).resolves.toBe("public-ok");
  });

  it("still lets a non-owner through plain protectedProcedure", async () => {
    // Documents the distinction the tiers encode: protectedProcedure gates on
    // authentication only; ownership is a separate, stricter gate.
    const caller = testRouter.createCaller(ctxWith(nonOwnerSession));
    await expect(caller.signedIn()).resolves.toBe("protected-ok");
  });
});
