import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

import {
  DEFAULT_PHASE_LABELS,
  TASK_MESSAGE_COLUMN_DEFAULTS,
  TASK_STYLE_COLUMN_DEFAULTS,
  TIMER_CONFIG_DEFAULTS,
  TIMER_MESSAGE_COLUMN_DEFAULTS,
  TIMER_STATUSES,
  TIMER_STYLE_COLUMN_DEFAULTS,
} from "../defaults";

// Singleton pattern: one row per table, primary key pinned to "singleton".
export const SINGLETON_ID = "singleton";

export const instanceConfig = sqliteTable("instance_config", {
  id: text("id").primaryKey().default(SINGLETON_ID),
  overlayTimerToken: text("overlay_timer_token")
    .notNull()
    .unique()
    .$defaultFn(() => crypto.randomUUID()),
  overlayTasksToken: text("overlay_tasks_token")
    .notNull()
    .unique()
    .$defaultFn(() => crypto.randomUUID()),
  // Secret gate for the browser bot page (/bot/<token>) — mirrors the overlay token model.
  botToken: text("bot_token")
    .notNull()
    .unique()
    .$defaultFn(() => crypto.randomUUID()),
  // Cached lowercase Twitch *login* of the owner's channel. IRC JOIN requires
  // the login name, not the display name (better-auth only stores the display
  // name). Lazily resolved via Helix on bot.getSession.
  channelLogin: text("channel_login"),
  // Dashboard setup checklist. Each flag flips only when the owner confirms the
  // step by hand ("I added it to OBS") through `user.confirmSetupStep`; nothing
  // infers it from overlay or bot-page traffic, which would mean a write on a
  // poll path. `user.me` returns them from the row it already reads.
  setupBotSourceConfirmed: integer("setup_bot_source_confirmed", { mode: "boolean" })
    .notNull()
    .default(false),
  setupTimerOverlayConfirmed: integer("setup_timer_overlay_confirmed", { mode: "boolean" })
    .notNull()
    .default(false),
  setupTasksOverlayConfirmed: integer("setup_tasks_overlay_confirmed", { mode: "boolean" })
    .notNull()
    .default(false),
  // The owner's IANA time zone (e.g. "America/Chicago"), reported by the
  // dashboard through `user.setTimeZone`. Decides which local day a dashboard
  // stat lands on; null reads as UTC.
  timeZone: text("time_zone"),
  // Bot page lease: only one open bot page (widget or dock) holds the Twitch chat
  // connection at a time. The holder's random per-page-load id and the last time it
  // checked in (`bot.heartbeat`, every 2 minutes). A lease older than BOT_LEASE_TTL_MS
  // is free, which is also how the dashboard reads "Bot offline". Null = nobody holds
  // it. Written only by services/bot-lease.ts.
  botLeaseInstanceId: text("bot_lease_instance_id"),
  botLeaseSeenAt: integer("bot_lease_seen_at", { mode: "timestamp_ms" }),
});

