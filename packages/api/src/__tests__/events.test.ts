import { describe, expect, it, vi } from "vitest";

import { ee, emitEvent, TIMER_STATE_CHANGE, TASK_LIST_CHANGE, BOT_CONFIG_CHANGE } from "../events";

describe("event emitter", () => {
  it("should allow many concurrent SSE listeners", () => {
    expect(ee.getMaxListeners()).toBe(200);
  });

  it("emitEvent delivers locally when REDIS_URL is unset", () => {
    const handler = vi.fn();
    ee.on(TIMER_STATE_CHANGE, handler);
    emitEvent(TIMER_STATE_CHANGE);
    expect(handler).toHaveBeenCalledOnce();
    ee.off(TIMER_STATE_CHANGE, handler);
  });

  it("should emit and receive timerStateChange events", () => {
    const handler = vi.fn();
    ee.on(TIMER_STATE_CHANGE, handler);
    ee.emit(TIMER_STATE_CHANGE);
    expect(handler).toHaveBeenCalledOnce();
    ee.off(TIMER_STATE_CHANGE, handler);
  });

  it("should emit and receive taskListChange events", () => {
    const handler = vi.fn();
    ee.on(TASK_LIST_CHANGE, handler);
    ee.emit(TASK_LIST_CHANGE);
    expect(handler).toHaveBeenCalledOnce();
    ee.off(TASK_LIST_CHANGE, handler);
  });

  it("should emit and receive botConfigChange events", () => {
    const handler = vi.fn();
    ee.on(BOT_CONFIG_CHANGE, handler);
    ee.emit(BOT_CONFIG_CHANGE);
    expect(handler).toHaveBeenCalledOnce();
    ee.off(BOT_CONFIG_CHANGE, handler);
  });

  it("should not cross-fire between timer and task events", () => {
    const timerHandler = vi.fn();
    const taskHandler = vi.fn();
    ee.on(TIMER_STATE_CHANGE, timerHandler);
    ee.on(TASK_LIST_CHANGE, taskHandler);

    ee.emit(TIMER_STATE_CHANGE);

    expect(timerHandler).toHaveBeenCalledOnce();
    expect(taskHandler).not.toHaveBeenCalled();

    ee.off(TIMER_STATE_CHANGE, timerHandler);
    ee.off(TASK_LIST_CHANGE, taskHandler);
  });
});
