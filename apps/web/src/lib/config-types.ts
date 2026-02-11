export interface TimerStylesConfig {
  dimensions: { width: string; height: string };
  background: { color: string; opacity: number; borderRadius: string };
  ring: {
    enabled: boolean;
    trackColor: string;
    trackOpacity: number;
    fillColor: string;
    fillOpacity: number;
    width: number;
    gap: number;
  };
  text: {
    color: string;
    outlineColor: string;
    outlineSize: string;
    fontFamily: string;
  };
  fontSizes: { label: string; time: string; cycle: string };
}

export interface TaskStylesConfig {
  display: {
    showDone: boolean;
    showCount: boolean;
    useCheckboxes: boolean;
    crossOnDone: boolean;
    numberOfLines: number;
  };
  fonts: { header: string; body: string };
  scroll: { enabled: boolean; pixelsPerSecond: number; gapBetweenLoops: number };
  header: {
    height: string;
    background: { color: string; opacity: number };
    border: { color: string; width: string; radius: string };
    fontSize: string;
    fontColor: string;
    padding: string;
  };
  body: {
    background: { color: string; opacity: number };
    border: { color: string; width: string; radius: string };
    padding: { vertical: string; horizontal: string };
  };
  task: {
    background: { color: string; opacity: number };
    border: { color: string; width: string; radius: string };
    fontSize: string;
    fontColor: string;
    usernameColor: string;
    padding: string;
    marginBottom: string;
    maxWidth: string;
  };
  taskDone: {
    background: { color: string; opacity: number };
    fontColor: string;
  };
  checkbox: {
    size: string;
    background: { color: string; opacity: number };
    border: { color: string; width: string; radius: string };
    margin: { top: string; left: string; right: string };
    tickChar: string;
    tickSize: string;
    tickColor: string;
  };
  bullet: {
    char: string;
    size: string;
    color: string;
    margin: { top: string; left: string; right: string };
  };
}

export interface TimerConfigData {
  workDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  longBreakInterval: number;
  startingDuration: number;
  defaultCycles: number;
  showHours: boolean;
  noLastBreak: boolean;
  labels: PhaseLabelsConfig;
}

export interface TaskMessagesConfig {
  taskAdded: string;
  noTaskAdded: string;
  noTaskContent: string;
  noTaskToEdit: string;
  taskEdited: string;
  taskRemoved: string;
  taskNext: string;
  adminDeleteTasks: string;
  taskDone: string;
  taskCheck: string;
  taskCheckUser: string;
  noTask: string;
  noTaskOther: string;
  notMod: string;
  clearedAll: string;
  clearedDone: string;
  nextNoContent: string;
  help: string;
}

export interface TimerMessagesConfig {
  workMsg: string;
  breakMsg: string;
  longBreakMsg: string;
  workRemindMsg: string;
  notRunning: string;
  streamStarting: string;
  wrongCommand: string;
  timerRunning: string;
  commandSuccess: string;
  cycleWrong: string;
  goalWrong: string;
  finishResponse: string;
  alreadyStarting: string;
  eta: string;
}

export interface BotConfigData {
  taskCommandsEnabled: boolean;
  timerCommandsEnabled: boolean;
  commandAliases: Record<string, string>;
  task: TaskMessagesConfig;
  timer: TimerMessagesConfig;
}

export interface MessagesConfig {
  taskCommandsEnabled: boolean;
  timerCommandsEnabled: boolean;
  task: TaskMessagesConfig;
  timer: TimerMessagesConfig;
}

export interface PhaseLabelsConfig {
  idle: string;
  starting: string;
  work: string;
  break: string;
  longBreak: string;
  paused: string;
  finished: string;
}

export type CommandAliasesConfig = Record<string, string>;

/** Full config shape returned by config.get */
export interface AppConfig {
  timerConfig: TimerConfigData;
  timerStyles: TimerStylesConfig;
  taskStyles: TaskStylesConfig;
  botConfig: BotConfigData;
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  preview: {
    bg: string;
    accent: string;
    text: string;
  };
  timerStyles: TimerStylesConfig;
  taskStyles: TaskStylesConfig;
}
