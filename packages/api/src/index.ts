import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";

type RedactableErrorShape = {
  message: string;
  data: object;
};

/**
 * Client-facing error shape: stacks are stripped from EVERY error (they expose
 * bundle module names and line numbers), and internal errors also lose their
 * message, which can echo SQL or upstream response bodies.
 */
export function redactInternalErrorShape<T extends RedactableErrorShape>(
  shape: T,
  code: string,
): T {
  const data = { ...shape.data } as Record<string, unknown>;
  delete data.stack;
  if (code !== "INTERNAL_SERVER_ERROR") return { ...shape, data } as T;
  return { ...shape, message: "Internal server error", data } as T;
}

/**
 * A failed input parse surfaces the ZodError's JSON dump as its message, which
 * the dashboard would toast verbatim. Return the issue messages instead, or
 * null when the cause is not a validation error.
 */
export function validationErrorMessage(cause: unknown): string | null {
  if (typeof cause !== "object" || cause === null || !("issues" in cause)) return null;
  const { issues } = cause as { issues: unknown };
  if (!Array.isArray(issues)) return null;
  const messages = issues
    .map((issue) => (issue as { message?: unknown } | null)?.message)
    .filter((message): message is string => typeof message === "string" && message !== "");
  return messages.length > 0 ? [...new Set(messages)].join("; ") : null;
}

export const t = initTRPC.context<Context>().create({
  // tRPC infers dev mode from NODE_ENV, which Workers never set — so without
  // this every error response would carry a stack trace in production.
  isDev: false,
  errorFormatter({ shape, error }) {
    const redacted = redactInternalErrorShape(shape, error.code);
    const readable = error.code === "BAD_REQUEST" ? validationErrorMessage(error.cause) : null;
    return readable ? { ...redacted, message: readable } : redacted;
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
