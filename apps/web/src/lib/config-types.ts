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
  scroll: { pixelsPerSecond: number; gapBetweenLoops: number };
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
    direction: string;
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

/** Extract grouped task messages from a flat Config row */
export function extractTaskMessages(config: {
  msgTaskAdded: string;
  msgNoTaskAdded: string;
  msgNoTaskContent: string;
  msgNoTaskToEdit: string;
  msgTaskEdited: string;
  msgTaskRemoved: string;
  msgTaskNext: string;
  msgAdminDeleteTasks: string;
  msgTaskDone: string;
  msgTaskCheck: string;
  msgTaskCheckUser: string;
  msgNoTask: string;
  msgNoTaskOther: string;
  msgNotMod: string;
  msgClearedAll: string;
  msgClearedDone: string;
  msgNextNoContent: string;
  msgHelp: string;
}): TaskMessagesConfig {
  return {
    taskAdded: config.msgTaskAdded,
    noTaskAdded: config.msgNoTaskAdded,
    noTaskContent: config.msgNoTaskContent,
    noTaskToEdit: config.msgNoTaskToEdit,
    taskEdited: config.msgTaskEdited,
    taskRemoved: config.msgTaskRemoved,
    taskNext: config.msgTaskNext,
    adminDeleteTasks: config.msgAdminDeleteTasks,
    taskDone: config.msgTaskDone,
    taskCheck: config.msgTaskCheck,
    taskCheckUser: config.msgTaskCheckUser,
    noTask: config.msgNoTask,
    noTaskOther: config.msgNoTaskOther,
    notMod: config.msgNotMod,
    clearedAll: config.msgClearedAll,
    clearedDone: config.msgClearedDone,
    nextNoContent: config.msgNextNoContent,
    help: config.msgHelp,
  };
}

/** Extract grouped timer messages from a flat Config row */
export function extractTimerMessages(config: {
  msgWorkMsg: string;
  msgBreakMsg: string;
  msgLongBreakMsg: string;
  msgWorkRemindMsg: string;
  msgNotRunning: string;
  msgStreamStarting: string;
  msgWrongCommand: string;
  msgTimerRunning: string;
  msgCommandSuccess: string;
  msgCycleWrong: string;
  msgGoalWrong: string;
  msgFinishResponse: string;
  msgAlreadyStarting: string;
  msgEta: string;
}): TimerMessagesConfig {
  return {
    workMsg: config.msgWorkMsg,
    breakMsg: config.msgBreakMsg,
    longBreakMsg: config.msgLongBreakMsg,
    workRemindMsg: config.msgWorkRemindMsg,
    notRunning: config.msgNotRunning,
    streamStarting: config.msgStreamStarting,
    wrongCommand: config.msgWrongCommand,
    timerRunning: config.msgTimerRunning,
    commandSuccess: config.msgCommandSuccess,
    cycleWrong: config.msgCycleWrong,
    goalWrong: config.msgGoalWrong,
    finishResponse: config.msgFinishResponse,
    alreadyStarting: config.msgAlreadyStarting,
    eta: config.msgEta,
  };
}

/** Extract phase labels from a flat Config row */
export function extractPhaseLabels(config: {
  labelIdle: string;
  labelStarting: string;
  labelWork: string;
  labelBreak: string;
  labelLongBreak: string;
  labelPaused: string;
  labelFinished: string;
}): PhaseLabelsConfig {
  return {
    idle: config.labelIdle,
    starting: config.labelStarting,
    work: config.labelWork,
    break: config.labelBreak,
    longBreak: config.labelLongBreak,
    paused: config.labelPaused,
    finished: config.labelFinished,
  };
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
