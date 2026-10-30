ALTER TABLE `bot_config` ADD `msg_task_started` text DEFAULT 'Started "{task}", {user}. {count}/{max} in progress.' NOT NULL;--> statement-breakpoint
ALTER TABLE `bot_config` ADD `msg_task_started_focus` text DEFAULT 'Started "{task}", {user}. It''s your focus now.' NOT NULL;--> statement-breakpoint
ALTER TABLE `bot_config` ADD `msg_start_cap_reached` text DEFAULT '{user}, you already have {max} going. Finish one with !done or pause one with !pause.' NOT NULL;--> statement-breakpoint
ALTER TABLE `bot_config` ADD `msg_no_task_to_start` text DEFAULT 'Nothing to start there, {user}. Pick a waiting task from !today, like !start 2.' NOT NULL;--> statement-breakpoint
ALTER TABLE `bot_config` ADD `msg_task_paused` text DEFAULT 'Paused "{task}", {user}. It waits in line until you !start it again.' NOT NULL;--> statement-breakpoint
ALTER TABLE `bot_config` ADD `msg_no_task_to_pause` text DEFAULT 'Nothing to pause, {user}. !today shows what you have going.' NOT NULL;