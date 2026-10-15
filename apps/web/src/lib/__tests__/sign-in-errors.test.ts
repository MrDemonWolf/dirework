import { describe, expect, it } from "vitest";

import { resolveSignInError, SIGN_IN_ERRORS } from "../sign-in-errors";

describe("resolveSignInError", () => {
  it("shows the claimed-instance copy for the auth hook's code, in any case", () => {
    expect(resolveSignInError("instance_claimed")).toBe(SIGN_IN_ERRORS.instance_claimed);
    expect(resolveSignInError("INSTANCE_CLAIMED")).toBe(SIGN_IN_ERRORS.instance_claimed);
  });

  it.each(["not_authenticated", "not_owner"] as const)(
    "shows specific copy for the bot OAuth %s redirect",
    (code) => {
      expect(resolveSignInError(code)).toBe(SIGN_IN_ERRORS[code]);
      expect(resolveSignInError(code.toUpperCase())).toBe(SIGN_IN_ERRORS[code]);
      expect(SIGN_IN_ERRORS[code]).not.toBe(SIGN_IN_ERRORS.signin_failed);
    },
  );

  it("never resolves inherited object keys as codes", () => {
    expect(resolveSignInError("constructor")).toBe(SIGN_IN_ERRORS.signin_failed);
    expect(resolveSignInError("__proto__")).toBe(SIGN_IN_ERRORS.signin_failed);
  });

  it("falls back to the generic failure for provider and unknown codes", () => {
    expect(resolveSignInError("access_denied")).toBe(SIGN_IN_ERRORS.signin_failed);
    expect(resolveSignInError("invalid_code")).toBe(SIGN_IN_ERRORS.signin_failed);
    expect(resolveSignInError("")).toBe(SIGN_IN_ERRORS.signin_failed);
  });
});
