"use client";

// Body of the Task and Timer tabs on the bot settings page: a header carrying the group's
// enable switch, then the command reference beside the reply editor. On small screens the
// editor comes first and the reference trails it as a legend; from `lg` up the reference
// sticks beside the editor while the reply groups scroll. Rows marked `alwaysOn` (the meta
// commands) get a legend of their own under it, because the switch doesn't turn them off.

import { CommandReference } from "@/components/bot-settings/command-reference";
import type { CommandRow } from "@/lib/command-rows";
import { MessageEditor, type ReplyPreview } from "@/components/bot-settings/message-editor";
import { ConsoleRule } from "@/components/console-rule";
import { Callout } from "@/components/ui/callout";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { MessageField } from "@/lib/message-fields";
import { cn } from "@/lib/utils";

/**
 * ONE tab body shared by the Task and Timer command tabs (spec §5.4).
 *
 * Fully controlled: the switch and message edits only update the page's draft, which the
 * page's SaveBar persists. When `enabled` is off the replies stay editable but dimmed, a note
 * says the group is off, and the reference legend shows it as off. The "Always on" legend
 * never does: those commands still answer in chat.
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
  savedMessages,
  invalidKeys,
  defaults,
  onMessagesChange,
  filter,
  onFilterChange,
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
  /** Last-saved replies, so a group with an unsaved edit opens itself. */
  savedMessages: T;
  invalidKeys?: ReadonlySet<string>;
  defaults: T;
  onMessagesChange: (values: T) => void;
  /** The reply filter's text, held by the page (see MessageEditor). */
  filter: string;
  onFilterChange: (filter: string) => void;
  preview: ReplyPreview;
}) {
  const switchable = commands.filter((cmd) => !cmd.alwaysOn);
  const alwaysOn = commands.filter((cmd) => cmd.alwaysOn);
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
          The bot ignores them in chat. You can still edit the replies below; they take effect once
          the group is on.
        </Callout>
      )}

      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
        <div className="order-last space-y-3 lg:sticky lg:top-20 lg:order-first">
          <CommandReference commands={switchable} disabled={!enabled} />
          {alwaysOn.length > 0 && <CommandReference title="Always on" commands={alwaysOn} />}
        </div>
        <div
          className={cn(
            "min-w-0 space-y-3 transition-opacity motion-reduce:transition-none",
            !enabled && "opacity-75 focus-within:opacity-100 hover:opacity-100",
          )}
        >
          <ConsoleRule as="h3" label="Messages" />
          <MessageEditor
            fields={fields}
            idPrefix={idPrefix}
            values={messages}
            saved={savedMessages}
            invalidKeys={invalidKeys}
            defaults={defaults}
            onChange={onMessagesChange}
            filter={filter}
            onFilterChange={onFilterChange}
            preview={preview}
          />
        </div>
      </div>
    </div>
  );
}
