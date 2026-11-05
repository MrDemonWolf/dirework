import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { apiOrigin } from "../api-origin";
import { releaseBotLease } from "../bot-lease-release";

describe("releaseBotLease", () => {
  const input = {
    token: "bot-token-0123456789",
    instanceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  };

  it("sends bot.release as a non-batched JSON tRPC POST that outlives the page", () => {
    const send = vi.fn(async () => new Response(null));
    releaseBotLease(input, send as unknown as typeof fetch);

    expect(send).toHaveBeenCalledTimes(1);
    const [url, init] = send.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${apiOrigin()}/trpc/bot.release`);
    expect(init).toMatchObject({
      method: "POST",
      keepalive: true,
      // The api's /trpc guard refuses anything but JSON (and sendBeacon can't send it).
      headers: { "content-type": "application/json" },
    });
    expect(JSON.parse(String(init.body))).toEqual(input);
  });

  it("never throws, whether the request fails or the browser refuses it", async () => {
    expect(() =>
      releaseBotLease(input, (async () => {
        throw new TypeError("Failed to fetch");
      }) as unknown as typeof fetch),
    ).not.toThrow();
    expect(() =>
      releaseBotLease(input, (() => {
        throw new TypeError("keepalive refused");
      }) as unknown as typeof fetch),
    ).not.toThrow();
    await Promise.resolve();
  });
});

describe("pageLeaseId", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** A fresh copy of the module, the way a new page load evaluates it. */
  async function loadPage() {
    vi.resetModules();
    return import("../bot-lease-release");
  }

  it("mints one id per page load, on first use, and hands it to every later session", async () => {
    const mint = vi.spyOn(crypto, "randomUUID");
    const page = await loadPage();
    // Loading the module mints nothing: the server render loads it too, and a Worker isolate
    // (one per many requests) must never hold a page's id.
    expect(mint).not.toHaveBeenCalled();

    const id = page.pageLeaseId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    // The dock's Reconnect and the (bot) error boundary's restart start their sessions in the
    // same page load: same id, so they renew the lease instead of standing by for it.
    expect(page.pageLeaseId()).toBe(id);
    expect(mint).toHaveBeenCalledTimes(1);

    // A reload is a new page load with its own id (the old one went with its pagehide release).
    expect((await loadPage()).pageLeaseId()).not.toBe(id);
  });

  it("is where BotConsole's sessions get their id: one call, never an id minted per mount", () => {
    const source = readFileSync(
      path.join(__dirname, "../../app/(bot)/bot/[token]/bot-console.tsx"),
      "utf8",
    );
    // The error boundary's restart remounts the console and runs its session effect again: an
    // id minted per mount would stand by for the crashed session's lease for minutes. One call
    // site, in the session's options, keeps it out of render (and so off the server).
    expect(source.split("pageLeaseId()")).toHaveLength(2);
    expect(source).toContain("instanceId: pageLeaseId(),");
    expect(source).not.toContain("randomUUID");
  });
});
