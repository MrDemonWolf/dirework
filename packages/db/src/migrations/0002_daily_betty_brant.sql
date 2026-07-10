PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_bot_account` (
	`id` text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	`twitch_id` text NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`scopes` text DEFAULT '["chat:read","chat:edit","user:read:chat","user:write:chat"]' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_bot_account`("id", "twitch_id", "username", "display_name", "access_token", "refresh_token", "expires_at", "scopes") SELECT "id", "twitch_id", "username", "display_name", "access_token", "refresh_token", "expires_at", "scopes" FROM `bot_account`;--> statement-breakpoint
DROP TABLE `bot_account`;--> statement-breakpoint
ALTER TABLE `__new_bot_account` RENAME TO `bot_account`;--> statement-breakpoint
PRAGMA foreign_keys=ON;