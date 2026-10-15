import { describe, expect, it, vi } from "vitest";

import { OWNER_TOKEN_SCRUB_SQL, scrubOwnerTokensAfterCutover } from "../post-deploy";

describe("scrubOwnerTokensAfterCutover", () => {
  it("runs the guarded scrub against the deployed database", async () => {
    const post = vi.fn(async () => new Response("{}", { status: 200 }));

    await scrubOwnerTokensAfterCutover({ accountId: "acct", post }, "db-id");

    expect(post).toHaveBeenCalledWith("/accounts/acct/d1/database/db-id/query", {
      sql: OWNER_TOKEN_SCRUB_SQL,
    });
  });

  it("only touches Twitch owner rows, never bot_account", () => {
    expect(OWNER_TOKEN_SCRUB_SQL).toMatch(/^UPDATE `account` /);
    expect(OWNER_TOKEN_SCRUB_SQL).toContain("`provider_id` = 'twitch'");
    expect(OWNER_TOKEN_SCRUB_SQL).not.toContain("bot_account");
  });

  it("fails the deploy without echoing the D1 error body", async () => {
    const post = vi.fn(async () => new Response("near UPDATE `account` SET ...", { status: 400 }));

    const err = await scrubOwnerTokensAfterCutover({ accountId: "a", post }, "d").catch(
      (e: Error) => e,
    );

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain("HTTP 400");
    expect((err as Error).message).not.toContain("UPDATE");
  });
});
