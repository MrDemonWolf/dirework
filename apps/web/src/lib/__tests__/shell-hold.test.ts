import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { createShellHold } from "@/lib/shell-hold";

const read = (rel: string) => readFileSync(path.join(__dirname, "../..", rel), "utf8");

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Whether `promise` has settled after the queued microtasks drain. */
async function settled(promise: Promise<unknown>): Promise<boolean> {
  let done = false;
  void promise.then(
    () => (done = true),
    () => (done = true),
  );
  await new Promise((r) => setTimeout(r, 0));
  return done;
}

describe("createShellHold", () => {
  it("releases at once when nothing was held (every other route)", async () => {
    expect(await settled(createShellHold().release())).toBe(true);
  });

  it("holds the release until every registered piece of work settles", async () => {
    const hold = createShellHold();
    const a = deferred<string>();
    const b = deferred<number>();
    hold.hold(a.promise);
    hold.hold(b.promise);
    const release = hold.release();

    expect(await settled(release)).toBe(false);
    a.resolve("config");
    expect(await settled(release)).toBe(false);
    b.resolve(1);
    expect(await settled(release)).toBe(true);
  });

  it("returns the held promise itself, so the page awaits its own data", async () => {
    const work = Promise.resolve({ queries: [] });
    expect(createShellHold().hold(work)).toBe(work);
  });

  it("still releases when held work throws (a redirect is the page's, not the layout's)", async () => {
    const hold = createShellHold();
    const failing = deferred<never>();
    const page = hold.hold(failing.promise);
    page.catch(() => {});
    const release = hold.release();
    failing.reject(new Error("NEXT_REDIRECT"));
    await expect(release).resolves.toBeUndefined();
    await expect(page).rejects.toThrow("NEXT_REDIRECT");
  });

  it("keeps holds separate per instance (one per request)", async () => {
    const first = createShellHold();
    first.hold(new Promise(() => {}));
    expect(await settled(createShellHold().release())).toBe(true);
  });
});

describe("shell hold wiring", () => {
  it("the (app) layout waits for held work after its session, before the shell", () => {
    const layout = read("app/(app)/layout.tsx");
    const session = layout.indexOf("await getServerSession()");
    const release = layout.indexOf("await shellReleased()");
    expect(session).toBeGreaterThan(-1);
    expect(release).toBeGreaterThan(session);
  });

  it("the Theme Center registers its prefetch before awaiting anything", () => {
    const page = read("app/(app)/dashboard/styles/page.tsx");
    const body = page.slice(page.indexOf("export default async function"));
    // The first await in the route must be the held one: Next renders the layout and the page
    // in parallel, and only work registered before the layout's own await settles is held.
    expect(body.match(/await [^;]+/)?.[0]).toBe("await holdShellFor(loadStyles())");
  });
});
