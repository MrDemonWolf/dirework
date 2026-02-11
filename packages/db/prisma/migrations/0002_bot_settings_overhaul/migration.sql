-- Bot settings overhaul: replace messages Json column with individual typed columns
-- Add command toggles, task messages, timer messages, and phase labels

-- Command toggles
ALTER TABLE "config" ADD COLUMN "task_commands_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "config" ADD COLUMN "timer_commands_enabled" BOOLEAN NOT NULL DEFAULT true;

-- Task messages
ALTER TABLE "config" ADD COLUMN "msg_task_added" TEXT NOT NULL DEFAULT 'Awooo! The task "{task}" has been added to the pack, {user}!';
ALTER TABLE "config" ADD COLUMN "msg_no_task_added" TEXT NOT NULL DEFAULT 'You''re already on the hunt {user}, use !check to see your current task!';
ALTER TABLE "config" ADD COLUMN "msg_no_task_content" TEXT NOT NULL DEFAULT 'Tell the pack what you''re working on! Use !add [task] {user}';
ALTER TABLE "config" ADD COLUMN "msg_no_task_to_edit" TEXT NOT NULL DEFAULT 'No task found in your den to edit {user}';
ALTER TABLE "config" ADD COLUMN "msg_task_edited" TEXT NOT NULL DEFAULT 'The hunt has changed! Task updated to "{task}" {user}';
ALTER TABLE "config" ADD COLUMN "msg_task_removed" TEXT NOT NULL DEFAULT 'Task "{task}" has been scent-wiped from the list, {user}';
ALTER TABLE "config" ADD COLUMN "msg_task_next" TEXT NOT NULL DEFAULT 'Paws-ome work finishing ''{oldTask}''! Now tracking ''{newTask}'', {user}!';
ALTER TABLE "config" ADD COLUMN "msg_admin_delete_tasks" TEXT NOT NULL DEFAULT 'All of the user''s tasks have been cleared from the forest.';
ALTER TABLE "config" ADD COLUMN "msg_task_done" TEXT NOT NULL DEFAULT 'Alpha work! You finished "{task}" {user}!';
ALTER TABLE "config" ADD COLUMN "msg_task_check" TEXT NOT NULL DEFAULT '{user}, your current scent is on: "{task}"';
ALTER TABLE "config" ADD COLUMN "msg_task_check_user" TEXT NOT NULL DEFAULT '{user}, {user2} is currently tracking: "{task}"';
ALTER TABLE "config" ADD COLUMN "msg_no_task" TEXT NOT NULL DEFAULT 'Looks like you aren''t tracking anything in the forest right now, {user}';
ALTER TABLE "config" ADD COLUMN "msg_no_task_other" TEXT NOT NULL DEFAULT 'The scent is cold... there is no task from that user {user}';
ALTER TABLE "config" ADD COLUMN "msg_not_mod" TEXT NOT NULL DEFAULT 'Grrr! Permission denied, {user}; Only pack leaders (mods) can do that.';
ALTER TABLE "config" ADD COLUMN "msg_cleared_all" TEXT NOT NULL DEFAULT 'The forest has been cleared of all tasks!';
ALTER TABLE "config" ADD COLUMN "msg_cleared_done" TEXT NOT NULL DEFAULT 'All finished tasks have been cleared from the den!';
ALTER TABLE "config" ADD COLUMN "msg_next_no_content" TEXT NOT NULL DEFAULT 'Don''t leave the pack hanging! Try !next [task] {user}';
ALTER TABLE "config" ADD COLUMN "msg_help" TEXT NOT NULL DEFAULT '{user} Join the hunt with !task, !remove, !edit, or !done.';

-- Timer messages
ALTER TABLE "config" ADD COLUMN "msg_work" TEXT NOT NULL DEFAULT 'Time to hunt some code! Focus mode activated!';
ALTER TABLE "config" ADD COLUMN "msg_break" TEXT NOT NULL DEFAULT 'Paws up! Time for a short rest in the den.';
ALTER TABLE "config" ADD COLUMN "msg_long_break" TEXT NOT NULL DEFAULT 'The whole pack is taking a long snooze! Back soon!';
ALTER TABLE "config" ADD COLUMN "msg_work_remind" TEXT NOT NULL DEFAULT 'Get ready to howl at that code @{channel}, focus starts in 25 seconds!';
ALTER TABLE "config" ADD COLUMN "msg_not_running" TEXT NOT NULL DEFAULT 'The timer isn''t howling yet! Start it up first.';
ALTER TABLE "config" ADD COLUMN "msg_stream_starting" TEXT NOT NULL DEFAULT 'The Blue Wolf is waking up! Stream starting!';
ALTER TABLE "config" ADD COLUMN "msg_wrong_command" TEXT NOT NULL DEFAULT 'My ears didn''t catch that... Command not recognized!';
ALTER TABLE "config" ADD COLUMN "msg_timer_running" TEXT NOT NULL DEFAULT 'The hunt is already in progress!';
ALTER TABLE "config" ADD COLUMN "msg_command_success" TEXT NOT NULL DEFAULT 'Paw-fect! Done!';
ALTER TABLE "config" ADD COLUMN "msg_cycle_wrong" TEXT NOT NULL DEFAULT 'The cycle cannot outrun the goal!';
ALTER TABLE "config" ADD COLUMN "msg_goal_wrong" TEXT NOT NULL DEFAULT 'The goal needs to be further than the cycle!';
ALTER TABLE "config" ADD COLUMN "msg_finish_response" TEXT NOT NULL DEFAULT 'Great work today pack! We hunted well.';
ALTER TABLE "config" ADD COLUMN "msg_already_starting" TEXT NOT NULL DEFAULT 'The pack is already moving or the timer is running!';
ALTER TABLE "config" ADD COLUMN "msg_eta" TEXT NOT NULL DEFAULT 'The hunt will end at {time}';

-- Phase labels (shown on timer overlay)
ALTER TABLE "config" ADD COLUMN "label_idle" TEXT NOT NULL DEFAULT 'Ready';
ALTER TABLE "config" ADD COLUMN "label_starting" TEXT NOT NULL DEFAULT 'Starting';
ALTER TABLE "config" ADD COLUMN "label_work" TEXT NOT NULL DEFAULT 'Focus';
ALTER TABLE "config" ADD COLUMN "label_break" TEXT NOT NULL DEFAULT 'Break';
ALTER TABLE "config" ADD COLUMN "label_long_break" TEXT NOT NULL DEFAULT 'Long Break';
ALTER TABLE "config" ADD COLUMN "label_paused" TEXT NOT NULL DEFAULT 'Paused';
ALTER TABLE "config" ADD COLUMN "label_finished" TEXT NOT NULL DEFAULT 'Done';

-- Drop the old messages Json column
ALTER TABLE "config" DROP COLUMN "messages";