export const botAccount = sqliteTable("bot_account", {
  id: text("id").primaryKey().default(SINGLETON_ID),
  twitchId: text("twitch_id").notNull(),
  username: text("username").notNull(),
  displayName: text("display_name").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  // Coarse advisory lease serializing concurrent OAuth refreshes: Twitch
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

export const task = sqliteTable(
  "task",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
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
  },
  (table) => [
    // (status, completed_at) serves both the `status IN (...)` open-task read
    // (status prefix) and the bounded done-task read / 24h retention purge
    // (`status = 'done' ORDER BY / WHERE completed_at`) as index range reads,
    // so overlay polling never scans the whole table.
    index("task_status_completed_idx").on(table.status, table.completedAt),
    index("task_priority_order_idx").on(table.priority, table.order),
    index("task_author_idx").on(table.authorTwitchId),
    // Matches the case-insensitive `lower(author_username) = lower(?)` predicate
    // used by CLEARCHAT and !clear/!check @user, which otherwise full-scan.
    index("task_author_username_lower_idx").on(sql`lower(${table.authorUsername})`),
    // "At most one active task per Twitch user" as a DB invariant, not just an
    // application convention. Chat ingest is concurrent, so a check-then-act
    // in the service could otherwise leave a viewer with two active tasks. Partial
    // index: only rows with status='active' participate.
    uniqueIndex("task_one_active_per_author_idx")
      .on(table.authorTwitchId)
      .where(sql`${table.status} = 'active'`),
  ],
);

// IRC message ids the bot ingest has already handled. Two open bot pages (OBS
// plus a pinned tab) both receive every PRIVMSG; claiming the id here makes the
// second relay a no-op. Rows are pruned after a short window on every claim.
export const processedChatMessage = sqliteTable(
  "processed_chat_message",
  {
    id: text("id").primaryKey(),
    processedAt: integer("processed_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    // The prune runs on every claimed command (`processed_at < ?`); without this
    // it scans every row still in the window, so a busy chat pays quadratically.
    index("processed_chat_message_processed_at_idx").on(table.processedAt),
  ],
);

// Dashboard stats: one row per local day (the owner's `time_zone`, else UTC),
// keyed "YYYY-MM-DD" so a week or a 14-day chart is a primary-key range read.
// Written only by writes that already happen (a phase the timer leaves, a task
// marked done) as `INSERT … ON CONFLICT(day) DO UPDATE SET x = x + ?`; rows older
// than STATS_RETENTION_DAYS are pruned when a timer starts.
export const dailyStat = sqliteTable("daily_stat", {
  day: text("day").primaryKey(),
  focusMs: integer("focus_ms").notNull().default(0),
  pomodoros: integer("pomodoros").notNull().default(0),
  tasksDone: integer("tasks_done").notNull().default(0),
  // Of tasks_done, those authored by someone other than the owner (chat).
  tasksDoneChat: integer("tasks_done_chat").notNull().default(0),
});

export const timerState = sqliteTable("timer_state", {
  id: text("id").primaryKey().default(SINGLETON_ID),
  // enum is type-only on SQLite (no CHECK constraint, no migration).
  status: text("status", { enum: TIMER_STATUSES }).notNull().default("idle"),
  targetEndTime: integer("target_end_time", { mode: "timestamp_ms" }),
  pausedWithRemaining: integer("paused_with_remaining"),
  pausedFromStatus: text("paused_from_status", { enum: TIMER_STATUSES }),
  currentCycle: integer("current_cycle").notNull().default(1),
  totalCycles: integer("total_cycles").notNull().default(TIMER_CONFIG_DEFAULTS.defaultCycles),
});

export const timerConfig = sqliteTable("timer_config", {
  id: text("id").primaryKey().default(SINGLETON_ID),
  workDuration: integer("work_duration").notNull().default(TIMER_CONFIG_DEFAULTS.workDuration),
  breakDuration: integer("break_duration").notNull().default(TIMER_CONFIG_DEFAULTS.breakDuration),
  longBreakDuration: integer("long_break_duration")
    .notNull()
    .default(TIMER_CONFIG_DEFAULTS.longBreakDuration),
  longBreakInterval: integer("long_break_interval")
    .notNull()
    .default(TIMER_CONFIG_DEFAULTS.longBreakInterval),
  startingDuration: integer("starting_duration")
    .notNull()
    .default(TIMER_CONFIG_DEFAULTS.startingDuration),
  defaultCycles: integer("default_cycles").notNull().default(TIMER_CONFIG_DEFAULTS.defaultCycles),
  showHours: integer("show_hours", { mode: "boolean" }).notNull().default(false),
  noLastBreak: integer("no_last_break", { mode: "boolean" })
    .notNull()
    .default(TIMER_CONFIG_DEFAULTS.noLastBreak),
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
  width: text("width").notNull().default(TIMER_STYLE_COLUMN_DEFAULTS.width),
  height: text("height").notNull().default(TIMER_STYLE_COLUMN_DEFAULTS.height),
  bgColor: text("bg_color").notNull().default(TIMER_STYLE_COLUMN_DEFAULTS.bgColor),
  bgOpacity: real("bg_opacity").notNull().default(TIMER_STYLE_COLUMN_DEFAULTS.bgOpacity),
  bgBorderRadius: text("bg_border_radius")
    .notNull()
    .default(TIMER_STYLE_COLUMN_DEFAULTS.bgBorderRadius),
  ringEnabled: integer("ring_enabled", { mode: "boolean" })
    .notNull()
    .default(TIMER_STYLE_COLUMN_DEFAULTS.ringEnabled),
  ringTrackColor: text("ring_track_color")
    .notNull()
    .default(TIMER_STYLE_COLUMN_DEFAULTS.ringTrackColor),
  ringTrackOpacity: real("ring_track_opacity")
    .notNull()
    .default(TIMER_STYLE_COLUMN_DEFAULTS.ringTrackOpacity),
  ringFillColor: text("ring_fill_color")
    .notNull()
    .default(TIMER_STYLE_COLUMN_DEFAULTS.ringFillColor),
  ringFillOpacity: real("ring_fill_opacity")
    .notNull()
    .default(TIMER_STYLE_COLUMN_DEFAULTS.ringFillOpacity),
  ringWidth: integer("ring_width").notNull().default(TIMER_STYLE_COLUMN_DEFAULTS.ringWidth),
  ringGap: integer("ring_gap").notNull().default(TIMER_STYLE_COLUMN_DEFAULTS.ringGap),
  textColor: text("text_color").notNull().default(TIMER_STYLE_COLUMN_DEFAULTS.textColor),
  textOutlineColor: text("text_outline_color")
    .notNull()
    .default(TIMER_STYLE_COLUMN_DEFAULTS.textOutlineColor),
  textOutlineSize: text("text_outline_size")
    .notNull()
    .default(TIMER_STYLE_COLUMN_DEFAULTS.textOutlineSize),
  textFontFamily: text("text_font_family")
    .notNull()
    .default(TIMER_STYLE_COLUMN_DEFAULTS.textFontFamily),
  fontSizeLabel: text("font_size_label")
    .notNull()
    .default(TIMER_STYLE_COLUMN_DEFAULTS.fontSizeLabel),
  fontSizeTime: text("font_size_time").notNull().default(TIMER_STYLE_COLUMN_DEFAULTS.fontSizeTime),
  fontSizeCycle: text("font_size_cycle")
    .notNull()
    .default(TIMER_STYLE_COLUMN_DEFAULTS.fontSizeCycle),
});

export const taskStyle = sqliteTable("task_style", {
  id: text("id").primaryKey().default(SINGLETON_ID),
  displayShowDone: integer("display_show_done", { mode: "boolean" })
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.displayShowDone),
  displayShowCount: integer("display_show_count", { mode: "boolean" })
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.displayShowCount),
  displayUseCheckboxes: integer("display_use_checkboxes", { mode: "boolean" })
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.displayUseCheckboxes),
  displayCrossOnDone: integer("display_cross_on_done", { mode: "boolean" })
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.displayCrossOnDone),
  displayNumberOfLines: integer("display_number_of_lines")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.displayNumberOfLines),
  fontHeader: text("font_header").notNull().default(TASK_STYLE_COLUMN_DEFAULTS.fontHeader),
  fontBody: text("font_body").notNull().default(TASK_STYLE_COLUMN_DEFAULTS.fontBody),
  scrollEnabled: integer("scroll_enabled", { mode: "boolean" })
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.scrollEnabled),
  scrollPixelsPerSecond: integer("scroll_pixels_per_second")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.scrollPixelsPerSecond),
  scrollGapBetweenLoops: integer("scroll_gap_between_loops")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.scrollGapBetweenLoops),
  headerHeight: text("header_height").notNull().default(TASK_STYLE_COLUMN_DEFAULTS.headerHeight),
  headerBgColor: text("header_bg_color")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.headerBgColor),
  headerBgOpacity: real("header_bg_opacity")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.headerBgOpacity),
  headerBorderColor: text("header_border_color")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.headerBorderColor),
  headerBorderWidth: text("header_border_width")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.headerBorderWidth),
  headerBorderRadius: text("header_border_radius")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.headerBorderRadius),
  headerFontSize: text("header_font_size")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.headerFontSize),
  headerFontColor: text("header_font_color")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.headerFontColor),
  headerPadding: text("header_padding").notNull().default(TASK_STYLE_COLUMN_DEFAULTS.headerPadding),
  bodyBgColor: text("body_bg_color").notNull().default(TASK_STYLE_COLUMN_DEFAULTS.bodyBgColor),
  bodyBgOpacity: real("body_bg_opacity")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.bodyBgOpacity),
  bodyBorderColor: text("body_border_color")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.bodyBorderColor),
  bodyBorderWidth: text("body_border_width")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.bodyBorderWidth),
  bodyBorderRadius: text("body_border_radius")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.bodyBorderRadius),
  bodyPaddingVertical: text("body_padding_vertical")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.bodyPaddingVertical),
  bodyPaddingHorizontal: text("body_padding_horizontal")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.bodyPaddingHorizontal),
  taskBgColor: text("task_bg_color").notNull().default(TASK_STYLE_COLUMN_DEFAULTS.taskBgColor),
  taskBgOpacity: real("task_bg_opacity")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.taskBgOpacity),
  taskBorderColor: text("task_border_color")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.taskBorderColor),
  taskBorderWidth: text("task_border_width")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.taskBorderWidth),
  taskBorderRadius: text("task_border_radius")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.taskBorderRadius),
  taskFontSize: text("task_font_size").notNull().default(TASK_STYLE_COLUMN_DEFAULTS.taskFontSize),
  taskFontColor: text("task_font_color")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.taskFontColor),
  taskUsernameColor: text("task_username_color")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.taskUsernameColor),
  taskPadding: text("task_padding").notNull().default(TASK_STYLE_COLUMN_DEFAULTS.taskPadding),
  taskMarginBottom: text("task_margin_bottom")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.taskMarginBottom),
  taskMaxWidth: text("task_max_width").notNull().default(TASK_STYLE_COLUMN_DEFAULTS.taskMaxWidth),
  taskDoneBgColor: text("task_done_bg_color")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.taskDoneBgColor),
  taskDoneBgOpacity: real("task_done_bg_opacity")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.taskDoneBgOpacity),
  taskDoneFontColor: text("task_done_font_color")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.taskDoneFontColor),
  checkboxSize: text("checkbox_size").notNull().default(TASK_STYLE_COLUMN_DEFAULTS.checkboxSize),
  checkboxBgColor: text("checkbox_bg_color")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.checkboxBgColor),
  checkboxBgOpacity: real("checkbox_bg_opacity")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.checkboxBgOpacity),
  checkboxBorderColor: text("checkbox_border_color")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.checkboxBorderColor),
  checkboxBorderWidth: text("checkbox_border_width")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.checkboxBorderWidth),
  checkboxBorderRadius: text("checkbox_border_radius")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.checkboxBorderRadius),
  checkboxMarginTop: text("checkbox_margin_top")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.checkboxMarginTop),
  checkboxMarginLeft: text("checkbox_margin_left")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.checkboxMarginLeft),
  checkboxMarginRight: text("checkbox_margin_right")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.checkboxMarginRight),
  checkboxTickChar: text("checkbox_tick_char")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.checkboxTickChar),
  checkboxTickSize: text("checkbox_tick_size")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.checkboxTickSize),
  checkboxTickColor: text("checkbox_tick_color")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.checkboxTickColor),
  bulletChar: text("bullet_char").notNull().default(TASK_STYLE_COLUMN_DEFAULTS.bulletChar),
  bulletSize: text("bullet_size").notNull().default(TASK_STYLE_COLUMN_DEFAULTS.bulletSize),
  bulletColor: text("bullet_color").notNull().default(TASK_STYLE_COLUMN_DEFAULTS.bulletColor),
  bulletMarginTop: text("bullet_margin_top")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.bulletMarginTop),
  bulletMarginLeft: text("bullet_margin_left")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.bulletMarginLeft),
  bulletMarginRight: text("bullet_margin_right")
    .notNull()
    .default(TASK_STYLE_COLUMN_DEFAULTS.bulletMarginRight),
});

