import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { createShellHold, RENDER_GATE_LINK } from "@/lib/shell-hold";

const read = (rel: string) => readFileSync(path.join(__dirname, "../..", rel), "utf8");

const APP_DIR = path.join(__dirname, "../../app");

/**
 * The loading.tsx files that wrap a page in `dir` (relative to src/app): Next puts a Suspense
 * boundary around every segment that has one, from the root down to the page's own folder.
 */
function loadingBoundariesAround(dir: string): string[] {
  const segments = dir.split("/");
  return segments
    .map((_, depth) => [...segments.slice(0, depth), "loading.tsx"].join("/"))
    .concat(`${dir}/loading.tsx`)
    .filter((file) => existsSync(path.join(APP_DIR, file)));
}

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
    // Released, but unfinished: the page that threw renders no complete content.
    await expect(release).resolves.toBe(false);
    await expect(page).rejects.toThrow("NEXT_REDIRECT");
  });

  it("leaves no unhandled rejection when held work throws and nothing releases (client navigation)", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    try {
      const hold = createShellHold();
      const failing = deferred<never>();
      const page = hold.hold(failing.promise, () => true);
      page.catch(() => {});
      failing.reject(new Error("NEXT_REDIRECT"));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("reports the page finished only when every held value passes its check", async () => {
    const finished = (state: { pending: number }) => state.pending === 0;

    const complete = createShellHold();
    complete.hold(Promise.resolve({ pending: 0 }), finished);
    complete.hold(Promise.resolve({ pending: 0 }), finished);
    expect(await complete.release()).toBe(true);

    // One section past the deadline is still streaming: its placeholder must paint.
    const partial = createShellHold();
    partial.hold(Promise.resolve({ pending: 0 }), finished);
    partial.hold(Promise.resolve({ pending: 1 }), finished);
    expect(await partial.release()).toBe(false);
  });

  it("never reports finished for nothing held, or work held without a check", async () => {
    expect(await createShellHold().release()).toBe(false);
    const unchecked = createShellHold();
    unchecked.hold(Promise.resolve({ pending: 0 }));
    expect(await unchecked.release()).toBe(false);
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

  it("the Theme Center registers its streamed batch before awaiting anything", () => {
    const page = read("app/(app)/dashboard/styles/page.tsx");
    const body = page.slice(page.indexOf("export default async function"));
    // The first await in the route must be the held one: Next renders the layout and the page
    // in parallel, and only work registered before the layout's own await settles is held.
    expect(body.match(/await [^;]+/)?.[0]).toBe(
      "await holdShellFor(loadStyles(), everyQuerySettled)",
    );
  });

  it("the Bot settings (sections) layout registers its streamed batch before awaiting", () => {
    // A layout renders in parallel with the (app) layout just like a page does, so it can
    // hold the shell too; its loader waits at most SECTIONS_READY_MS (lib/progressive.ts).
    const layout = read("app/(app)/dashboard/bot/(sections)/layout.tsx");
    const body = layout.slice(layout.indexOf("export default async function"));
    expect(body.match(/await [^;]+/)?.[0]).toBe("await holdShellFor(loadBot(), everyQuerySettled)");
  });

  it("the dashboard registers its streamed batch, with the settled check, before awaiting", () => {
    const page = read("app/(app)/dashboard/page.tsx");
    const body = page.slice(page.indexOf("export default async function"));
    expect(body.match(/await [^;]+/)?.[0].replace(/\s+/g, " ")).toBe(
      "await holdShellFor(loadDashboard(), (page) => everyQuerySettled(page.state), )",
    );
  });

  it("the (app) layout blocks the first paint on the document only for a finished page", () => {
    // Without the gate, a browser that paints while it parses the response shows the
    // loading.tsx skeleton React still writes ahead of the page, then holds the page back
    // 300ms (React's reveal throttle). With it on a page still streaming, that page's
    // placeholders could not paint at the SECTIONS_READY_MS deadline.
    const layout = read("app/(app)/layout.tsx");
    expect(layout).toContain("const pageFinished = await shellReleased()");
    expect(layout).toContain("{pageFinished && <link {...RENDER_GATE_LINK} />}");
    expect(RENDER_GATE_LINK).toEqual({
      rel: "expect",
      href: expect.stringMatching(/^#[a-z-]+$/),
      blocking: "render",
    });
    // The target id is never rendered: the gate lifts when the document is parsed.
    const id = RENDER_GATE_LINK.href.slice(1);
    const srcDir = path.join(__dirname, "../..");
    const sources = (readdirSync(srcDir, { recursive: true }) as string[])
      .filter((file) => /\.tsx?$/.test(file) && !file.includes("__tests__"))
      .filter((file) => readFileSync(path.join(srcDir, file), "utf8").includes(id));
    expect(sources).toEqual([path.join("lib", "shell-hold.ts")]);
  });
});

describe("loading boundaries", () => {
  // A loading.tsx above / or /setup streams its skeleton before the page's ownership and
  // session checks answer, so their redirect() can only run client-side behind it: the owner's
  // / painted that skeleton, then the dashboard's own, and a visitor's landing arrived at least
  // 300ms after the skeleton. With none, nothing streams until the page decides: a real 307
  // (owner to /dashboard, unclaimed to /setup) or the finished page in one paint.
  it.each([
    ["/", "(app)"],
    ["/setup", "(app)/setup"],
  ])("no loading.tsx wraps %s", (_route, dir) => {
    expect(loadingBoundariesAround(dir)).toEqual([]);
  });

  // The dashboard routes keep theirs: a client navigation shows it the instant a link is
  // clicked, and a hard load holds the shell (above), so it never paints there.
  it.each([
    ["/dashboard", "(app)/dashboard/loading.tsx"],
    ["/dashboard/styles", "(app)/dashboard/styles/loading.tsx"],
    // Entering Bot settings: below its heading and sub-nav (bot/layout.tsx).
    ["/dashboard/bot", "(app)/dashboard/bot/loading.tsx"],
    // Switching between its sub-pages.
    ["/dashboard/bot/*", "(app)/dashboard/bot/(sections)/loading.tsx"],
  ])("%s keeps its own loading.tsx", (_route, file) => {
    expect(existsSync(path.join(APP_DIR, file))).toBe(true);
  });
});
