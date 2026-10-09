CREATE TABLE `processed_chat_message` (
	`id` text PRIMARY KEY NOT NULL,
	`processed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `task_author_username_lower_idx` ON `task` (lower("author_username"));