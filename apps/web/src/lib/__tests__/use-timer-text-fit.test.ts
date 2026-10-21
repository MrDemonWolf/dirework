import { describe, expect, it } from "vitest";

import { observeFrameSize } from "../use-timer-text-fit";

/** A ResizeObserver stand-in whose callback the test fires by hand. */
function fakeObserver() {
  const handle: { fire: () => void; observed: unknown[]; disconnected: boolean } = {
    fire: () => {},
    observed: [],
    disconnected: false,
  };
  class Observer {
    constructor(callback: () => void) {
      handle.fire = callback;
    }
    observe(target: Element) {
      handle.observed.push(target);
    }
    disconnect() {
      handle.disconnected = true;
    }
  }
  return { Observer, handle };
}

/** A window stand-in whose size the test sets and whose resize event it fires. */
function fakeViewport(width: number, height: number) {
  const listeners = new Set<() => void>();
  return {
    innerWidth: width,
    innerHeight: height,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    resize(nextWidth: number, nextHeight: number) {
      this.innerWidth = nextWidth;
      this.innerHeight = nextHeight;
      for (const listener of listeners) listener();
    },
    listeners,
  };
}

describe("observeFrameSize", () => {
  it("reports the frame's size now and again when a relative-sized frame resizes", () => {
    const frame = { offsetWidth: 300, offsetHeight: 200 } as HTMLElement;
    const { Observer, handle } = fakeObserver();
    const sizes: string[] = [];
    const stop = observeFrameSize(frame, (size) => sizes.push(size), Observer, undefined);
    expect(sizes).toEqual(["300x200"]);
    expect(handle.observed).toEqual([frame]);

    // A 50vw frame after the OBS source shrinks: same inputs, new box, so refit.
    Object.assign(frame, { offsetWidth: 150, offsetHeight: 100 });
    handle.fire();
    expect(sizes).toEqual(["300x200", "150x100"]);

    // An observer callback with no layout change does not trigger another fit.
    handle.fire();
    expect(sizes).toEqual(["300x200", "150x100"]);

    stop();
    expect(handle.disconnected).toBe(true);
  });

  it("reports a viewport resize for a fixed frame (viewport-relative font sizes)", () => {
    const frame = { offsetWidth: 300, offsetHeight: 300 } as HTMLElement;
    const { Observer } = fakeObserver();
    const view = fakeViewport(1920, 1080);
    const sizes: string[] = [];
    const stop = observeFrameSize(frame, (size) => sizes.push(size), Observer, view as never);
    expect(sizes).toEqual(["300x300@1920x1080"]);

    // An 8vw clock grows with the viewport while the 300px frame stays put: refit.
    view.resize(2560, 1440);
    expect(sizes).toEqual(["300x300@1920x1080", "300x300@2560x1440"]);

    stop();
    expect(view.listeners.size).toBe(0);
  });

  it("reports once without ResizeObserver or a window", () => {
    // Node has neither, so the defaults resolve to undefined here.
    expect(globalThis.ResizeObserver).toBeUndefined();
    const frame = { offsetWidth: 300, offsetHeight: 300 } as HTMLElement;
    const sizes: string[] = [];
    const stop = observeFrameSize(frame, (size) => sizes.push(size));
    expect(sizes).toEqual(["300x300"]);
    stop();
  });
});
