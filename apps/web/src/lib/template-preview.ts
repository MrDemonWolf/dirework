// Sample values for the Bot settings reply previews. The preview itself is the bot's own
// `interpolate` (`@dirework/api/chat-text`), byte cap and command-lead stripping included, so
// what the owner sees is what chat would get.

import { TEMPLATE_VARIABLES, type TemplateVariableName } from "@dirework/api/chat-text";

import type { MessageField } from "@/lib/message-fields";

/**
 * `{ user, channel, task, … }` as `interpolate` reads them. The streamer's own name stands in
 * for the viewer and the channel, so a preview reads like a line in their chat.
 */
export function previewVars(streamerName: string): Record<TemplateVariableName, string> {
  const vars = {} as Record<TemplateVariableName, string>;
  for (const name of Object.keys(TEMPLATE_VARIABLES) as TemplateVariableName[]) {
    vars[name] = TEMPLATE_VARIABLES[name].sample ?? streamerName;
  }
  return vars;
}

/** Every handler in bot/commands.ts passes these two, whatever the reply. */
const ALWAYS_PASSED: readonly TemplateVariableName[] = ["user", "channel"];

/**
 * The subset of `vars` this reply's handler actually passes. A placeholder typed into a
 * template that its handler never fills (`{oldTask}` in "Task added") stays literal in chat,
 * so the preview must leave it literal too instead of filling it from the full sample set.
 */
export function previewVarsFor(
  field: Pick<MessageField, "variables">,
  vars: Record<TemplateVariableName, string>,
): Partial<Record<TemplateVariableName, string>> {
  const passed: Partial<Record<TemplateVariableName, string>> = {};
  for (const name of [...ALWAYS_PASSED, ...field.variables]) {
    passed[name] = vars[name];
  }
  return passed;
}
