import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

// Singleton pattern: one row per table, primary key pinned to "singleton".
export const SINGLETON_ID = "singleton";

export const instanceConfig = sqliteTable("instance_config", {
  id: text("id").primaryKey().default(SINGLETON_ID),
  overlayTimerToken: text("overlay_timer_token").notNull().unique().$defaultFn(() => crypto.randomUUID()),
  overlayTasksToken: text("overlay_tasks_token").notNull().unique().$defaultFn(() => crypto.randomUUID()),
  // Secret gate for the browser bot page (/bot/<token>) — mirrors the overlay token model.
  botToken: text("bot_token").notNull().unique().$defaultFn(() => crypto.randomUUID()),
});

export const botAccount = sqliteTable("bot_account", {
  id: text("id").primaryKey().default(SINGLETON_ID),
  twitchId: text("twitch_id").notNull(),
  username: text("username").notNull(),
  displayName: text("display_name").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  scopes: text("scopes", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default(["user:read:chat", "user:write:chat"]),
});

export const task = sqliteTable("task", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  authorTwitchId: text("author_twitch_id").notNull(),
  authorUsername: text("author_username").notNull(),
  authorDisplayName: text("author_display_name").notNull(),
  authorColor: text("author_color"),
  text: text("text").notNull(),
  status: text("status").notNull().default("pending"),
  priority: integer("priority").notNull().default(1),
  order: integer("order").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
}, (table) => [
  index("task_status_idx").on(table.status),
  index("task_priority_order_idx").on(table.priority, table.order),
  index("task_author_idx").on(table.authorTwitchId),
]);

export const timerState = sqliteTable("timer_state", {
  id: text("id").primaryKey().default(SINGLETON_ID),
  status: text("status").notNull().default("idle"),
  targetEndTime: integer("target_end_time", { mode: "timestamp_ms" }),
  pausedWithRemaining: integer("paused_with_remaining"),
  pausedFromStatus: text("paused_from_status"),
  currentCycle: integer("current_cycle").notNull().default(1),
  totalCycles: integer("total_cycles").notNull().default(4),
});

export const timerConfig = sqliteTable("timer_config", {
  id: text("id").primaryKey().default(SINGLETON_ID),
  workDuration: integer("work_duration").notNull().default(1500000),
  breakDuration: integer("break_duration").notNull().default(300000),
  longBreakDuration: integer("long_break_duration").notNull().default(900000),
  longBreakInterval: integer("long_break_interval").notNull().default(4),
  startingDuration: integer("starting_duration").notNull().default(5000),
  defaultCycles: integer("default_cycles").notNull().default(4),
  showHours: integer("show_hours", { mode: "boolean" }).notNull().default(false),
  noLastBreak: integer("no_last_break", { mode: "boolean" }).notNull().default(true),
  labelIdle: text("label_idle").notNull().default("Resting"),
  labelStarting: text("label_starting").notNull().default("Gathering the Pack"),
  labelWork: text("label_work").notNull().default("On the Hunt"),
  labelBreak: text("label_break").notNull().default("Den Rest"),
  labelLongBreak: text("label_long_break").notNull().default("Pack Slumber"),
  labelPaused: text("label_paused").notNull().default("Paws'd"),
  labelFinished: text("label_finished").notNull().default("Hunt Complete"),
});

export const timerStyle = sqliteTable("timer_style", {
  id: text("id").primaryKey().default(SINGLETON_ID),
  width: text("width").notNull().default("250px"),
  height: text("height").notNull().default("250px"),
  bgColor: text("bg_color").notNull().default("#1c1c1e"),
  bgOpacity: real("bg_opacity").notNull().default(0.85),
  bgBorderRadius: text("bg_border_radius").notNull().default("22%"),
  ringEnabled: integer("ring_enabled", { mode: "boolean" }).notNull().default(true),
  ringTrackColor: text("ring_track_color").notNull().default("#ffffff"),
  ringTrackOpacity: real("ring_track_opacity").notNull().default(0.1),
  ringFillColor: text("ring_fill_color").notNull().default("#34c759"),
  ringFillOpacity: real("ring_fill_opacity").notNull().default(1.0),
  ringWidth: integer("ring_width").notNull().default(8),
  ringGap: integer("ring_gap").notNull().default(6),
  textColor: text("text_color").notNull().default("#ffffff"),
  textOutlineColor: text("text_outline_color").notNull().default("#000000"),
  textOutlineSize: text("text_outline_size").notNull().default("0px"),
  textFontFamily: text("text_font_family").notNull().default("Montserrat"),
  fontSizeLabel: text("font_size_label").notNull().default("18px"),
  fontSizeTime: text("font_size_time").notNull().default("48px"),
  fontSizeCycle: text("font_size_cycle").notNull().default("16px"),
});

