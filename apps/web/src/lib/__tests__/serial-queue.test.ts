import { describe, expect, it } from "vitest";

import { createSerialQueue } from "../serial-queue";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("createSerialQueue", () => {
  it("runs tasks strictly in submission order even when the first is slow", async () => {
    const run = createSerialQueue();
    const log: string[] = [];
    const slow = deferred<string>();

    const first = run(async () => {
      log.push("start a");
      const value = await slow.promise;
      log.push("end a");
      return value;
    });
    const second = run(async () => {
      log.push("start b");
      return "b";
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(log).toEqual(["start a"]);

    slow.resolve("a");
    expect(await first).toBe("a");
    expect(await second).toBe("b");
    expect(log).toEqual(["start a", "end a", "start b"]);
  });

  it("propagates a task's rejection to its own caller", async () => {
    const run = createSerialQueue();
    await expect(run(async () => Promise.reject(new Error("nope")))).rejects.toThrow("nope");
  });

  it("does not stall later tasks after a rejection", async () => {
    const run = createSerialQueue();
    const failed = run(async () => {
      throw new Error("first fails");
    });
    const after = run(async () => "still runs");

    await expect(failed).rejects.toThrow("first fails");
    expect(await after).toBe("still runs");
  });

  it("keeps only one task in flight at a time", async () => {
    const run = createSerialQueue();
    let inFlight = 0;
    let maxInFlight = 0;
    const task = async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight -= 1;
    };

    await Promise.all([run(task), run(task), run(task)]);
    expect(maxInFlight).toBe(1);
  });
});
