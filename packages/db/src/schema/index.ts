export * from "./auth";
export * from "./app";

import { relations } from "drizzle-orm";
import { user, session, account } from "./auth";

// Only auth-side relations remain — app tables are singletons,
// so they have no FK back to user and need no relation helpers.

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));
