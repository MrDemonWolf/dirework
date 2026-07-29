-- Repair before enforcing: a DB written by the pre-P1.7 service could already
-- hold more than one active task for a viewer (the create/activate paths were
-- check-then-act races). CREATE UNIQUE INDEX would fail outright on such a row
-- and break the deploy, so demote the extras first, keeping one per author.
UPDATE `task` SET `status` = 'pending'
WHERE `status` = 'active'
  AND `id` NOT IN (
    SELECT MIN(`id`) FROM `task` WHERE `status` = 'active' GROUP BY `author_twitch_id`
  );
--> statement-breakpoint
CREATE UNIQUE INDEX `task_one_active_per_author_idx` ON `task` (`author_twitch_id`) WHERE "task"."status" = 'active';
