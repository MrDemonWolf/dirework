PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_bot_config` (
	`id` text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	`task_commands_enabled` integer DEFAULT true NOT NULL,
	`timer_commands_enabled` integer DEFAULT true NOT NULL,
	`command_aliases` text DEFAULT '{}' NOT NULL,
	`msg_task_added` text DEFAULT 'Awooo! The task "{task}" has been added to the pack, {user}!' NOT NULL,
	`msg_no_task_added` text DEFAULT 'Your paws are full, {user}! Finish a task with !done before adding another.' NOT NULL,
	`msg_no_task_content` text DEFAULT 'Tell the pack what you''re working on! Use !task [task], {user}!' NOT NULL,
	`msg_no_task_to_edit` text DEFAULT 'No task in your den to edit, {user} — try !edit [number] [new task]!' NOT NULL,
	`msg_task_edited` text DEFAULT 'The hunt has changed! Task updated to "{task}" {user}' NOT NULL,
	`msg_task_removed` text DEFAULT 'Task "{task}" has been scent-wiped from the list, {user}' NOT NULL,
	`msg_task_next` text DEFAULT 'Paws-ome work finishing ''{oldTask}''! Now tracking ''{newTask}'', {user}!' NOT NULL,
	`msg_admin_delete_tasks` text DEFAULT 'All of the user''s tasks have been cleared from the forest.' NOT NULL,
	`msg_task_done` text DEFAULT 'Alpha work! You finished "{task}" {user}!' NOT NULL,
	`msg_task_check` text DEFAULT '{user}, you''re on the scent of "{task}"' NOT NULL,
	`msg_task_check_user` text DEFAULT '{user}, {user2} is currently tracking: "{task}"' NOT NULL,
	`msg_no_task` text DEFAULT 'Looks like you aren''t tracking anything in the forest right now, {user} — start a hunt with !task [task]!' NOT NULL,
	`msg_no_task_other` text DEFAULT 'The scent is cold, {user} — that viewer isn''t tracking a task right now.' NOT NULL,
	`msg_not_mod` text DEFAULT 'Grrr! Permission denied, {user} — only pack leaders (mods) can do that.' NOT NULL,
	`msg_cleared_all` text DEFAULT 'The forest has been cleared of all tasks!' NOT NULL,
	`msg_cleared_done` text DEFAULT 'All finished tasks have been cleared from the den!' NOT NULL,
	`msg_next_no_content` text DEFAULT 'Don''t leave the pack hanging! Try !next [task], {user}!' NOT NULL,
	`msg_help` text DEFAULT '{user}, join the hunt: !task, !done, !edit, !remove, !focus, !check, !next — or !dwhelp for the full list.' NOT NULL,
	`msg_work` text DEFAULT 'Time to hunt! Focus mode activated!' NOT NULL,
	`msg_break` text DEFAULT 'Paws up! Time for a short rest in the den.' NOT NULL,
	`msg_long_break` text DEFAULT 'The whole pack is taking a long snooze! Back soon!' NOT NULL,
	`msg_work_remind` text DEFAULT 'Get ready to howl, @{channel} — focus starts in a moment!' NOT NULL,
	`msg_not_running` text DEFAULT 'The timer isn''t howling yet! Start it up first.' NOT NULL,
	`msg_stream_starting` text DEFAULT 'The pack is waking up! Stream starting!' NOT NULL,
	`msg_wrong_command` text DEFAULT 'My ears didn''t catch that... Try !timer start, pause, resume, skip, reset, or eta.' NOT NULL,
	`msg_timer_running` text DEFAULT 'The hunt is already in progress!' NOT NULL,
	`msg_command_success` text DEFAULT 'Paw-fect! Done!' NOT NULL,
	`msg_cycle_wrong` text DEFAULT 'That cycle count won''t work — pick 1 to 99, like !timer start 4.' NOT NULL,
	`msg_goal_wrong` text DEFAULT 'The goal needs to be further than the cycle!' NOT NULL,
	`msg_finish_response` text DEFAULT 'Great work today pack! We hunted well.' NOT NULL,
	`msg_already_starting` text DEFAULT 'The pack is already moving or the timer is running!' NOT NULL,
	`msg_eta` text DEFAULT 'This phase ends in {phase} · the hunt is done in {time}' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_bot_config`("id", "task_commands_enabled", "timer_commands_enabled", "command_aliases", "msg_task_added", "msg_no_task_added", "msg_no_task_content", "msg_no_task_to_edit", "msg_task_edited", "msg_task_removed", "msg_task_next", "msg_admin_delete_tasks", "msg_task_done", "msg_task_check", "msg_task_check_user", "msg_no_task", "msg_no_task_other", "msg_not_mod", "msg_cleared_all", "msg_cleared_done", "msg_next_no_content", "msg_help", "msg_work", "msg_break", "msg_long_break", "msg_work_remind", "msg_not_running", "msg_stream_starting", "msg_wrong_command", "msg_timer_running", "msg_command_success", "msg_cycle_wrong", "msg_goal_wrong", "msg_finish_response", "msg_already_starting", "msg_eta") SELECT "id", "task_commands_enabled", "timer_commands_enabled", "command_aliases", "msg_task_added", "msg_no_task_added", "msg_no_task_content", "msg_no_task_to_edit", "msg_task_edited", "msg_task_removed", "msg_task_next", "msg_admin_delete_tasks", "msg_task_done", "msg_task_check", "msg_task_check_user", "msg_no_task", "msg_no_task_other", "msg_not_mod", "msg_cleared_all", "msg_cleared_done", "msg_next_no_content", "msg_help", "msg_work", "msg_break", "msg_long_break", "msg_work_remind", "msg_not_running", "msg_stream_starting", "msg_wrong_command", "msg_timer_running", "msg_command_success", "msg_cycle_wrong", "msg_goal_wrong", "msg_finish_response", "msg_already_starting", "msg_eta" FROM `bot_config`;--> statement-breakpoint
DROP TABLE `bot_config`;--> statement-breakpoint
ALTER TABLE `__new_bot_config` RENAME TO `bot_config`;--> statement-breakpoint
PRAGMA foreign_keys=ON;