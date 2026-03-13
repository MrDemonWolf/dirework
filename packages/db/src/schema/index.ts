export * from "./auth";
export * from "./app";

import { relations } from "drizzle-orm";
import { user, session, account } from "./auth";
import { botAccount, task, timerState, timerConfig, timerStyle, taskStyle, botConfig } from "./app";

export const userRelations = relations(user, ({ one, many }) => ({
  sessions: many(session),
  accounts: many(account),
  botAccount: one(botAccount, { fields: [user.id], references: [botAccount.userId] }),
  tasks: many(task),
  timerState: one(timerState, { fields: [user.id], references: [timerState.userId] }),
  timerConfig: one(timerConfig, { fields: [user.id], references: [timerConfig.userId] }),
  timerStyle: one(timerStyle, { fields: [user.id], references: [timerStyle.userId] }),
  taskStyle: one(taskStyle, { fields: [user.id], references: [taskStyle.userId] }),
  botConfig: one(botConfig, { fields: [user.id], references: [botConfig.userId] }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const botAccountRelations = relations(botAccount, ({ one }) => ({
  user: one(user, { fields: [botAccount.userId], references: [user.id] }),
}));

export const taskRelations = relations(task, ({ one }) => ({
  owner: one(user, { fields: [task.ownerId], references: [user.id] }),
}));

export const timerStateRelations = relations(timerState, ({ one }) => ({
  user: one(user, { fields: [timerState.userId], references: [user.id] }),
}));

export const timerConfigRelations = relations(timerConfig, ({ one }) => ({
  user: one(user, { fields: [timerConfig.userId], references: [user.id] }),
}));

export const timerStyleRelations = relations(timerStyle, ({ one }) => ({
  user: one(user, { fields: [timerStyle.userId], references: [user.id] }),
}));

export const taskStyleRelations = relations(taskStyle, ({ one }) => ({
  user: one(user, { fields: [taskStyle.userId], references: [user.id] }),
}));

export const botConfigRelations = relations(botConfig, ({ one }) => ({
  user: one(user, { fields: [botConfig.userId], references: [user.id] }),
}));