export const botConfig = sqliteTable("bot_config", {
  id: text("id").primaryKey().default(SINGLETON_ID),
  taskCommandsEnabled: integer("task_commands_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  timerCommandsEnabled: integer("timer_commands_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  commandAliases: text("command_aliases", { mode: "json" })
    .$type<Record<string, string>>()
    .notNull()
    .default({}),
  // Moderation state, read by bot.ingest from the row it already loads (no extra
  // round trip). Logins are stored lowercase; services/bot-moderation.ts edits the
  // list with guarded JSON1 UPDATEs, never a read-modify-write.
  muted: integer("muted", { mode: "boolean" }).notNull().default(false),
  blockedViewers: text("blocked_viewers", { mode: "json" }).$type<string[]>().notNull().default([]),
  msgTaskAdded: text("msg_task_added").notNull().default(TASK_MESSAGE_COLUMN_DEFAULTS.taskAdded),
  msgNoTaskAdded: text("msg_no_task_added")
    .notNull()
    .default(TASK_MESSAGE_COLUMN_DEFAULTS.noTaskAdded),
  msgNoTaskContent: text("msg_no_task_content")
    .notNull()
    .default(TASK_MESSAGE_COLUMN_DEFAULTS.noTaskContent),
  msgNoTaskToEdit: text("msg_no_task_to_edit")
    .notNull()
    .default(TASK_MESSAGE_COLUMN_DEFAULTS.noTaskToEdit),
  msgTaskEdited: text("msg_task_edited").notNull().default(TASK_MESSAGE_COLUMN_DEFAULTS.taskEdited),
  msgTaskRemoved: text("msg_task_removed")
    .notNull()
    .default(TASK_MESSAGE_COLUMN_DEFAULTS.taskRemoved),
  msgTaskNext: text("msg_task_next").notNull().default(TASK_MESSAGE_COLUMN_DEFAULTS.taskNext),
  msgAdminDeleteTasks: text("msg_admin_delete_tasks")
    .notNull()
    .default(TASK_MESSAGE_COLUMN_DEFAULTS.adminDeleteTasks),
  msgTaskDone: text("msg_task_done").notNull().default(TASK_MESSAGE_COLUMN_DEFAULTS.taskDone),
  msgTaskCheck: text("msg_task_check").notNull().default(TASK_MESSAGE_COLUMN_DEFAULTS.taskCheck),
  msgTaskCheckUser: text("msg_task_check_user")
    .notNull()
    .default(TASK_MESSAGE_COLUMN_DEFAULTS.taskCheckUser),
  msgNoTask: text("msg_no_task").notNull().default(TASK_MESSAGE_COLUMN_DEFAULTS.noTask),
  msgNoTaskOther: text("msg_no_task_other")
    .notNull()
    .default(TASK_MESSAGE_COLUMN_DEFAULTS.noTaskOther),
  msgNotMod: text("msg_not_mod").notNull().default(TASK_MESSAGE_COLUMN_DEFAULTS.notMod),
  msgClearedAll: text("msg_cleared_all").notNull().default(TASK_MESSAGE_COLUMN_DEFAULTS.clearedAll),
  msgClearedDone: text("msg_cleared_done")
    .notNull()
    .default(TASK_MESSAGE_COLUMN_DEFAULTS.clearedDone),
  msgNextNoContent: text("msg_next_no_content")
    .notNull()
    .default(TASK_MESSAGE_COLUMN_DEFAULTS.nextNoContent),
  msgHelp: text("msg_help").notNull().default(TASK_MESSAGE_COLUMN_DEFAULTS.help),
  msgNotRunning: text("msg_not_running")
    .notNull()
    .default(TIMER_MESSAGE_COLUMN_DEFAULTS.notRunning),
  msgWrongCommand: text("msg_wrong_command")
    .notNull()
    .default(TIMER_MESSAGE_COLUMN_DEFAULTS.wrongCommand),
  msgTimerRunning: text("msg_timer_running")
    .notNull()
    .default(TIMER_MESSAGE_COLUMN_DEFAULTS.timerRunning),
  msgCommandSuccess: text("msg_command_success")
    .notNull()
    .default(TIMER_MESSAGE_COLUMN_DEFAULTS.commandSuccess),
  msgCycleWrong: text("msg_cycle_wrong")
    .notNull()
    .default(TIMER_MESSAGE_COLUMN_DEFAULTS.cycleWrong),
  msgEta: text("msg_eta").notNull().default(TIMER_MESSAGE_COLUMN_DEFAULTS.eta),
});
