DROP INDEX `task_status_idx`;--> statement-breakpoint
CREATE INDEX `task_status_completed_idx` ON `task` (`status`,`completed_at`);--> statement-breakpoint
-- Done tasks are purged 24h after completed_at. A legacy done row with no
-- completed_at would never match that range, so stamp it with its creation
-- time: it becomes eligible for the next purge instead of living forever.
UPDATE `task` SET `completed_at` = `created_at` WHERE `status` = 'done' AND `completed_at` IS NULL;
