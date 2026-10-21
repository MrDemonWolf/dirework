// The chat command legend rows. The Bot settings command reference
// (components/bot-settings/command-reference.tsx) and the viewer landing page both render
// them. Plain data with no "use client", so a server component can read the rows itself.
// Display-only: the bot's real parsing lives in `@dirework/api/chat-commands`, so the rows
// are kept in step by hand and pinned by apps/web/src/lib/__tests__/command-rows.test.ts.

/** One row of the command reference. */
export interface CommandRow {
  command: string;
  usage: string;
  description: string;
  /** Who can run it in chat; "mods" covers moderators and the streamer. */
  permission: "everyone" | "mods";
}

/** Reference rows for the Task tab. */
export const taskCommands: CommandRow[] = [
  { command: "!task", usage: "!task [task]", description: "Add a task", permission: "everyone" },
  {
    command: "!done",
    usage: "!done or !done [#]",
    description: "Mark a task done",
    permission: "everyone",
  },
  {
    command: "!edit",
    usage: "!edit [#] [new task]",
    description: "Edit a task",
    permission: "everyone",
  },
  {
    command: "!remove",
    usage: "!remove [#]",
    description: "Remove a task",
    permission: "everyone",
  },
  {
    command: "!focus",
    usage: "!focus [#]",
    description: "Set your active task",
    permission: "everyone",
  },
  {
    command: "!check",
    usage: "!check or !check @user",
    description: "Show your current task",
    permission: "everyone",
  },
  {
    command: "!today",
    usage: "!today",
    description: "Show your focus and next tasks",
    permission: "everyone",
  },
  {
    command: "!next",
    usage: "!next [task]",
    description: "Finish the current task and start the next",
    permission: "everyone",
  },
  { command: "!help", usage: "!help", description: "Show help in chat", permission: "everyone" },
  {
    command: "!clear",
    usage: "!clear all/done/@user",
    description: "Clear tasks",
    permission: "mods",
  },
];

/** Reference rows for the Timer tab. Every timer command is mod-only. */
export const timerCommands: CommandRow[] = [
  {
    command: "!timer start",
    usage: "!timer start [cycles]",
    description: "Start the timer",
    permission: "mods",
  },
  {
    command: "!timer pause",
    usage: "!timer pause",
    description: "Pause the timer",
    permission: "mods",
  },
  {
    command: "!timer resume",
    usage: "!timer resume",
    description: "Resume the timer",
    permission: "mods",
  },
  {
    command: "!timer skip",
    usage: "!timer skip",
    description: "Skip the current phase",
    permission: "mods",
  },
  {
    command: "!timer reset",
    usage: "!timer reset",
    description: "Stop and reset the timer",
    permission: "mods",
  },
  {
    command: "!timer eta",
    usage: "!timer eta",
    description: "Show when the timer ends",
    permission: "mods",
  },
];

/** Reference rows for the Moderation card. Mod-only, and never alias targets. */
export const moderationCommands: CommandRow[] = [
  { command: "!mute", usage: "!mute", description: "Pause the bot", permission: "mods" },
  { command: "!unmute", usage: "!unmute", description: "Resume the bot", permission: "mods" },
  {
    command: "!block",
    usage: "!block @user",
    description: "Block a viewer and remove their tasks",
    permission: "mods",
  },
  {
    command: "!unblock",
    usage: "!unblock @user",
    description: "Let a blocked viewer use commands again",
    permission: "mods",
  },
];
