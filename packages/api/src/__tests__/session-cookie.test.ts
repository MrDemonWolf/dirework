import { describe, expect, it } from "vitest";

import { hasSessionCookie, readCookie, SESSION_COOKIE_NAMES } from "../session-cookie";

describe("session cookie names", () => {
  it("reads one cookie from a header, first match wins", () => {
    expect(readCookie("a=1; b=2; b=3", "b")).toBe("2");
    expect(readCookie("a=1", "b")).toBeNull();
    expect(readCookie(null, "a")).toBeNull();
    // A name that merely ends with the cookie's name is a different cookie.
    expect(readCookie("xbetter-auth.session_token=1", "better-auth.session_token")).toBeNull();
  });

  it.each(SESSION_COOKIE_NAMES)("finds a session cookie named %s", (name) => {
    expect(hasSessionCookie(`theme=dark; ${name}=tok.sig`)).toBe(true);
  });

  it.each([
    ["no header", null],
    ["an empty header", ""],
    ["unrelated cookies", "theme=dark; dirework.bot-view=dock"],
    // better-auth clears the cookie by setting it empty; that is no session.
    ["an emptied session cookie", "better-auth.session_token="],
    ["a look-alike name", "better-auth.session_data=x; my-better-auth.session_token=x"],
  ])("reports no session cookie for %s", (_label, header) => {
    expect(hasSessionCookie(header)).toBe(false);
  });
});
