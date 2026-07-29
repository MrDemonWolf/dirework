import { createContext } from "@dirework/api/context";
import { appRouter } from "@dirework/api/routers/index";
import { createAuth } from "@dirework/auth";
import { env } from "@dirework/env/server";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { botOAuth } from "./routes/bot-oauth";
import { getRequestId, requestLogger } from "./lib/logger";
import { rateLimiter } from "./lib/rate-limit";
import { recordError, recordMetric } from "./lib/telemetry";

/**
 * Global request-body cap. Every real request here is small — tRPC inputs are
 * zod-bounded (chat messages max 600 chars, tokens max 128) and the auth routes
 * take form posts — so this only ever rejects abuse. Enforced before any
 * handler parses or buffers the body.
 */
const MAX_BODY_BYTES = 128 * 1024;

const app = new Hono();

app.use(requestLogger());
/**
 * Security headers on the API worker, mirroring the web worker's (P2.16). This
 * origin only ever returns JSON and OAuth redirects — never HTML — so the CSP
 * is locked all the way down and framing is denied outright. `nosniff` matters
 * most here: it stops a JSON response being coerced into an executable type.
 */
app.use(
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
    },
    xFrameOptions: "DENY",
    xContentTypeOptions: "nosniff",
    referrerPolicy: "strict-origin-when-cross-origin",
    strictTransportSecurity: "max-age=63072000; includeSubDomains; preload",
  }),
);
app.use(
  bodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: (c) => c.json({ error: "Payload too large" }, 413),
  }),
);
// Abuse brake on the public/token-gated surface. Runs before CORS and the
// route handlers so a flood is rejected as cheaply as possible.
app.use(rateLimiter());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => createAuth().handler(c.req.raw));

// Bot-account OAuth (second Twitch OAuth flow) — mounted before tRPC.
app.route("/api/bot", botOAuth);

/**
 * Liveness: is this worker running at all? No dependencies on purpose — a D1
 * outage must not make the worker look dead and trigger a pointless redeploy.
 */
app.get("/health", (c) => c.json({ status: "ok" }));

/**
 * Readiness: can we actually serve traffic? Pings D1 with the cheapest possible
 * query. Returns 503 (not 500) when the database is unreachable so a checker can
 * distinguish "starting/degraded" from "broken". The error body is deliberately
 * generic — the D1 error text can echo SQL.
 */
app.get("/ready", async (c) => {
  try {
    // Straight at the D1 binding — the cheapest possible round trip, and it
    // avoids pulling drizzle into the worker just for a health probe.
    await env.DB.prepare("select 1").first();
    return c.json({ status: "ready", db: "ok" });
  } catch (error) {
    recordMetric("db.error", { requestId: getRequestId(c), label: "readiness" });
    recordError({ error, requestId: getRequestId(c), url: c.req.url, reason: "readiness_db_ping" });
    return c.json({ status: "degraded", db: "unreachable" }, 503);
  }
});

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, context) => {
      return createContext({ context });
    },
    // tRPC handles its own errors, so they never reach app.onError — this is
    // the only place procedure failures can be counted. Only the tRPC error
    // CODE becomes a label (a closed set); the message never does, since it can
    // carry task text or a Twitch response body.
    onError: ({ error, ctx: _ctx, path: _path }) => {
      recordMetric("db.error", { label: error.code });
      recordError({ error, reason: error.code });
    },
  }),
);

app.get("/", (c) => {
  return c.text("OK");
});

/**
 * Last-resort error handler. Logs a REDACTED record (error name only — never
 * the message or stack, which can echo SQL, URLs with OAuth codes, or user
 * text) and returns a generic body carrying just the request id, so an operator
 * can correlate a user report with the log line without anything leaking to the
 * client.
 */
app.onError((error, c) => {
  const requestId = getRequestId(c);
  recordError({ error, requestId, url: c.req.url });
  return c.json({ error: "Internal server error", requestId }, 500);
});

export default app;
