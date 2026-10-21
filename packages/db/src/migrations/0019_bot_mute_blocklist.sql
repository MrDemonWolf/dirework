-- Bot moderation: a mute switch and a block list of lowercase Twitch logins.
-- bot.ingest reads both from the bot_config row it already loads, so the chat
-- path gains no round trip. Expand-only: the previous worker keeps serving
-- while this applies and simply ignores the new columns.
ALTER TABLE `bot_config` ADD `muted` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `bot_config` ADD `blocked_viewers` text DEFAULT '[]' NOT NULL;
