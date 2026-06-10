import { EventEmitter } from "events";
import Redis from "ioredis";

import { env } from "@dirework/env/server";
import { logger } from "./logger";

// Event bus for cross-router (and cross-instance) communication.
//
// Local mode (default): a plain in-process EventEmitter. Works when Dirework
// runs as a single Node process.
//
// Redis mode (REDIS_URL set): every emit is published to a Redis channel and
// re-emitted locally on *all* instances (including the publisher) when the
// message arrives. This keeps SSE overlay subscriptions, the chat bot, and the
// dashboard in sync even when the app runs with multiple replicas or when the
// bot lives in a separate process.
//
// Emitted events:
//   "timerStateChange" — when timer state changes
//   "taskListChange"   — when tasks are modified
//   "botConfigChange"  — when bot config is saved (reload cache)
export const ee = new EventEmitter();

// Allow many concurrent overlay SSE connections without Node warning
ee.setMaxListeners(200);

export const TIMER_STATE_CHANGE = "timerStateChange";
export const TASK_LIST_CHANGE = "taskListChange";
export const BOT_CONFIG_CHANGE = "botConfigChange";

const KNOWN_EVENTS = new Set([TIMER_STATE_CHANGE, TASK_LIST_CHANGE, BOT_CONFIG_CHANGE]);

const REDIS_CHANNEL = "dirework:events";

interface RedisBus {
  pub: Redis;
  sub: Redis;
}

function createRedisBus(redisUrl: string): RedisBus {
  const options = {
    // Fail publishes fast instead of queueing forever when Redis is down —
    // emitEvent falls back to the local emitter on rejection.
    maxRetriesPerRequest: 2,
    retryStrategy: (times: number) => Math.min(times * 500, 5_000),
  };

  const pub = new Redis(redisUrl, options);
  // Subscriber connections can't run regular commands — needs its own client.
  const sub = new Redis(redisUrl, options);

  pub.on("error", (err) => logger.error("[events] Redis publisher error:", err.message));
  sub.on("error", (err) => logger.error("[events] Redis subscriber error:", err.message));
  sub.on("ready", () => logger.info("[events] Redis event bus connected"));

  sub.subscribe(REDIS_CHANNEL).catch((err) => {
    logger.error("[events] Failed to subscribe to Redis channel:", err);
  });

  sub.on("message", (channel, message) => {
    if (channel !== REDIS_CHANNEL) return;
    if (!KNOWN_EVENTS.has(message)) {
      logger.warn("[events] Ignoring unknown event from Redis:", message);
      return;
    }
    ee.emit(message);
  });

  return { pub, sub };
}

// Survive Next.js dev HMR without stacking Redis connections.
const globalForEvents = globalThis as unknown as { __direworkRedisBus?: RedisBus | null };

const redisBus: RedisBus | null = (globalForEvents.__direworkRedisBus ??= env.REDIS_URL
  ? createRedisBus(env.REDIS_URL)
  : null);

/**
 * Emit an app event. With REDIS_URL set the event round-trips through Redis so
 * every instance (including this one) receives it; otherwise it's emitted
 * directly on the in-process bus. Falls back to local emit if publish fails so
 * a Redis outage degrades to single-instance behavior instead of silence.
 */
export function emitEvent(event: string): void {
  if (!redisBus) {
    ee.emit(event);
    return;
  }
  redisBus.pub.publish(REDIS_CHANNEL, event).catch((err) => {
    logger.error("[events] Redis publish failed, falling back to local emit:", err.message);
    ee.emit(event);
  });
}
