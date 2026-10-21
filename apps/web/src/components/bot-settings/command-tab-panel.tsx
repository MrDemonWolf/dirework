"use client";

// Body of the Task and Timer tabs on the bot settings page: a header carrying the group's
// enable switch, then the command reference beside the reply editor. On small screens the
// editor comes first and the reference trails it as a legend.

import { CommandReference } from "@/components/bot-settings/command-reference";
import type { CommandRow } from "@/lib/command-rows";
import { MessageEditor, type ReplyPreview } from "@/components/bot-settings/message-editor";
import { ConsoleRule } from "@/components/console-rule";
import { Callout } from "@/components/ui/callout";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { MessageField } from "@/lib/message-fields";

/**
 * ONE tab body shared by the Task and Timer command tabs (spec §5.4).
 *
 * Fully controlled: the switch and message edits only update the page's draft, which the
 * page's SaveBar persists. When `enabled` is off the message fields are disabled, a note
 * says why, and the reference legend shows the group as off.
 */
export function CommandTabPanel<T extends object>({
  title,
  subtitle,
  idPrefix,
  enabled,
  onEnabledChange,
  commands,
  fields,
  messages,
  defaults,
  onMessagesChange,
  preview,
}: {
  title: string;
  subtitle: string;
  idPrefix: string;
  enabled: boolean;
  onEnabledChange: (checked: boolean) => void;
  commands: CommandRow[];
  fields: readonly MessageField<Extract<keyof T, string>>[];
  messages: T;
  defaults: T;
  onMessagesChange: (values: T) => void;
  preview: ReplyPreview;
}) {
  return (
    <div className="space-y-5">
      {/* Stable header: the switch keeps its place no matter how long the list below gets. */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div>
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2.5">
          {/* Label names what the switch controls; the switch itself shows
              state (a label that flips "On"/"Off" reads as the OPPOSITE
              action target half the time). */}
          <Label htmlFor={`${idPrefix}-commands-toggle`} className="console-label">
            Enabled
          </Label>
          <Switch
            id={`${idPrefix}-commands-toggle`}
            checked={enabled}
            onCheckedChange={onEnabledChange}
          />
        </div>
      </div>

      {!enabled && (
        <Callout variant="info" title={`${title} are off`}>
          The bot ignores them in chat. Switch them on to edit the replies.
        </Callout>
      )}

      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
        <CommandReference
          commands={commands}
          disabled={!enabled}
          className="order-last lg:order-first"
        />
        <div className="min-w-0 space-y-3">
          <ConsoleRule as="h3" label="Messages" />
          <MessageEditor
            fields={fields}
            idPrefix={idPrefix}
            values={messages}
            defaults={defaults}
            onChange={onMessagesChange}
            preview={preview}
            disabled={!enabled}
          />
        </div>
      </div>
    </div>
  );
}
