-- Dashboard stats: one row per local day, plus the owner's IANA time zone that
-- decides which day a stat lands on. Expand-only: the previous worker keeps
-- serving while this applies and never reads the new table or column.
CREATE TABLE `daily_stat` (
	`day` text PRIMARY KEY NOT NULL,
	`focus_ms` integer DEFAULT 0 NOT NULL,
	`pomodoros` integer DEFAULT 0 NOT NULL,
	`tasks_done` integer DEFAULT 0 NOT NULL,
	`tasks_done_chat` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `instance_config` ADD `time_zone` text;