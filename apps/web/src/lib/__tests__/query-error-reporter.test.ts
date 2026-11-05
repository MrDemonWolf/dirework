// The browser QueryClient (utils/trpc.ts) hands a failed query to whatever reporter
// lib/query-error-reporter.ts holds. AppToaster (components/app-toaster.tsx), which only the
// (app) layout mounts, registers the toast as its module loads; the OBS overlays and the bot page
// never load it, so a failed query there reports nowhere and sonner stays out of their bundles.

import type { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { API_UNREACHABLE_MESSAGE, API_UNREACHABLE_TOAST_ID } from "../trpc-errors";

// React Query decides browser or server once, as it loads (`typeof window`), and utils/trpc.ts
// reads that answer: give this file a browser `window` before anything imports them.
vi.hoisted(() => {
  Object.defineProperty(globalThis, "window", { value: new EventTarget(), configurable: true });
});

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError }, Toaster: () => null }));

/** utils/trpc.ts as a fresh page load gets it, with no reporter registered yet. */
async function loadPage(): Promise<QueryClient> {
  vi.resetModules();
  const { getQueryClient } = await import("@/utils/trpc");
  return getQueryClient();
}

/** A query whose fetch fails at once (no retries), as the dashboard's would with the api down. */
function failingQuery(meta?: { silent: boolean }) {
  return {
    queryKey: ["dashboard", meta?.silent ? "silent" : "loud"],
    queryFn: () => Promise.reject(new Error("Failed to fetch")),
    retry: false,
    meta,
  };
}

let client: QueryClient | undefined;

// The first import transforms utils/trpc.ts's whole graph (tRPC, the api's config modules),
// which can outlast a test's 5s; the imports after each vi.resetModules() reuse that work.
beforeAll(async () => {
  await import("@/utils/trpc");
}, 30_000);

afterEach(() => {
  client?.clear();
  toastError.mockReset();
});

describe("the browser QueryClient's error reporting", () => {
  it("reports a failed query nowhere while no reporter is registered (overlays, bot page)", async () => {
    client = await loadPage();
    await expect(client.fetchQuery(failingQuery())).rejects.toThrow("Failed to fetch");
    expect(toastError).not.toHaveBeenCalled();
  });

  it("hands a failed query to the registered reporter", async () => {
    client = await loadPage();
    const { setErrorReporters } = await import("@/lib/query-error-reporter");
    const reporter = vi.fn();
    setErrorReporters({ query: reporter, mutation: vi.fn() });

    await client.fetchQuery(failingQuery()).catch(() => undefined);

    expect(reporter).toHaveBeenCalledTimes(1);
    const [error, query] = reporter.mock.calls[0] as [Error, { queryKey: unknown }];
    expect(error.message).toBe("Failed to fetch");
    expect(query.queryKey).toEqual(["dashboard", "loud"]);
  });

  it("hands a failed mutation to the registered reporter, and to none before one registers", async () => {
    client = await loadPage();
    const write = () =>
      client
        ?.getMutationCache()
        .build(client, { mutationFn: () => Promise.reject(new Error("refused")), retry: false })
        .execute(undefined)
        .catch(() => undefined);
    await write();
    expect(toastError).not.toHaveBeenCalled();

    const { setErrorReporters } = await import("@/lib/query-error-reporter");
    const mutation = vi.fn();
    setErrorReporters({ query: vi.fn(), mutation });
    await write();

    expect(mutation).toHaveBeenCalledTimes(1);
    expect(mutation).toHaveBeenCalledWith(expect.objectContaining({ message: "refused" }));
  });

  it("never reports a meta.silent query (the OBS overlay polls)", async () => {
    client = await loadPage();
    const { setErrorReporters } = await import("@/lib/query-error-reporter");
    const reporter = vi.fn();
    setErrorReporters({ query: reporter, mutation: vi.fn() });

    await client.fetchQuery(failingQuery({ silent: true })).catch(() => undefined);

    expect(reporter).not.toHaveBeenCalled();
  });

  it("toasts once AppToaster's module has loaded, before anything renders", async () => {
    client = await loadPage();
    // Loading the module is the whole registration: no render, no effect, no first error.
    await import("@/components/app-toaster");

    await client.fetchQuery(failingQuery()).catch(() => undefined);

    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(
      API_UNREACHABLE_MESSAGE,
      expect.objectContaining({ id: API_UNREACHABLE_TOAST_ID }),
    );
  });
});
