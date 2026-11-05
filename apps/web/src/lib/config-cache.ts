// Config saves write their answer into the `config.get` cache. Every config write answers with
// the state it left behind (updateTimerConfig the timer config, updateStyles both style sets and
// the timer config, updateBotSettings the bot config row, setBotMuted the mute flag), so
// re-reading `config.get` after a save cost one more /rpc round trip (2 Worker requests, plus the
// ~9 D1 rows `config.get`'s provisioning batch and reads touch) for what the answer already said,
// and the instant switches stayed disabled until that read came back. This is the one home for
// those merges: every save path calls `applyConfigResult` with the merge for its procedure.
// Block and unblock still re-read, since their answer is only the login, not the list.
// React-free, so it is tested against a real QueryClient.

import type { DataTag, QueryClient, QueryKey } from "@tanstack/react-query";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@dirework/api/routers/index";

type ConfigOutputs = inferRouterOutputs<AppRouter>["config"];
type ConfigInputs = inferRouterInputs<AppRouter>["config"];

/** What `config.get` answers. */
export type ConfigData = ConfigOutputs["get"];

/** How one save's answer changes the cached config. */
export type ConfigMerge = (config: ConfigData) => ConfigData;

/**
 * Merge a config save's answer into the cache at `configKey`. Fetches of that key still in
 * flight are cancelled first: a read that left before the write could otherwise land after the
 * answer and put the old value back. With nothing cached to merge into (the first load failed)
 * the config is read instead. The promise settles once the cache holds the answer (or the read
 * has landed), so a mutation that returns it from `onSuccess` stays pending until the page
 * shows the saved value.
 */
export async function applyConfigResult(
  queryClient: QueryClient,
  configKey: DataTag<QueryKey, ConfigData, unknown>,
  merge: ConfigMerge,
): Promise<void> {
  await queryClient.cancelQueries({ queryKey: configKey });
  if (queryClient.getQueryData(configKey) === undefined) {
    await queryClient.invalidateQueries({ queryKey: configKey });
    return;
  }
  queryClient.setQueryData(configKey, (old) => (old === undefined ? old : merge(old)));
}

/** `config.updateTimerConfig` answers with the whole timer config. */
export function timerConfigSaved(timerConfig: ConfigOutputs["updateTimerConfig"]): ConfigMerge {
  return (config) => ({ ...config, timerConfig });
}

/** `config.updateStyles` answers with both style sets and the timer config (the phase labels). */
export function stylesSaved(saved: ConfigOutputs["updateStyles"]): ConfigMerge {
  return (config) => ({ ...config, ...saved });
}

/** The `config.updateBotSettings` fields, each named as in the bot config it answers with. */
const BOT_SETTING_FIELDS = [
  "taskCommandsEnabled",
  "timerCommandsEnabled",
  "commandAliases",
  "taskAccess",
  "task",
  "timer",
] as const satisfies readonly (keyof ConfigInputs["updateBotSettings"] &
  keyof ConfigData["botConfig"])[];

/**
 * `config.updateBotSettings` answers with the whole bot config row, but only the fields this
 * save `sent` are taken from it (as the server stored them: aliases come back normalized). The
 * rest of the row is as of this write, and a mute or a block may have reached the cache since
 * (the live switches save on their own, and can be in flight together), so taking it whole
 * could put an older value back.
 */
export function botSettingsSaved(
  saved: ConfigOutputs["updateBotSettings"],
  sent: ConfigInputs["updateBotSettings"],
): ConfigMerge {
  const changed: Partial<ConfigData["botConfig"]> = {};
  for (const field of BOT_SETTING_FIELDS) {
    if (sent[field] !== undefined) Object.assign(changed, { [field]: saved[field] });
  }
  return (config) => ({ ...config, botConfig: { ...config.botConfig, ...changed } });
}

/** `config.setBotMuted` answers with the mute flag alone. */
export function botMutedSaved({ muted }: ConfigOutputs["setBotMuted"]): ConfigMerge {
  return (config) => ({ ...config, botConfig: { ...config.botConfig, muted } });
}
