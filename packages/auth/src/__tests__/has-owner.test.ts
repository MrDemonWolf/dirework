import type { DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";
import { beforeEach, describe, expect, it } from "vitest";

import { claimInstance, hasOwner, purgeExpiredSessions } from "../index";
import { createTestDb } from "./stubs/test-db";

let db: DbClient;

beforeEach(async () => {
  db = await createTestDb();
});

async function insertUser(id: string) {
  await db.insert(schema.user).values({ id, name: id, email: `${id}@example.test` });
}

describe("hasOwner", () => {
  it("returns false when no users exist", async () => {
    expect(await hasOwner(db)).toBe(false);
  });

  it("returns true when one user exists", async () => {
    await insertUser("u1");
    expect(await hasOwner(db)).toBe(true);
  });

  it("returns true when multiple users exist", async () => {
    await insertUser("u1");
    await insertUser("u2");
    expect(await hasOwner(db)).toBe(true);
  });
});

describe("claimInstance", () => {
  it("makes the first user the owner", async () => {
    const result = await claimInstance(db, { name: "streamer" });
    expect(result.data).toMatchObject({ name: "streamer", isOwner: true });
  });

  it("refuses every user once the instance is claimed", async () => {
    await insertUser("owner");
    await expect(claimInstance(db, { name: "intruder" })).rejects.toThrow(/instance_claimed/);
  });
});

describe("purgeExpiredSessions", () => {
  it("deletes only sessions that have already expired", async () => {
    await insertUser("u1");
    const now = new Date("2026-06-01T00:00:00Z");
    await db.insert(schema.session).values([
      { id: "old", token: "t-old", userId: "u1", expiresAt: new Date(now.getTime() - 1) },
      { id: "live", token: "t-live", userId: "u1", expiresAt: new Date(now.getTime() + 60_000) },
    ]);

    await purgeExpiredSessions(db, now);

    const remaining = await db.select({ id: schema.session.id }).from(schema.session);
    expect(remaining.map((row) => row.id)).toEqual(["live"]);
  });
});
