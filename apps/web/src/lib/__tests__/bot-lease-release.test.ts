import { describe, expect, it, vi } from "vitest";

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
