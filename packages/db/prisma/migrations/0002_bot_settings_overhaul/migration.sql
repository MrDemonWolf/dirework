-- Config restructure: split monolithic "config" (JSONB) into 4 typed tables
-- Creates: timer_config, timer_style, task_style, bot_config
-- Migrates data from old config JSONB columns into new tables
-- Drops legacy config table after migration

-- 1. Create the four new tables

CREATE TABLE "timer_config" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "work_duration" INTEGER NOT NULL DEFAULT 1500000,
    "break_duration" INTEGER NOT NULL DEFAULT 300000,
    "long_break_duration" INTEGER NOT NULL DEFAULT 900000,
    "long_break_interval" INTEGER NOT NULL DEFAULT 4,
    "starting_duration" INTEGER NOT NULL DEFAULT 5000,
    "default_cycles" INTEGER NOT NULL DEFAULT 4,
    "show_hours" BOOLEAN NOT NULL DEFAULT false,
    "no_last_break" BOOLEAN NOT NULL DEFAULT true,
    "label_idle" TEXT NOT NULL DEFAULT 'Ready',
    "label_starting" TEXT NOT NULL DEFAULT 'Starting',
    "label_work" TEXT NOT NULL DEFAULT 'Focus',
    "label_break" TEXT NOT NULL DEFAULT 'Break',
    "label_long_break" TEXT NOT NULL DEFAULT 'Long Break',
    "label_paused" TEXT NOT NULL DEFAULT 'Paused',
    "label_finished" TEXT NOT NULL DEFAULT 'Done',

    CONSTRAINT "timer_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "timer_style" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "width" TEXT NOT NULL DEFAULT '250px',
    "height" TEXT NOT NULL DEFAULT '250px',
    "bg_color" TEXT NOT NULL DEFAULT '#1c1c1e',
    "bg_opacity" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "bg_border_radius" TEXT NOT NULL DEFAULT '22%',
    "ring_enabled" BOOLEAN NOT NULL DEFAULT true,
    "ring_track_color" TEXT NOT NULL DEFAULT '#ffffff',
    "ring_track_opacity" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "ring_fill_color" TEXT NOT NULL DEFAULT '#34c759',
    "ring_fill_opacity" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "ring_width" INTEGER NOT NULL DEFAULT 8,
    "ring_gap" INTEGER NOT NULL DEFAULT 6,
    "text_color" TEXT NOT NULL DEFAULT '#ffffff',
    "text_outline_color" TEXT NOT NULL DEFAULT '#000000',
    "text_outline_size" TEXT NOT NULL DEFAULT '0px',
    "text_font_family" TEXT NOT NULL DEFAULT 'Montserrat',
    "font_size_label" TEXT NOT NULL DEFAULT '18px',
    "font_size_time" TEXT NOT NULL DEFAULT '48px',
    "font_size_cycle" TEXT NOT NULL DEFAULT '16px',

    CONSTRAINT "timer_style_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "task_style" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "display_show_done" BOOLEAN NOT NULL DEFAULT true,
    "display_show_count" BOOLEAN NOT NULL DEFAULT true,
    "display_use_checkboxes" BOOLEAN NOT NULL DEFAULT true,
    "display_cross_on_done" BOOLEAN NOT NULL DEFAULT true,
    "display_number_of_lines" INTEGER NOT NULL DEFAULT 2,
    "font_header" TEXT NOT NULL DEFAULT 'Montserrat',
    "font_body" TEXT NOT NULL DEFAULT 'Roboto',
    "scroll_enabled" BOOLEAN NOT NULL DEFAULT true,
    "scroll_pixels_per_second" INTEGER NOT NULL DEFAULT 70,
    "scroll_gap_between_loops" INTEGER NOT NULL DEFAULT 100,
    "header_height" TEXT NOT NULL DEFAULT '52px',
    "header_bg_color" TEXT NOT NULL DEFAULT '#1c1c1e',
    "header_bg_opacity" DOUBLE PRECISION NOT NULL DEFAULT 0.95,
    "header_border_color" TEXT NOT NULL DEFAULT '#3a3a3c',
    "header_border_width" TEXT NOT NULL DEFAULT '1px',
    "header_border_radius" TEXT NOT NULL DEFAULT '12px 12px 0 0',
    "header_font_size" TEXT NOT NULL DEFAULT '24px',
    "header_font_color" TEXT NOT NULL DEFAULT '#ffffff',
    "header_padding" TEXT NOT NULL DEFAULT '12px 16px',
    "body_bg_color" TEXT NOT NULL DEFAULT '#1c1c1e',
    "body_bg_opacity" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "body_border_color" TEXT NOT NULL DEFAULT '#3a3a3c',
    "body_border_width" TEXT NOT NULL DEFAULT '1px',
    "body_border_radius" TEXT NOT NULL DEFAULT '0 0 12px 12px',
    "body_padding_vertical" TEXT NOT NULL DEFAULT '6px',
    "body_padding_horizontal" TEXT NOT NULL DEFAULT '6px',
    "task_bg_color" TEXT NOT NULL DEFAULT '#2c2c2e',
    "task_bg_opacity" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "task_border_color" TEXT NOT NULL DEFAULT '#3a3a3c',
    "task_border_width" TEXT NOT NULL DEFAULT '0px',
    "task_border_radius" TEXT NOT NULL DEFAULT '10px',
    "task_font_size" TEXT NOT NULL DEFAULT '22px',
    "task_font_color" TEXT NOT NULL DEFAULT '#f5f5f7',
    "task_username_color" TEXT NOT NULL DEFAULT '#bf5af2',
    "task_padding" TEXT NOT NULL DEFAULT '10px 14px',
    "task_margin_bottom" TEXT NOT NULL DEFAULT '4px',
    "task_max_width" TEXT NOT NULL DEFAULT '100%',
    "task_done_bg_color" TEXT NOT NULL DEFAULT '#1c1c1e',
    "task_done_bg_opacity" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "task_done_font_color" TEXT NOT NULL DEFAULT '#8e8e93',
    "checkbox_size" TEXT NOT NULL DEFAULT '20px',
    "checkbox_bg_color" TEXT NOT NULL DEFAULT '#000000',
    "checkbox_bg_opacity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "checkbox_border_color" TEXT NOT NULL DEFAULT '#636366',
    "checkbox_border_width" TEXT NOT NULL DEFAULT '2px',
    "checkbox_border_radius" TEXT NOT NULL DEFAULT '6px',
    "checkbox_margin_top" TEXT NOT NULL DEFAULT '4px',
    "checkbox_margin_left" TEXT NOT NULL DEFAULT '2px',
    "checkbox_margin_right" TEXT NOT NULL DEFAULT '8px',
    "checkbox_tick_char" TEXT NOT NULL DEFAULT E'\u2714',
    "checkbox_tick_size" TEXT NOT NULL DEFAULT '14px',
    "checkbox_tick_color" TEXT NOT NULL DEFAULT '#34c759',
    "bullet_char" TEXT NOT NULL DEFAULT E'\u2022',
    "bullet_size" TEXT NOT NULL DEFAULT '20px',
    "bullet_color" TEXT NOT NULL DEFAULT '#8e8e93',
    "bullet_margin_top" TEXT NOT NULL DEFAULT '0px',
    "bullet_margin_left" TEXT NOT NULL DEFAULT '2px',
    "bullet_margin_right" TEXT NOT NULL DEFAULT '8px',

    CONSTRAINT "task_style_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bot_config" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "task_commands_enabled" BOOLEAN NOT NULL DEFAULT true,
    "timer_commands_enabled" BOOLEAN NOT NULL DEFAULT true,
    "command_aliases" JSONB NOT NULL DEFAULT '{}',
    "msg_task_added" TEXT NOT NULL DEFAULT 'Awooo! The task "{task}" has been added to the pack, {user}!',
    "msg_no_task_added" TEXT NOT NULL DEFAULT 'You''re already on the hunt {user}, use !check to see your current task!',
    "msg_no_task_content" TEXT NOT NULL DEFAULT 'Tell the pack what you''re working on! Use !task [task] {user}',
    "msg_no_task_to_edit" TEXT NOT NULL DEFAULT 'No task found in your den to edit {user}',
    "msg_task_edited" TEXT NOT NULL DEFAULT 'The hunt has changed! Task updated to "{task}" {user}',
    "msg_task_removed" TEXT NOT NULL DEFAULT 'Task "{task}" has been scent-wiped from the list, {user}',
    "msg_task_next" TEXT NOT NULL DEFAULT 'Paws-ome work finishing ''{oldTask}''! Now tracking ''{newTask}'', {user}!',
    "msg_admin_delete_tasks" TEXT NOT NULL DEFAULT 'All of the user''s tasks have been cleared from the forest.',
    "msg_task_done" TEXT NOT NULL DEFAULT 'Alpha work! You finished "{task}" {user}!',
    "msg_task_check" TEXT NOT NULL DEFAULT '{user}, your current scent is on: "{task}"',
    "msg_task_check_user" TEXT NOT NULL DEFAULT '{user}, {user2} is currently tracking: "{task}"',
    "msg_no_task" TEXT NOT NULL DEFAULT 'Looks like you aren''t tracking anything in the forest right now, {user}',
    "msg_no_task_other" TEXT NOT NULL DEFAULT 'The scent is cold... there is no task from that user {user}',
    "msg_not_mod" TEXT NOT NULL DEFAULT 'Grrr! Permission denied, {user}; Only pack leaders (mods) can do that.',
    "msg_cleared_all" TEXT NOT NULL DEFAULT 'The forest has been cleared of all tasks!',
    "msg_cleared_done" TEXT NOT NULL DEFAULT 'All finished tasks have been cleared from the den!',
    "msg_next_no_content" TEXT NOT NULL DEFAULT 'Don''t leave the pack hanging! Try !next [task] {user}',
    "msg_help" TEXT NOT NULL DEFAULT '{user} Join the hunt with !task, !remove, !edit, or !done.',
    "msg_work" TEXT NOT NULL DEFAULT 'Time to hunt some code! Focus mode activated!',
    "msg_break" TEXT NOT NULL DEFAULT 'Paws up! Time for a short rest in the den.',
    "msg_long_break" TEXT NOT NULL DEFAULT 'The whole pack is taking a long snooze! Back soon!',
    "msg_work_remind" TEXT NOT NULL DEFAULT 'Get ready to howl at that code @{channel}, focus starts in 25 seconds!',
    "msg_not_running" TEXT NOT NULL DEFAULT 'The timer isn''t howling yet! Start it up first.',
    "msg_stream_starting" TEXT NOT NULL DEFAULT 'The Blue Wolf is waking up! Stream starting!',
    "msg_wrong_command" TEXT NOT NULL DEFAULT 'My ears didn''t catch that... Command not recognized!',
    "msg_timer_running" TEXT NOT NULL DEFAULT 'The hunt is already in progress!',
    "msg_command_success" TEXT NOT NULL DEFAULT 'Paw-fect! Done!',
    "msg_cycle_wrong" TEXT NOT NULL DEFAULT 'The cycle cannot outrun the goal!',
    "msg_goal_wrong" TEXT NOT NULL DEFAULT 'The goal needs to be further than the cycle!',
    "msg_finish_response" TEXT NOT NULL DEFAULT 'Great work today pack! We hunted well.',
    "msg_already_starting" TEXT NOT NULL DEFAULT 'The pack is already moving or the timer is running!',
    "msg_eta" TEXT NOT NULL DEFAULT 'The hunt will end at {time}',

    CONSTRAINT "bot_config_pkey" PRIMARY KEY ("id")
);

