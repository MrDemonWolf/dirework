/**
 * Config types — thin re-export shim over the single source of truth in
 * `@dirework/api/config-shared` (audit M3/M4: these interfaces used to be
 * hand-maintained duplicates that drifted from the API package).
 *
 * Only web-only composition types (ThemePreset, AppConfig) live here.
 */
export type {
  TimerStylesConfig,
  TaskStylesConfig,
  TimerConfigData,
  BotConfigData,
  TaskMessagesConfig,
  TimerMessagesConfig,
  PhaseLabelsConfig,
} from "@dirework/api/config-shared";

export {
  DEFAULT_PHASE_LABELS,
  DEFAULT_TASK_MESSAGES,
  DEFAULT_TIMER_MESSAGES,
  MAX_TASK_LEN,
} from "@dirework/api/config-shared";

import type { TaskStylesConfig, TimerStylesConfig, TimerConfigData, BotConfigData } from "@dirework/api/config-shared";

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