export const taskStyle = sqliteTable("task_style", {
  id: text("id").primaryKey().default(SINGLETON_ID),
  displayShowDone: integer("display_show_done", { mode: "boolean" }).notNull().default(true),
  displayShowCount: integer("display_show_count", { mode: "boolean" }).notNull().default(true),
  displayUseCheckboxes: integer("display_use_checkboxes", { mode: "boolean" }).notNull().default(true),
  displayCrossOnDone: integer("display_cross_on_done", { mode: "boolean" }).notNull().default(true),
  displayNumberOfLines: integer("display_number_of_lines").notNull().default(2),
  fontHeader: text("font_header").notNull().default("Montserrat"),
  fontBody: text("font_body").notNull().default("Roboto"),
  scrollEnabled: integer("scroll_enabled", { mode: "boolean" }).notNull().default(true),
  scrollPixelsPerSecond: integer("scroll_pixels_per_second").notNull().default(70),
  scrollGapBetweenLoops: integer("scroll_gap_between_loops").notNull().default(100),
  headerHeight: text("header_height").notNull().default("52px"),
  headerBgColor: text("header_bg_color").notNull().default("#1c1c1e"),
  headerBgOpacity: real("header_bg_opacity").notNull().default(0.95),
  headerBorderColor: text("header_border_color").notNull().default("#3a3a3c"),
  headerBorderWidth: text("header_border_width").notNull().default("1px"),
  headerBorderRadius: text("header_border_radius").notNull().default("12px 12px 0 0"),
  headerFontSize: text("header_font_size").notNull().default("24px"),
  headerFontColor: text("header_font_color").notNull().default("#ffffff"),
  headerPadding: text("header_padding").notNull().default("12px 16px"),
  bodyBgColor: text("body_bg_color").notNull().default("#1c1c1e"),
  bodyBgOpacity: real("body_bg_opacity").notNull().default(0.85),
  bodyBorderColor: text("body_border_color").notNull().default("#3a3a3c"),
  bodyBorderWidth: text("body_border_width").notNull().default("1px"),
  bodyBorderRadius: text("body_border_radius").notNull().default("0 0 12px 12px"),
  bodyPaddingVertical: text("body_padding_vertical").notNull().default("6px"),
  bodyPaddingHorizontal: text("body_padding_horizontal").notNull().default("6px"),
  taskBgColor: text("task_bg_color").notNull().default("#2c2c2e"),
  taskBgOpacity: real("task_bg_opacity").notNull().default(0.9),
  taskBorderColor: text("task_border_color").notNull().default("#3a3a3c"),
  taskBorderWidth: text("task_border_width").notNull().default("0px"),
  taskBorderRadius: text("task_border_radius").notNull().default("10px"),
  taskFontSize: text("task_font_size").notNull().default("22px"),
  taskFontColor: text("task_font_color").notNull().default("#f5f5f7"),
  taskUsernameColor: text("task_username_color").notNull().default("#bf5af2"),
  taskPadding: text("task_padding").notNull().default("10px 14px"),
  taskMarginBottom: text("task_margin_bottom").notNull().default("4px"),
  taskMaxWidth: text("task_max_width").notNull().default("100%"),
  taskDoneBgColor: text("task_done_bg_color").notNull().default("#1c1c1e"),
  taskDoneBgOpacity: real("task_done_bg_opacity").notNull().default(0.5),
  taskDoneFontColor: text("task_done_font_color").notNull().default("#8e8e93"),
  checkboxSize: text("checkbox_size").notNull().default("20px"),
  checkboxBgColor: text("checkbox_bg_color").notNull().default("#000000"),
  checkboxBgOpacity: real("checkbox_bg_opacity").notNull().default(0),
  checkboxBorderColor: text("checkbox_border_color").notNull().default("#636366"),
  checkboxBorderWidth: text("checkbox_border_width").notNull().default("2px"),
  checkboxBorderRadius: text("checkbox_border_radius").notNull().default("6px"),
  checkboxMarginTop: text("checkbox_margin_top").notNull().default("4px"),
  checkboxMarginLeft: text("checkbox_margin_left").notNull().default("2px"),
  checkboxMarginRight: text("checkbox_margin_right").notNull().default("8px"),
  checkboxTickChar: text("checkbox_tick_char").notNull().default("✔"),
  checkboxTickSize: text("checkbox_tick_size").notNull().default("14px"),
  checkboxTickColor: text("checkbox_tick_color").notNull().default("#34c759"),
  bulletChar: text("bullet_char").notNull().default("•"),
  bulletSize: text("bullet_size").notNull().default("20px"),
  bulletColor: text("bullet_color").notNull().default("#8e8e93"),
  bulletMarginTop: text("bullet_margin_top").notNull().default("0px"),
  bulletMarginLeft: text("bullet_margin_left").notNull().default("2px"),
  bulletMarginRight: text("bullet_margin_right").notNull().default("8px"),
});

