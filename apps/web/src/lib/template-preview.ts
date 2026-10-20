// Sample values for the Bot settings reply previews. The preview itself is the bot's own
// `interpolate` (`@dirework/api/chat-text`), byte cap and command-lead stripping included, so
// what the owner sees is what chat would get.

import { TEMPLATE_VARIABLES, type TemplateVariableName } from "@dirework/api/chat-text";

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
