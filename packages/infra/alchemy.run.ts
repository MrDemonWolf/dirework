// Run this program under Node (tsx), never Bun — Bun segfaults executing the
// Alchemy program (same failure as Wolfathon). The package scripts and
// deploy.yml both invoke it via tsx directly, bypassing the alchemy CLI's
// runtime detection (which picks bun whenever bun is the package manager).
import alchemy from "alchemy";
import { D1Database, Nextjs, Worker } from "alchemy/cloudflare";
import { config } from "dotenv";

config({ path: "./.env" });
config({ path: "../../apps/web/.env" });
config({ path: "../../apps/server/.env" });

const app = await alchemy("dirework");

const db = await D1Database("database", {
  name: "dirework-db",
  migrationsDir: "../../packages/db/src/migrations",
});

// API worker: dirework-api.<account>.workers.dev
// Serves better-auth (/api/auth/*), tRPC (/trpc/*), and bot OAuth routes.
export const server = await Worker("server", {
  name: "dirework-api",
  cwd: "../../apps/server",
  entrypoint: "src/index.ts",
  compatibility: "node",
  url: true,
  bindings: {
    DB: db,
    CORS_ORIGIN: alchemy.env.CORS_ORIGIN!,
    BETTER_AUTH_SECRET: alchemy.secret.env.BETTER_AUTH_SECRET!,
    BETTER_AUTH_URL: alchemy.env.BETTER_AUTH_URL!,
    TWITCH_CLIENT_ID: alchemy.env.TWITCH_CLIENT_ID!,
    TWITCH_CLIENT_SECRET: alchemy.secret.env.TWITCH_CLIENT_SECRET!,
    DOCS_URL: alchemy.env.DOCS_URL ?? "https://mrdemonwolf.github.io/dirework",
  },
  dev: {
    port: 3000,
  },
});

// Web worker: dirework.<account>.workers.dev
// Next.js dashboard + overlays + bot page. Auth/tRPC proxied same-origin to the
// API worker via next.config rewrites (workers.dev is on the Public Suffix List,
// so cookies cannot span the two workers).
export const web = await Nextjs("web", {
  name: "dirework",
  cwd: "../../apps/web",
  bindings: {
    NEXT_PUBLIC_SERVER_URL: server.url!,
  },
  dev: {
    env: {
      PORT: "3001",
    },
  },
});

console.log(`Web    -> ${web.url}`);
console.log(`Server -> ${server.url}`);

await app.finalize();
