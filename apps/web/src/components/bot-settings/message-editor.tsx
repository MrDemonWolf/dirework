"use client";

// Chat reply-template editor used by both command tabs of the bot settings page. The field
// lists it renders live in lib/message-fields.ts.

import { useRef, useState } from "react";
import { RotateCcw, Search } from "lucide-react";

import { interpolate, TEMPLATE_VARIABLES } from "@dirework/api/chat-text";

import { messageBudget } from "@/lib/message-budget";
import type { MessageField } from "@/lib/message-fields";
import { previewVarsFor } from "@/lib/template-preview";
import { ByteBudget } from "@/components/byte-budget";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ConsoleRule } from "@/components/console-rule";
import { CountBadge } from "@/components/count-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** What the preview line shows: who speaks, and the sample values filled into each template. */
export interface ReplyPreview {
  /** The bot account's username. */
  speaker: string;
  /** See `previewVars` in lib/template-preview.ts. */
  vars: Record<string, string>;
}

/**
 * ONE generic chat-message editor rendered for both the task and timer message
 * sets (audit L15 — replaces the two near-identical editors). Fields render in
 * console-rule subgroups; variable chips insert at the input's cursor and explain
 * themselves in a tooltip.
 *
 * Under every input sits the reply as the bot would send it — rendered by the bot's own
 * `interpolate`, so byte fitting and command-lead stripping show up too — filled with
 * the sample values this reply's handler actually passes (`previewVarsFor`) and spoken by
 * `preview.speaker`. A field whose value differs from
 * `defaults` offers "Reset to default"; "Reset all" above the list resets the whole tab.
 * Both only touch the draft — nothing persists until the page's Save bar.
 *
 * Each field shows its UTF-8 byte budget (`messageBudget`, capped at the server's
 * MAX_MESSAGE_TEMPLATE_BYTES). Typing past the cap is allowed and marked invalid; only chip
 * inserts are refused. The search filter is local UI state and matches label, key, or group.
 */
export function MessageEditor<T extends object>({
  fields,
  idPrefix,
  values,
  defaults,
  onChange,
  preview,
  disabled,
}: {
  fields: readonly MessageField<Extract<keyof T, string>>[];
  idPrefix: string;
  values: T;
  /** Stock wording per key; drives the per-field and whole-tab "Reset to default". */
  defaults: T;
  onChange: (values: T) => void;
  preview: ReplyPreview;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleChange = (key: Extract<keyof T, string>, value: string) => {
    onChange({ ...values, [key]: value });
  };

  const insertVariable = (key: Extract<keyof T, string>, token: string) => {
    const el = inputRefs.current[key];
    const current = values[key] as string;
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = current.slice(0, start) + token + current.slice(end);
    // Refuse an insert that would push the template past the byte cap — the
    // counter already explains why nothing happened.
    if (messageBudget(next).over) return;
    handleChange(key, next);
    // Refocus after the controlled re-render and park the cursor past the insert
    requestAnimationFrame(() => {
      const node = inputRefs.current[key];
      if (!node) return;
      node.focus();
      const cursor = start + token.length;
      node.setSelectionRange(cursor, cursor);
    });
  };

  const anyCustomized = fields.some((field) => values[field.key] !== defaults[field.key]);

  const query = search.toLowerCase();
  const filteredFields = fields.filter(
    (f) =>
      f.label.toLowerCase().includes(query) ||
      f.key.toLowerCase().includes(query) ||
      f.group.toLowerCase().includes(query),
  );

  // Groups in first-appearance order, so the field arrays control section order.
  const groups: string[] = [];
  for (const field of filteredFields) {
    if (!groups.includes(field.group)) groups.push(field.group);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-8 md:h-8"
            placeholder={`Filter ${fields.length} messages…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Filter messages"
            disabled={disabled}
          />
        </div>
        {/* Resets every field in the tab, so it confirms (destructive-action rule) even
            though nothing persists until Save. */}
        <ConfirmDialog
          trigger={
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-muted-foreground"
              disabled={disabled || !anyCustomized}
            >
              <RotateCcw className="size-3.5" />
              Reset all
            </Button>
          }
          title="Reset every message to its default?"
          description={`All ${fields.length} messages in this tab go back to the stock wording. Nothing is saved until you press Save changes.`}
          confirmLabel="Reset all"
          onConfirm={() => onChange(defaults)}
        />
      </div>

      {groups.map((group) => {
        const groupFields = filteredFields.filter((field) => field.group === group);
        return (
          <section key={group} aria-label={group} className="space-y-3">
            <ConsoleRule label={group}>
              <CountBadge count={groupFields.length} />
            </ConsoleRule>
            <div className="space-y-4">
              {groupFields.map((field) => {
                const value = values[field.key] as string;
                const stock = defaults[field.key] as string;
                const budget = messageBudget(value);
                const budgetId = `${idPrefix}-${field.key}-bytes`;
                const previewId = `${idPrefix}-${field.key}-preview`;
                const describedBy = [previewId, budget.nearLimit ? budgetId : null]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <div key={field.key} className="space-y-1.5">
                    <div className="flex min-h-6 items-center justify-between gap-2">
                      <Label htmlFor={`${idPrefix}-${field.key}`} className="text-xs font-medium">
                        {field.label}
                      </Label>
                      {value !== stock && (
                        <Button
                          variant="ghost"
                          size="xs"
                          className="text-muted-foreground"
                          disabled={disabled}
                          onClick={() => handleChange(field.key, stock)}
                        >
                          <RotateCcw />
                          Reset to default
                        </Button>
                      )}
                    </div>
                    <Input
                      id={`${idPrefix}-${field.key}`}
                      ref={(node) => {
                        inputRefs.current[field.key] = node;
                      }}
                      value={value}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      disabled={disabled}
                      aria-invalid={budget.over || undefined}
                      aria-describedby={describedBy}
                    />
                    <ByteBudget id={budgetId} budget={budget} />
                    <p
                      id={previewId}
                      className="rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs/relaxed break-words text-muted-foreground"
                    >
                      <span className="sr-only">Preview: </span>
                      <span className="font-medium text-primary">{preview.speaker}</span>
                      <span aria-hidden>: </span>
                      {value.trim() ? (
                        interpolate(value, previewVarsFor(field, preview.vars))
                      ) : (
                        <span className="italic">(empty)</span>
                      )}
                    </p>
                    {field.variables.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {field.variables.map((name) => {
                          const token = `{${name}}`;
                          return (
                            <Tooltip key={name}>
                              <TooltipTrigger
                                render={
                                  <button
                                    type="button"
                                    onClick={() => insertVariable(field.key, token)}
                                    disabled={disabled}
                                    aria-label={`Insert ${token}`}
                                    className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                                  >
                                    {token}
                                  </button>
                                }
                              />
                              <TooltipContent>
                                {TEMPLATE_VARIABLES[name].description}
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {filteredFields.length === 0 && (
        <p className="py-2 text-center text-xs text-muted-foreground">
          No messages match &quot;{search}&quot;.
        </p>
      )}
    </div>
  );
}