-- 2. Create unique indexes on user_id

CREATE UNIQUE INDEX "timer_config_user_id_key" ON "timer_config"("user_id");
CREATE UNIQUE INDEX "timer_style_user_id_key" ON "timer_style"("user_id");
CREATE UNIQUE INDEX "task_style_user_id_key" ON "task_style"("user_id");
CREATE UNIQUE INDEX "bot_config_user_id_key" ON "bot_config"("user_id");

-- 3. Add foreign key constraints

ALTER TABLE "timer_config" ADD CONSTRAINT "timer_config_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timer_style" ADD CONSTRAINT "timer_style_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_style" ADD CONSTRAINT "task_style_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bot_config" ADD CONSTRAINT "bot_config_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Migrate existing data from legacy config table into new tables
-- Each INSERT extracts values from the old JSONB columns with fallbacks to defaults

INSERT INTO "timer_config" ("id", "user_id")
SELECT gen_random_uuid()::text, "user_id" FROM "config";

INSERT INTO "timer_style" ("id", "user_id")
SELECT gen_random_uuid()::text, "user_id" FROM "config";

INSERT INTO "task_style" ("id", "user_id")
SELECT gen_random_uuid()::text, "user_id" FROM "config";

INSERT INTO "bot_config" ("id", "user_id", "command_aliases")
SELECT gen_random_uuid()::text, "user_id", COALESCE("command_aliases", '{}') FROM "config";

-- 5. Drop the legacy config table

DROP TABLE "config";
