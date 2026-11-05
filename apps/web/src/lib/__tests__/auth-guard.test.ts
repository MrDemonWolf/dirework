// loadAsOwner's ordering, with deferred promises: a request that carries a session cookie
// starts its batch while the session check is still in flight (one api round trip saved on
// every owner load), and a cookie-less one never starts it (a signed-out visitor never
// spends a batch).

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServerSession } from "../server-session";

let cookiePresent = true;
let sessionCheck: Promise<ServerSession | null>;

vi.mock("../server-session", () => ({
  getServerSession: () => sessionCheck,
  requestHasSessionCookie: async () => cookiePresent,
}));

class RedirectSignal extends Error {}
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new RedirectSignal(to);
  },
}));

import { loadAsOwner } from "../auth-guard";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Let every queued microtask (and the awaits inside loadAsOwner) run. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const OWNER: ServerSession = { user: { name: "wolfstreams", image: null, isOwner: true } };

describe("loadAsOwner", () => {
  beforeEach(() => {
    cookiePresent = true;
  });

  it("with a session cookie, starts the batch before the session check answers", async () => {
    const session = deferred<ServerSession | null>();
    sessionCheck = session.promise;
    const start = vi.fn(async () => "batch");

    const load = loadAsOwner(start);
    await flush();
    expect(start).toHaveBeenCalledTimes(1);

    session.resolve(OWNER);
    await expect(load).resolves.toStrictEqual({ session: OWNER, data: "batch" });
  });

  it("with a session cookie that turns out stale, still redirects (the batch is dropped)", async () => {
    sessionCheck = Promise.resolve(null);
    const start = vi.fn(async () => "batch");
    await expect(loadAsOwner(start)).rejects.toThrow(RedirectSignal);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("lets the redirect win even when the batch fails first", async () => {
    const session = deferred<ServerSession | null>();
    sessionCheck = session.promise;
    const load = loadAsOwner(async () => {
      throw new Error("UNAUTHORIZED");
    });
    await flush();
    session.resolve(null);
    await expect(load).rejects.toThrow(RedirectSignal);
  });

  it("without a session cookie, never starts the batch for a signed-out visitor", async () => {
    cookiePresent = false;
    sessionCheck = Promise.resolve(null);
    const start = vi.fn(async () => "batch");
    await expect(loadAsOwner(start)).rejects.toThrow(RedirectSignal);
    expect(start).not.toHaveBeenCalled();
  });

  it("without a session cookie, waits for the session before starting the batch", async () => {
    cookiePresent = false;
    const session = deferred<ServerSession | null>();
    sessionCheck = session.promise;
    const start = vi.fn(async () => "batch");

    const load = loadAsOwner(start);
    await flush();
    expect(start).not.toHaveBeenCalled();

    session.resolve(OWNER);
    await expect(load).resolves.toStrictEqual({ session: OWNER, data: "batch" });
  });

  it("refuses a signed-in non-owner either way", async () => {
    sessionCheck = Promise.resolve({ user: { name: "viewer", image: null, isOwner: false } });
    await expect(loadAsOwner(async () => "batch")).rejects.toThrow(RedirectSignal);
  });
});
