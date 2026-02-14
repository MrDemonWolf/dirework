import { describe, expect, it, vi } from "vitest";

import { ee } from "../events";

describe("event emitter", () => {
  it("should have maxListeners set to 100", () => {
    expect(ee.getMaxListeners()).toBe(100);
  });

  it("should emit and receive timerStateChange events", () => {
    const handler = vi.fn();
    ee.on("timerStateChange:user1", handler);
    ee.emit("timerStateChange:user1");
    expect(handler).toHaveBeenCalledOnce();
    ee.off("timerStateChange:user1", handler);
  });

  it("should emit and receive taskListChange events", () => {
    const handler = vi.fn();
    ee.on("taskListChange:user1", handler);
    ee.emit("taskListChange:user1");
    expect(handler).toHaveBeenCalledOnce();
    ee.off("taskListChange:user1", handler);
  });

  it("should not cross-fire between different userId events", () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    ee.on("timerStateChange:userA", handler1);
    ee.on("timerStateChange:userB", handler2);

    ee.emit("timerStateChange:userA");

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).not.toHaveBeenCalled();

    ee.off("timerStateChange:userA", handler1);
    ee.off("timerStateChange:userB", handler2);
  });

  it("should not cross-fire between timer and task events for same user", () => {
    const timerHandler = vi.fn();
    const taskHandler = vi.fn();
    ee.on("timerStateChange:user1", timerHandler);
    ee.on("taskListChange:user1", taskHandler);

    ee.emit("timerStateChange:user1");

    expect(timerHandler).toHaveBeenCalledOnce();
    expect(taskHandler).not.toHaveBeenCalled();

    ee.off("timerStateChange:user1", timerHandler);
    ee.off("taskListChange:user1", taskHandler);
  });
});
