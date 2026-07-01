/// <reference types="@cloudflare/workers-types" />
/// <reference path="../env.d.ts" />
// On Cloudflare Workers, env is accessed via the cloudflare:workers module.
// Binding types are inferred in env.d.ts from packages/infra/alchemy.run.ts.
export { env } from "cloudflare:workers";
