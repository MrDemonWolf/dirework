import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";

type RedactableErrorShape = {
  message: string;
  data: object;
};

export function redactInternalErrorShape<T extends RedactableErrorShape>(
  shape: T,
  code: string,
): T {
  if (code !== "INTERNAL_SERVER_ERROR") return shape;

  const data = { ...shape.data } as Record<string, unknown>;
  delete data.stack;
  return { ...shape, message: "Internal server error", data } as T;
}

export const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return redactInternalErrorShape(shape, error.code);
  },
});

export const router = t.router;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
      cause: "No session",
    });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

/**
 * A valid session AND `user.isOwner`. Dirework is single-tenant — the first
 * Twitch login claims the instance — but "only one user can exist" is an
 * invariant of the auth hook, not an authorization check. This makes the check
 * explicit at the procedure layer so every dashboard read of a secret and every
 * config/task/timer/token mutation is gated on ownership rather than on merely
 * being signed in. Fails closed: anything but `isOwner === true` is FORBIDDEN.
 *
 * `isOwner` comes from the session's user row (better-auth additionalFields),
 * so it reflects the DB at request time — no extra round trip.
 */
export const ownerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.session.user.isOwner !== true) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Owner access required",
    });
  }
  return next({ ctx });
});
