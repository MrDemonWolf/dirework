// Better Auth tables (user, session, account, verification), in better-auth's
// expected shape plus Dirework's user columns. Behaviour that shapes what these
// rows hold (owner claim, token scrubbing, no IP/UA) lives in packages/auth.

import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * The instance owner. Single-user: the first sign-in claims the instance
 * (`isOwner`) and better-auth's user-create hook refuses any later user.
 * `email` is a `<twitch sub>@users.twitch.invalid` placeholder — the owner's
 * real email is never requested.
 */
export const user = sqliteTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
    image: text("image"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date()),
    // Dirework-specific
    // Numeric Twitch user ID; filled from the account row after sign-up
    // (packages/auth twitch-identity.ts), so it can be empty on older rows.
    twitchId: text("twitch_id").unique(),
    displayName: text("display_name"),
    isOwner: integer("is_owner", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [
    // DB-level guarantee: only one row can have isOwner=true (backs the app-level count check)
    uniqueIndex("user_single_owner_idx").on(table.isOwner).where(sql`${table.isOwner} = true`),
  ],
);

/**
 * Better Auth sessions (30-day expiry). `ipAddress` / `userAgent` exist only
 * because better-auth expects them: the session-create hook nulls both, and
 * expired rows are purged at sign-in.
 */
export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

/**
 * OAuth provider links for the owner (Twitch, `accountId` = Twitch user ID).
 * The token columns stay null: the account create/update hooks drop the
 * owner's Twitch tokens and `scrubOwnerTokens` re-clears them at every sign-in.
 * The bot's chat credentials live in `bot_account` (app.ts), not here.
 */
export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("account_user_id_idx").on(table.userId),
    uniqueIndex("account_provider_account_idx").on(table.providerId, table.accountId),
  ],
);

/** Better Auth's short-lived verification values (e.g. OAuth state). */
export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date()),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);