export const botConfig = sqliteTable("bot_config", {
  id: text("id").primaryKey().default(SINGLETON_ID),
  taskCommandsEnabled: integer("task_commands_enabled", { mode: "boolean" }).notNull().default(true),
  timerCommandsEnabled: integer("timer_commands_enabled", { mode: "boolean" }).notNull().default(true),
  commandAliases: text("command_aliases", { mode: "json" })
    .$type<Record<string, string>>()
    .notNull()
    .default({}),
  msgTaskAdded: text("msg_task_added").notNull().default('Awooo! The task "{task}" has been added to the pack, {user}!'),
  msgNoTaskAdded: text("msg_no_task_added").notNull().default("You're already on the hunt {user}, use !check to see your current task!"),
  msgNoTaskContent: text("msg_no_task_content").notNull().default("Tell the pack what you're working on! Use !task [task] {user}"),
  msgNoTaskToEdit: text("msg_no_task_to_edit").notNull().default("No task found in your den to edit {user}"),
  msgTaskEdited: text("msg_task_edited").notNull().default('The hunt has changed! Task updated to "{task}" {user}'),
  msgTaskRemoved: text("msg_task_removed").notNull().default('Task "{task}" has been scent-wiped from the list, {user}'),
  msgTaskNext: text("msg_task_next").notNull().default("Paws-ome work finishing '{oldTask}'! Now tracking '{newTask}', {user}!"),
  msgAdminDeleteTasks: text("msg_admin_delete_tasks").notNull().default("All of the user's tasks have been cleared from the forest."),
  msgTaskDone: text("msg_task_done").notNull().default('Alpha work! You finished "{task}" {user}!'),
  msgTaskCheck: text("msg_task_check").notNull().default('{user}, your current scent is on: "{task}"'),
  msgTaskCheckUser: text("msg_task_check_user").notNull().default('{user}, {user2} is currently tracking: "{task}"'),
  msgNoTask: text("msg_no_task").notNull().default("Looks like you aren't tracking anything in the forest right now, {user}"),
  msgNoTaskOther: text("msg_no_task_other").notNull().default("The scent is cold... there is no task from that user {user}"),
  msgNotMod: text("msg_not_mod").notNull().default("Grrr! Permission denied, {user}; Only pack leaders (mods) can do that."),
  msgClearedAll: text("msg_cleared_all").notNull().default("The forest has been cleared of all tasks!"),
  msgClearedDone: text("msg_cleared_done").notNull().default("All finished tasks have been cleared from the den!"),
  msgNextNoContent: text("msg_next_no_content").notNull().default("Don't leave the pack hanging! Try !next [task] {user}"),
  msgHelp: text("msg_help").notNull().default("{user} Join the hunt with !task, !remove, !edit, or !done."),
  msgWorkMsg: text("msg_work").notNull().default("Time to hunt some code! Focus mode activated!"),
  msgBreakMsg: text("msg_break").notNull().default("Paws up! Time for a short rest in the den."),
  msgLongBreakMsg: text("msg_long_break").notNull().default("The whole pack is taking a long snooze! Back soon!"),
  msgWorkRemindMsg: text("msg_work_remind").notNull().default("Get ready to howl at that code @{channel}, focus starts in 25 seconds!"),
  msgNotRunning: text("msg_not_running").notNull().default("The timer isn't howling yet! Start it up first."),
  msgStreamStarting: text("msg_stream_starting").notNull().default("The Blue Wolf is waking up! Stream starting!"),
  msgWrongCommand: text("msg_wrong_command").notNull().default("My ears didn't catch that... Command not recognized!"),
  msgTimerRunning: text("msg_timer_running").notNull().default("The hunt is already in progress!"),
  msgCommandSuccess: text("msg_command_success").notNull().default("Paw-fect! Done!"),
  msgCycleWrong: text("msg_cycle_wrong").notNull().default("The cycle cannot outrun the goal!"),
  msgGoalWrong: text("msg_goal_wrong").notNull().default("The goal needs to be further than the cycle!"),
  msgFinishResponse: text("msg_finish_response").notNull().default("Great work today pack! We hunted well."),
  msgAlreadyStarting: text("msg_already_starting").notNull().default("The pack is already moving or the timer is running!"),
  msgEta: text("msg_eta").notNull().default("The hunt will end at {time}"),
});
