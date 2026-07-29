import { createContext } from "@dirework/api/context";
import { appRouter } from "@dirework/api/routers/index";
import { createAuth } from "@dirework/auth";
import { env } from "@dirework/env/server";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { botOAuth } from "./routes/bot-oauth";
import { requestLogger } from "./lib/logger";
import { rateLimiter } from "./lib/rate-limit";

/**
 * Global request-body cap. Every real request here is small — tRPC inputs are
 * zod-bounded (chat messages max 600 chars, tokens max 128) and the auth routes
 * take form posts — so this only ever rejects abuse. Enforced before any
 * handler parses or buffers the body.
 */
const MAX_BODY_BYTES = 128 * 1024;

const app = new Hono();

app.use(requestLogger());
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

app.get("/health", (c) => c.json({ status: "ok" }));

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, context) => {
      return createContext({ context });
    },
  }),
);

app.get("/", (c) => {
  return c.text("OK");
});

export default app;
