import { describe, expect, it, vi } from "vitest";

import { confirmDiscardIfDirty, registerDiscardConfirm } from "../unsaved-changes";

describe("confirmDiscardIfDirty", () => {
  it("proceeds immediately when no guard is registered", () => {
    const proceed = vi.fn();
    confirmDiscardIfDirty(proceed);
    expect(proceed).toHaveBeenCalledOnce();
  });

  it("routes through the registered guard instead of proceeding", () => {
    const confirm = vi.fn();
    const unregister = registerDiscardConfirm(confirm);
    const proceed = vi.fn();

    confirmDiscardIfDirty(proceed);

    expect(proceed).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledWith(proceed);
    unregister();
  });

  it("proceeds directly again once the guard unregisters", () => {
    const confirm = vi.fn();
    registerDiscardConfirm(confirm)();
    const proceed = vi.fn();

    confirmDiscardIfDirty(proceed);

    expect(confirm).not.toHaveBeenCalled();
    expect(proceed).toHaveBeenCalledOnce();
  });

  it("ignores a stale unregister from a replaced guard", () => {
    const first = vi.fn();
    const second = vi.fn();
    const unregisterFirst = registerDiscardConfirm(first);
    const unregisterSecond = registerDiscardConfirm(second);

    unregisterFirst();
    confirmDiscardIfDirty(() => {});

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    unregisterSecond();
  });
});
