import { describe, expect, it, vi } from "vitest";

import { ee, TIMER_STATE_CHANGE, TASK_LIST_CHANGE, BOT_CONFIG_CHANGE } from "../events";

describe("event emitter", () => {
  it("should have maxListeners set to 100", () => {
    expect(ee.getMaxListeners()).toBe(100);
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
