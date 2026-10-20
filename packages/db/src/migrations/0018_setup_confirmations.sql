-- Dashboard setup checklist: three flags the owner flips by hand through
-- user.confirmSetupStep; user.me reads them from the row it already selects.
-- Expand-only: the previous worker keeps serving while this applies.
ALTER TABLE `instance_config` ADD `setup_bot_source_confirmed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `instance_config` ADD `setup_timer_overlay_confirmed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `instance_config` ADD `setup_tasks_overlay_confirmed` integer DEFAULT false NOT NULL;