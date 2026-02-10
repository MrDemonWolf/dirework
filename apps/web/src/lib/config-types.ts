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

export interface MessagesConfig {
  taskAdded: string;
  taskDone: string;
  taskEdited: string;
  taskRemoved: string;
  noTasks: string;
  timerStarted: string;
  timerPaused: string;
  timerResumed: string;
}

export type CommandAliasesConfig = Record<string, string>;

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
