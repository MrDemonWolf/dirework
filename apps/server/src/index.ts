import { createContext } from "@dirework/api/context";
import { appRouter } from "@dirework/api/routers/index";
import { createAuth } from "@dirework/auth";
import { env } from "@dirework/env/server";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { botOAuth } from "./routes/bot-oauth";
import { requestLogger } from "./lib/logger";

const app = new Hono();

app.use(requestLogger());
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
