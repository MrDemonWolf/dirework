import { EventEmitter } from "events";

// In-process event bus for cross-router communication.
// Works because Dirework is single-instance — no Redis needed.
//
// Emitted events:
//   "timerStateChange:{userId}" — when timer state changes
//   "taskListChange:{userId}"   — when tasks are modified
//   "botConfigChange:{userId}"  — when bot config is saved (reload cache)
export const ee = new EventEmitter();

// Allow many concurrent overlay SSE connections without Node warning
ee.setMaxListeners(100);
