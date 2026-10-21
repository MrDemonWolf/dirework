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

describe("observeFrameSize", () => {
  it("reports the frame's size now and again when a relative-sized frame resizes", () => {
    const frame = { offsetWidth: 300, offsetHeight: 200 } as HTMLElement;
    const { Observer, handle } = fakeObserver();
    const sizes: string[] = [];
    const stop = observeFrameSize(frame, (size) => sizes.push(size), Observer);
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

  it("reports once without ResizeObserver", () => {
    const frame = { offsetWidth: 300, offsetHeight: 300 } as HTMLElement;
    const sizes: string[] = [];
    const stop = observeFrameSize(frame, (size) => sizes.push(size), undefined);
    expect(sizes).toEqual(["300x300"]);
    stop();
  });
});
