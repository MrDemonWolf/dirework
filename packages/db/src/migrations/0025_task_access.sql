CREATE TABLE `follower_check` (
	`twitch_id` text PRIMARY KEY NOT NULL,
	`following` integer NOT NULL,
	`checked_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `follower_check_checked_at_idx` ON `follower_check` (`checked_at`);--> statement-breakpoint
ALTER TABLE `bot_config` ADD `task_access` text DEFAULT 'everyone' NOT NULL;--> statement-breakpoint
ALTER TABLE `bot_config` ADD `msg_not_follower` text DEFAULT 'Only followers can add tasks here, {user}. Follow the channel, then try again.' NOT NULL;--> statement-breakpoint
ALTER TABLE `bot_config` ADD `msg_not_subscriber` text DEFAULT 'Only subscribers can add tasks here, {user}.' NOT NULL;--> statement-breakpoint
ALTER TABLE `bot_config` ADD `msg_not_vip` text DEFAULT 'Only VIPs and mods can add tasks here, {user}.' NOT NULL;--> statement-breakpoint
ALTER TABLE `bot_config` ADD `msg_follow_check_failed` text DEFAULT 'I couldn''t check your follow just now, {user}. Try again in a minute.' NOT NULL;