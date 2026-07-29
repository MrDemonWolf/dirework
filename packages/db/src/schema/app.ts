import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

import {
  DEFAULT_PHASE_LABELS,
  DEFAULT_TASK_MESSAGES,
  DEFAULT_TIMER_MESSAGES,
  TIMER_CONFIG_DEFAULTS,
} from "../defaults";

// Singleton pattern: one row per table, primary key pinned to "singleton".
export const SINGLETON_ID = "singleton";

export const instanceConfig = sqliteTable("instance_config", {
  id: text("id").primaryKey().default(SINGLETON_ID),
  overlayTimerToken: text("overlay_timer_token").notNull().unique().$defaultFn(() => crypto.randomUUID()),
  overlayTasksToken: text("overlay_tasks_token").notNull().unique().$defaultFn(() => crypto.randomUUID()),
  // Secret gate for the browser bot page (/bot/<token>) — mirrors the overlay token model.
  botToken: text("bot_token").notNull().unique().$defaultFn(() => crypto.randomUUID()),
  // Cached lowercase Twitch *login* of the owner's channel. IRC JOIN requires
  // the login name, not the display name (better-auth only stores the display
  // name). Lazily resolved via Helix on bot.getSession.
  channelLogin: text("channel_login"),
});

export const botAccount = sqliteTable("bot_account", {
  id: text("id").primaryKey().default(SINGLETON_ID),
  twitchId: text("twitch_id").notNull(),
  username: text("username").notNull(),
  displayName: text("display_name").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  // Coarse advisory lease serializing concurrent OAuth refreshes (P0.5): Twitch
  // invalidates the old refresh token on rotation, so two refreshes racing with
  // the same token would have one rejected. A caller CAS-acquires this lease
  // before hitting Twitch; others wait for the winner to publish the new token.
  // Nullable = unlocked. ponytail: single global lease — fine for one bot page.
  refreshLockedUntil: integer("refresh_locked_until", { mode: "timestamp_ms" }),
  // chat:read/chat:edit are required by the IRC bot connection;
  // user:read:chat/user:write:chat are kept for a future Helix send path.
  scopes: text("scopes", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default(["chat:read", "chat:edit", "user:read:chat", "user:write:chat"]),
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
  totalCycles: integer("total_cycles").notNull().default(TIMER_CONFIG_DEFAULTS.defaultCycles),
});

export const timerConfig = sqliteTable("timer_config", {
  id: text("id").primaryKey().default(SINGLETON_ID),
  workDuration: integer("work_duration").notNull().default(TIMER_CONFIG_DEFAULTS.workDuration),
  breakDuration: integer("break_duration").notNull().default(TIMER_CONFIG_DEFAULTS.breakDuration),
  longBreakDuration: integer("long_break_duration").notNull().default(TIMER_CONFIG_DEFAULTS.longBreakDuration),
  longBreakInterval: integer("long_break_interval").notNull().default(TIMER_CONFIG_DEFAULTS.longBreakInterval),
  startingDuration: integer("starting_duration").notNull().default(TIMER_CONFIG_DEFAULTS.startingDuration),
  defaultCycles: integer("default_cycles").notNull().default(TIMER_CONFIG_DEFAULTS.defaultCycles),
  showHours: integer("show_hours", { mode: "boolean" }).notNull().default(false),
  noLastBreak: integer("no_last_break", { mode: "boolean" }).notNull().default(TIMER_CONFIG_DEFAULTS.noLastBreak),
  labelIdle: text("label_idle").notNull().default(DEFAULT_PHASE_LABELS.idle),
  labelStarting: text("label_starting").notNull().default(DEFAULT_PHASE_LABELS.starting),
  labelWork: text("label_work").notNull().default(DEFAULT_PHASE_LABELS.work),
  labelBreak: text("label_break").notNull().default(DEFAULT_PHASE_LABELS.break),
  labelLongBreak: text("label_long_break").notNull().default(DEFAULT_PHASE_LABELS.longBreak),
  labelPaused: text("label_paused").notNull().default(DEFAULT_PHASE_LABELS.paused),
  labelFinished: text("label_finished").notNull().default(DEFAULT_PHASE_LABELS.finished),
});

export const timerStyle = sqliteTable("timer_style", {
  id: text("id").primaryKey().default(SINGLETON_ID),
  width: text("width").notNull().default("300px"),
  height: text("height").notNull().default("300px"),
  bgColor: text("bg_color").notNull().default("#091533"),
  bgOpacity: real("bg_opacity").notNull().default(0.85),
  bgBorderRadius: text("bg_border_radius").notNull().default("22%"),
  ringEnabled: integer("ring_enabled", { mode: "boolean" }).notNull().default(true),
  ringTrackColor: text("ring_track_color").notNull().default("#ffffff"),
  ringTrackOpacity: real("ring_track_opacity").notNull().default(0.18),
  ringFillColor: text("ring_fill_color").notNull().default("#00aced"),
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
  scrollPixelsPerSecond: integer("scroll_pixels_per_second").notNull().default(40),
  scrollGapBetweenLoops: integer("scroll_gap_between_loops").notNull().default(100),
  headerHeight: text("header_height").notNull().default("52px"),
  headerBgColor: text("header_bg_color").notNull().default("#091533"),
  headerBgOpacity: real("header_bg_opacity").notNull().default(0.95),
  headerBorderColor: text("header_border_color").notNull().default("#1b2b52"),
  headerBorderWidth: text("header_border_width").notNull().default("1px"),
  headerBorderRadius: text("header_border_radius").notNull().default("12px 12px 0 0"),
  headerFontSize: text("header_font_size").notNull().default("24px"),
  headerFontColor: text("header_font_color").notNull().default("#ffffff"),
  headerPadding: text("header_padding").notNull().default("12px 16px"),
  bodyBgColor: text("body_bg_color").notNull().default("#091533"),
  bodyBgOpacity: real("body_bg_opacity").notNull().default(0.85),
  bodyBorderColor: text("body_border_color").notNull().default("#1b2b52"),
  bodyBorderWidth: text("body_border_width").notNull().default("1px"),
  bodyBorderRadius: text("body_border_radius").notNull().default("0 0 12px 12px"),
  bodyPaddingVertical: text("body_padding_vertical").notNull().default("6px"),
  bodyPaddingHorizontal: text("body_padding_horizontal").notNull().default("6px"),
  taskBgColor: text("task_bg_color").notNull().default("#12244a"),
  taskBgOpacity: real("task_bg_opacity").notNull().default(0.9),
  taskBorderColor: text("task_border_color").notNull().default("#1b2b52"),
  taskBorderWidth: text("task_border_width").notNull().default("0px"),
  taskBorderRadius: text("task_border_radius").notNull().default("10px"),
  taskFontSize: text("task_font_size").notNull().default("22px"),
  taskFontColor: text("task_font_color").notNull().default("#eaf2ff"),
  taskUsernameColor: text("task_username_color").notNull().default("#6b8bf5"),
  taskPadding: text("task_padding").notNull().default("10px 14px"),
  taskMarginBottom: text("task_margin_bottom").notNull().default("4px"),
  taskMaxWidth: text("task_max_width").notNull().default("100%"),
  taskDoneBgColor: text("task_done_bg_color").notNull().default("#091533"),
  taskDoneBgOpacity: real("task_done_bg_opacity").notNull().default(0.5),
  taskDoneFontColor: text("task_done_font_color").notNull().default("#7c8db0"),
  checkboxSize: text("checkbox_size").notNull().default("20px"),
  checkboxBgColor: text("checkbox_bg_color").notNull().default("#000000"),
  checkboxBgOpacity: real("checkbox_bg_opacity").notNull().default(0),
  checkboxBorderColor: text("checkbox_border_color").notNull().default("#4a5b82"),
  checkboxBorderWidth: text("checkbox_border_width").notNull().default("2px"),
  checkboxBorderRadius: text("checkbox_border_radius").notNull().default("6px"),
  checkboxMarginTop: text("checkbox_margin_top").notNull().default("4px"),
  checkboxMarginLeft: text("checkbox_margin_left").notNull().default("2px"),
  checkboxMarginRight: text("checkbox_margin_right").notNull().default("8px"),
  checkboxTickChar: text("checkbox_tick_char").notNull().default("✔"),
  checkboxTickSize: text("checkbox_tick_size").notNull().default("14px"),
  checkboxTickColor: text("checkbox_tick_color").notNull().default("#00aced"),
  bulletChar: text("bullet_char").notNull().default("•"),
  bulletSize: text("bullet_size").notNull().default("20px"),
  bulletColor: text("bullet_color").notNull().default("#7c8db0"),
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
  msgTaskAdded: text("msg_task_added").notNull().default(DEFAULT_TASK_MESSAGES.taskAdded),
  msgNoTaskAdded: text("msg_no_task_added").notNull().default(DEFAULT_TASK_MESSAGES.noTaskAdded),
  msgNoTaskContent: text("msg_no_task_content").notNull().default(DEFAULT_TASK_MESSAGES.noTaskContent),
  msgNoTaskToEdit: text("msg_no_task_to_edit").notNull().default(DEFAULT_TASK_MESSAGES.noTaskToEdit),
  msgTaskEdited: text("msg_task_edited").notNull().default(DEFAULT_TASK_MESSAGES.taskEdited),
  msgTaskRemoved: text("msg_task_removed").notNull().default(DEFAULT_TASK_MESSAGES.taskRemoved),
  msgTaskNext: text("msg_task_next").notNull().default(DEFAULT_TASK_MESSAGES.taskNext),
  msgAdminDeleteTasks: text("msg_admin_delete_tasks").notNull().default(DEFAULT_TASK_MESSAGES.adminDeleteTasks),
  msgTaskDone: text("msg_task_done").notNull().default(DEFAULT_TASK_MESSAGES.taskDone),
  msgTaskCheck: text("msg_task_check").notNull().default(DEFAULT_TASK_MESSAGES.taskCheck),
  msgTaskCheckUser: text("msg_task_check_user").notNull().default(DEFAULT_TASK_MESSAGES.taskCheckUser),
  msgNoTask: text("msg_no_task").notNull().default(DEFAULT_TASK_MESSAGES.noTask),
  msgNoTaskOther: text("msg_no_task_other").notNull().default(DEFAULT_TASK_MESSAGES.noTaskOther),
  msgNotMod: text("msg_not_mod").notNull().default(DEFAULT_TASK_MESSAGES.notMod),
  msgClearedAll: text("msg_cleared_all").notNull().default(DEFAULT_TASK_MESSAGES.clearedAll),
  msgClearedDone: text("msg_cleared_done").notNull().default(DEFAULT_TASK_MESSAGES.clearedDone),
  msgNextNoContent: text("msg_next_no_content").notNull().default(DEFAULT_TASK_MESSAGES.nextNoContent),
  msgHelp: text("msg_help").notNull().default(DEFAULT_TASK_MESSAGES.help),
  msgWorkMsg: text("msg_work").notNull().default(DEFAULT_TIMER_MESSAGES.workMsg),
  msgBreakMsg: text("msg_break").notNull().default(DEFAULT_TIMER_MESSAGES.breakMsg),
  msgLongBreakMsg: text("msg_long_break").notNull().default(DEFAULT_TIMER_MESSAGES.longBreakMsg),
  msgWorkRemindMsg: text("msg_work_remind").notNull().default(DEFAULT_TIMER_MESSAGES.workRemindMsg),
  msgNotRunning: text("msg_not_running").notNull().default(DEFAULT_TIMER_MESSAGES.notRunning),
  msgStreamStarting: text("msg_stream_starting").notNull().default(DEFAULT_TIMER_MESSAGES.streamStarting),
  msgWrongCommand: text("msg_wrong_command").notNull().default(DEFAULT_TIMER_MESSAGES.wrongCommand),
  msgTimerRunning: text("msg_timer_running").notNull().default(DEFAULT_TIMER_MESSAGES.timerRunning),
  msgCommandSuccess: text("msg_command_success").notNull().default(DEFAULT_TIMER_MESSAGES.commandSuccess),
  msgCycleWrong: text("msg_cycle_wrong").notNull().default(DEFAULT_TIMER_MESSAGES.cycleWrong),
  msgGoalWrong: text("msg_goal_wrong").notNull().default(DEFAULT_TIMER_MESSAGES.goalWrong),
  msgFinishResponse: text("msg_finish_response").notNull().default(DEFAULT_TIMER_MESSAGES.finishResponse),
  msgAlreadyStarting: text("msg_already_starting").notNull().default(DEFAULT_TIMER_MESSAGES.alreadyStarting),
  msgEta: text("msg_eta").notNull().default(DEFAULT_TIMER_MESSAGES.eta),
});
