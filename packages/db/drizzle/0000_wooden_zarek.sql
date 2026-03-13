CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"twitch_id" text,
	"display_name" text,
	"overlay_timer_token" text NOT NULL,
	"overlay_tasks_token" text NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_twitch_id_unique" UNIQUE("twitch_id")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot_account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"twitch_id" text NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"scopes" text[] DEFAULT '{"chat:read","chat:edit","channel:moderate","user:read:chat"}' NOT NULL,
	CONSTRAINT "bot_account_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "bot_config" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"task_commands_enabled" boolean DEFAULT true NOT NULL,
	"timer_commands_enabled" boolean DEFAULT true NOT NULL,
	"command_aliases" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"msg_task_added" text DEFAULT 'Awooo! The task "{task}" has been added to the pack, {user}!' NOT NULL,
	"msg_no_task_added" text DEFAULT 'You''re already on the hunt {user}, use !check to see your current task!' NOT NULL,
	"msg_no_task_content" text DEFAULT 'Tell the pack what you''re working on! Use !task [task] {user}' NOT NULL,
	"msg_no_task_to_edit" text DEFAULT 'No task found in your den to edit {user}' NOT NULL,
	"msg_task_edited" text DEFAULT 'The hunt has changed! Task updated to "{task}" {user}' NOT NULL,
	"msg_task_removed" text DEFAULT 'Task "{task}" has been scent-wiped from the list, {user}' NOT NULL,
	"msg_task_next" text DEFAULT 'Paws-ome work finishing ''{oldTask}''! Now tracking ''{newTask}'', {user}!' NOT NULL,
	"msg_admin_delete_tasks" text DEFAULT 'All of the user''s tasks have been cleared from the forest.' NOT NULL,
	"msg_task_done" text DEFAULT 'Alpha work! You finished "{task}" {user}!' NOT NULL,
	"msg_task_check" text DEFAULT '{user}, your current scent is on: "{task}"' NOT NULL,
	"msg_task_check_user" text DEFAULT '{user}, {user2} is currently tracking: "{task}"' NOT NULL,
	"msg_no_task" text DEFAULT 'Looks like you aren''t tracking anything in the forest right now, {user}' NOT NULL,
	"msg_no_task_other" text DEFAULT 'The scent is cold... there is no task from that user {user}' NOT NULL,
	"msg_not_mod" text DEFAULT 'Grrr! Permission denied, {user}; Only pack leaders (mods) can do that.' NOT NULL,
	"msg_cleared_all" text DEFAULT 'The forest has been cleared of all tasks!' NOT NULL,
	"msg_cleared_done" text DEFAULT 'All finished tasks have been cleared from the den!' NOT NULL,
	"msg_next_no_content" text DEFAULT 'Don''t leave the pack hanging! Try !next [task] {user}' NOT NULL,
	"msg_help" text DEFAULT '{user} Join the hunt with !task, !remove, !edit, or !done.' NOT NULL,
	"msg_work" text DEFAULT 'Time to hunt some code! Focus mode activated!' NOT NULL,
	"msg_break" text DEFAULT 'Paws up! Time for a short rest in the den.' NOT NULL,
	"msg_long_break" text DEFAULT 'The whole pack is taking a long snooze! Back soon!' NOT NULL,
	"msg_work_remind" text DEFAULT 'Get ready to howl at that code @{channel}, focus starts in 25 seconds!' NOT NULL,
	"msg_not_running" text DEFAULT 'The timer isn''t howling yet! Start it up first.' NOT NULL,
	"msg_stream_starting" text DEFAULT 'The Blue Wolf is waking up! Stream starting!' NOT NULL,
	"msg_wrong_command" text DEFAULT 'My ears didn''t catch that... Command not recognized!' NOT NULL,
	"msg_timer_running" text DEFAULT 'The hunt is already in progress!' NOT NULL,
	"msg_command_success" text DEFAULT 'Paw-fect! Done!' NOT NULL,
	"msg_cycle_wrong" text DEFAULT 'The cycle cannot outrun the goal!' NOT NULL,
	"msg_goal_wrong" text DEFAULT 'The goal needs to be further than the cycle!' NOT NULL,
	"msg_finish_response" text DEFAULT 'Great work today pack! We hunted well.' NOT NULL,
	"msg_already_starting" text DEFAULT 'The pack is already moving or the timer is running!' NOT NULL,
	"msg_eta" text DEFAULT 'The hunt will end at {time}' NOT NULL,
	CONSTRAINT "bot_config_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"author_twitch_id" text NOT NULL,
	"author_username" text NOT NULL,
	"author_display_name" text NOT NULL,
	"author_color" text,
	"text" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"order" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "task_style" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"display_show_done" boolean DEFAULT true NOT NULL,
	"display_show_count" boolean DEFAULT true NOT NULL,
	"display_use_checkboxes" boolean DEFAULT true NOT NULL,
	"display_cross_on_done" boolean DEFAULT true NOT NULL,
	"display_number_of_lines" integer DEFAULT 2 NOT NULL,
	"font_header" text DEFAULT 'Montserrat' NOT NULL,
	"font_body" text DEFAULT 'Roboto' NOT NULL,
	"scroll_enabled" boolean DEFAULT true NOT NULL,
	"scroll_pixels_per_second" integer DEFAULT 70 NOT NULL,
	"scroll_gap_between_loops" integer DEFAULT 100 NOT NULL,
	"header_height" text DEFAULT '52px' NOT NULL,
	"header_bg_color" text DEFAULT '#1c1c1e' NOT NULL,
	"header_bg_opacity" double precision DEFAULT 0.95 NOT NULL,
	"header_border_color" text DEFAULT '#3a3a3c' NOT NULL,
	"header_border_width" text DEFAULT '1px' NOT NULL,
	"header_border_radius" text DEFAULT '12px 12px 0 0' NOT NULL,
	"header_font_size" text DEFAULT '24px' NOT NULL,
	"header_font_color" text DEFAULT '#ffffff' NOT NULL,
	"header_padding" text DEFAULT '12px 16px' NOT NULL,
	"body_bg_color" text DEFAULT '#1c1c1e' NOT NULL,
	"body_bg_opacity" double precision DEFAULT 0.85 NOT NULL,
	"body_border_color" text DEFAULT '#3a3a3c' NOT NULL,
	"body_border_width" text DEFAULT '1px' NOT NULL,
	"body_border_radius" text DEFAULT '0 0 12px 12px' NOT NULL,
	"body_padding_vertical" text DEFAULT '6px' NOT NULL,
	"body_padding_horizontal" text DEFAULT '6px' NOT NULL,
	"task_bg_color" text DEFAULT '#2c2c2e' NOT NULL,
	"task_bg_opacity" double precision DEFAULT 0.9 NOT NULL,
	"task_border_color" text DEFAULT '#3a3a3c' NOT NULL,
	"task_border_width" text DEFAULT '0px' NOT NULL,
	"task_border_radius" text DEFAULT '10px' NOT NULL,
	"task_font_size" text DEFAULT '22px' NOT NULL,
	"task_font_color" text DEFAULT '#f5f5f7' NOT NULL,
	"task_username_color" text DEFAULT '#bf5af2' NOT NULL,
	"task_padding" text DEFAULT '10px 14px' NOT NULL,
	"task_margin_bottom" text DEFAULT '4px' NOT NULL,
	"task_max_width" text DEFAULT '100%' NOT NULL,
	"task_done_bg_color" text DEFAULT '#1c1c1e' NOT NULL,
	"task_done_bg_opacity" double precision DEFAULT 0.5 NOT NULL,
	"task_done_font_color" text DEFAULT '#8e8e93' NOT NULL,
	"checkbox_size" text DEFAULT '20px' NOT NULL,
	"checkbox_bg_color" text DEFAULT '#000000' NOT NULL,
	"checkbox_bg_opacity" double precision DEFAULT 0 NOT NULL,
	"checkbox_border_color" text DEFAULT '#636366' NOT NULL,
	"checkbox_border_width" text DEFAULT '2px' NOT NULL,
	"checkbox_border_radius" text DEFAULT '6px' NOT NULL,
	"checkbox_margin_top" text DEFAULT '4px' NOT NULL,
	"checkbox_margin_left" text DEFAULT '2px' NOT NULL,
	"checkbox_margin_right" text DEFAULT '8px' NOT NULL,
	"checkbox_tick_char" text DEFAULT '✔' NOT NULL,
	"checkbox_tick_size" text DEFAULT '14px' NOT NULL,
	"checkbox_tick_color" text DEFAULT '#34c759' NOT NULL,
	"bullet_char" text DEFAULT '•' NOT NULL,
	"bullet_size" text DEFAULT '20px' NOT NULL,
	"bullet_color" text DEFAULT '#8e8e93' NOT NULL,
	"bullet_margin_top" text DEFAULT '0px' NOT NULL,
	"bullet_margin_left" text DEFAULT '2px' NOT NULL,
	"bullet_margin_right" text DEFAULT '8px' NOT NULL,
	CONSTRAINT "task_style_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "timer_config" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"work_duration" integer DEFAULT 1500000 NOT NULL,
	"break_duration" integer DEFAULT 300000 NOT NULL,
	"long_break_duration" integer DEFAULT 900000 NOT NULL,
	"long_break_interval" integer DEFAULT 4 NOT NULL,
	"starting_duration" integer DEFAULT 5000 NOT NULL,
	"default_cycles" integer DEFAULT 4 NOT NULL,
	"show_hours" boolean DEFAULT false NOT NULL,
	"no_last_break" boolean DEFAULT true NOT NULL,
	"label_idle" text DEFAULT 'Ready' NOT NULL,
	"label_starting" text DEFAULT 'Starting' NOT NULL,
	"label_work" text DEFAULT 'Focus' NOT NULL,
	"label_break" text DEFAULT 'Break' NOT NULL,
	"label_long_break" text DEFAULT 'Long Break' NOT NULL,
	"label_paused" text DEFAULT 'Paused' NOT NULL,
	"label_finished" text DEFAULT 'Done' NOT NULL,
	CONSTRAINT "timer_config_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "timer_state" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'idle' NOT NULL,
	"target_end_time" timestamp,
	"paused_with_remaining" integer,
	"paused_from_status" text,
	"current_cycle" integer DEFAULT 1 NOT NULL,
	"total_cycles" integer DEFAULT 4 NOT NULL,
	CONSTRAINT "timer_state_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "timer_style" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"width" text DEFAULT '250px' NOT NULL,
	"height" text DEFAULT '250px' NOT NULL,
	"bg_color" text DEFAULT '#1c1c1e' NOT NULL,
	"bg_opacity" double precision DEFAULT 0.85 NOT NULL,
	"bg_border_radius" text DEFAULT '22%' NOT NULL,
	"ring_enabled" boolean DEFAULT true NOT NULL,
	"ring_track_color" text DEFAULT '#ffffff' NOT NULL,
	"ring_track_opacity" double precision DEFAULT 0.1 NOT NULL,
	"ring_fill_color" text DEFAULT '#34c759' NOT NULL,
	"ring_fill_opacity" double precision DEFAULT 1 NOT NULL,
	"ring_width" integer DEFAULT 8 NOT NULL,
	"ring_gap" integer DEFAULT 6 NOT NULL,
	"text_color" text DEFAULT '#ffffff' NOT NULL,
	"text_outline_color" text DEFAULT '#000000' NOT NULL,
	"text_outline_size" text DEFAULT '0px' NOT NULL,
	"text_font_family" text DEFAULT 'Montserrat' NOT NULL,
	"font_size_label" text DEFAULT '18px' NOT NULL,
	"font_size_time" text DEFAULT '48px' NOT NULL,
	"font_size_cycle" text DEFAULT '16px' NOT NULL,
	CONSTRAINT "timer_style_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_account" ADD CONSTRAINT "bot_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_config" ADD CONSTRAINT "bot_config_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_style" ADD CONSTRAINT "task_style_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timer_config" ADD CONSTRAINT "timer_config_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timer_state" ADD CONSTRAINT "timer_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timer_style" ADD CONSTRAINT "timer_style_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "task_owner_status_idx" ON "task" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "task_owner_priority_order_idx" ON "task" USING btree ("owner_id","priority","order");--> statement-breakpoint
CREATE INDEX "task_owner_author_idx" ON "task" USING btree ("owner_id","author_twitch_id");