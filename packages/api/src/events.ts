import { EventEmitter } from "events";

// In-process event bus for cross-router communication.
// Works because Dirework is single-instance — no Redis needed.
//
// Emitted events:
//   "timerStateChange" — when timer state changes
//   "taskListChange"   — when tasks are modified
//   "botConfigChange"  — when bot config is saved (reload cache)
export const ee = new EventEmitter();

// Allow many concurrent overlay SSE connections without Node warning
ee.setMaxListeners(100);

export const TIMER_STATE_CHANGE = "timerStateChange";
export const TASK_LIST_CHANGE = "taskListChange";
export const BOT_CONFIG_CHANGE = "botConfigChange";
