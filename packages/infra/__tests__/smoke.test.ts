import { describe, expect, it } from "vitest";

import { deployedShaMatches, runSmokeCheck } from "../smoke";

const fullSha = "0123456789abcdef0123456789abcdef01234567";

type Route = (attempt: number) => Response | Error;

function fakeFetch(routes: Record<string, Route>) {
  const calls: string[] = [];
  const counts = new Map<string, number>();
  const fetchImpl = async (url: string) => {
    calls.push(url);
    const attempt = (counts.get(url) ?? 0) + 1;
    counts.set(url, attempt);
    const route = routes[url];
    if (!route) throw new Error(`unexpected url ${url}`);
    const result = route(attempt);
    if (result instanceof Error) throw result;
    return result;
  };
  return { fetchImpl, calls };
}

const json = (body: unknown, status = 200) => Response.json(body, { status });
const options = { attempts: 3, delayMs: 0, timeoutMs: 1000 };

describe("deployedShaMatches", () => {
  it("accepts a short SHA of any unambiguous length that prefixes the commit", () => {
    expect(deployedShaMatches("0123456", fullSha)).toBe(true);
    expect(deployedShaMatches("0123456789", fullSha)).toBe(true);
    expect(deployedShaMatches(fullSha, fullSha)).toBe(true);
  });

  it("rejects the dev fallback, other commits, and malformed values", () => {
    expect(deployedShaMatches("dev", fullSha)).toBe(false);
    expect(deployedShaMatches("abcdef0", fullSha)).toBe(false);
    expect(deployedShaMatches("012", fullSha)).toBe(false);
    expect(deployedShaMatches("", fullSha)).toBe(false);
    expect(deployedShaMatches(undefined, fullSha)).toBe(false);
    expect(deployedShaMatches(1234567, fullSha)).toBe(false);
  });
});

describe("runSmokeCheck", () => {
  it("passes when the api is ready and the web worker serves the deployed commit", async () => {
    const { fetchImpl, calls } = fakeFetch({
      "https://api.example.com/ready": () => json({ status: "ready" }),
      "https://web.example.com/api/version": () => json({ sha: "0123456" }),
    });

    const errors = await runSmokeCheck({
      apiUrl: "https://api.example.com/",
      webUrl: "https://web.example.com",
      expectedSha: fullSha,
      fetchImpl,
      ...options,
    });

    expect(errors).toEqual([]);
    expect(calls).toEqual(["https://api.example.com/ready", "https://web.example.com/api/version"]);
  });

  it("retries until a newly deployed worker starts answering", async () => {
    const { fetchImpl, calls } = fakeFetch({
      "https://api.example.com/ready": (attempt) =>
        attempt < 3 ? new TypeError("fetch failed") : json({ status: "ready" }),
      "https://web.example.com/api/version": (attempt) =>
        json({ sha: attempt === 1 ? "fedcba9" : "0123456" }),
    });

    const errors = await runSmokeCheck({
      apiUrl: "https://api.example.com",
      webUrl: "https://web.example.com",
      expectedSha: fullSha,
      fetchImpl,
      ...options,
    });

    expect(errors).toEqual([]);
    expect(calls).toHaveLength(5);
  });

  it("reports a degraded api and a stale web worker after exhausting retries", async () => {
    const { fetchImpl, calls } = fakeFetch({
      "https://api.example.com/ready": () => json({ status: "degraded" }, 503),
      "https://web.example.com/api/version": () => json({ sha: "dev" }),
    });

    const errors = await runSmokeCheck({
      apiUrl: "https://api.example.com",
      webUrl: "https://web.example.com",
      expectedSha: fullSha,
      fetchImpl,
      ...options,
    });

    expect(errors).toEqual([
      "api /ready failed (status 503)",
      "web /api/version is not the deployed commit (serving dev)",
    ]);
    expect(calls).toHaveLength(6);
  });

  it("reports network errors by name only and non-JSON version bodies as unknown", async () => {
    const { fetchImpl } = fakeFetch({
      "https://api.example.com/ready": () => new TypeError("fetch failed: https://secret"),
      "https://web.example.com/api/version": () => new Response("<html>", { status: 200 }),
    });

    const errors = await runSmokeCheck({
      apiUrl: "https://api.example.com",
      webUrl: "https://web.example.com",
      expectedSha: fullSha,
      fetchImpl,
      ...options,
    });

    expect(errors).toEqual([
      "api /ready failed (TypeError)",
      "web /api/version is not the deployed commit (serving unknown)",
    ]);
  });
});
