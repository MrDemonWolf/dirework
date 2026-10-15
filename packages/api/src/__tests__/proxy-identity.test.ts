import { describe, expect, it } from "vitest";

import {
  CLIENT_IP_HEADER,
  CLIENT_IP_SIGNATURE_HEADER,
  signClientIp,
  stampClientIp,
  verifyClientIp,
} from "../proxy-identity";

const SECRET = "k".repeat(40);

describe("client-IP signing", () => {
  it("verifies its own signature for the same IP and secret only", async () => {
    const sig = await signClientIp("2001:db8::1", SECRET);
    expect(sig).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await verifyClientIp("2001:db8::1", sig, SECRET)).toBe(true);
    expect(await verifyClientIp("2001:db8::2", sig, SECRET)).toBe(false);
    expect(await verifyClientIp("2001:db8::1", sig, "other".repeat(8))).toBe(false);
  });

  it.each([
    ["an empty IP", "", "sig"],
    ["an oversized IP", "1".repeat(65), "sig"],
    ["a non-base64url signature", "203.0.113.7", "not base64!"],
    ["an empty signature", "203.0.113.7", ""],
  ])("rejects %s", async (_label, ip, sig) => {
    expect(await verifyClientIp(ip, sig, SECRET)).toBe(false);
  });

  it("rejects everything without a secret", async () => {
    const sig = await signClientIp("203.0.113.7", SECRET);
    expect(await verifyClientIp("203.0.113.7", sig, "")).toBe(false);
  });
});

describe("stampClientIp", () => {
  it("always replaces client-supplied identity headers", async () => {
    const headers = new Headers({
      [CLIENT_IP_HEADER]: "1.1.1.1",
      [CLIENT_IP_SIGNATURE_HEADER]: "x",
    });
    await stampClientIp(headers, "203.0.113.7", SECRET);
    expect(headers.get(CLIENT_IP_HEADER)).toBe("203.0.113.7");
    expect(
      await verifyClientIp("203.0.113.7", headers.get(CLIENT_IP_SIGNATURE_HEADER) ?? "", SECRET),
    ).toBe(true);
  });

  it.each([
    ["no client IP", null, SECRET],
    ["no secret", "203.0.113.7", undefined],
  ])("strips and sends nothing with %s", async (_label, ip, secret) => {
    const headers = new Headers({
      [CLIENT_IP_HEADER]: "1.1.1.1",
      [CLIENT_IP_SIGNATURE_HEADER]: "x",
    });
    await stampClientIp(headers, ip, secret);
    expect(headers.get(CLIENT_IP_HEADER)).toBeNull();
    expect(headers.get(CLIENT_IP_SIGNATURE_HEADER)).toBeNull();
  });
});
