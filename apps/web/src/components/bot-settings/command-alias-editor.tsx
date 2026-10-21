"use client";

// Aliases tab of the bot settings page: an editable list of alias -> command rows. Rows hold
// the raw input (`AliasRow`); the page converts them to the canonical, "!"-less map on save
// via `rowsToAliases` (lib/alias-rows.ts), which also drops rows left entirely blank.

import { Plus, Trash2 } from "lucide-react";

import {
  type AliasRow,
  type AliasRowIssue,
  aliasIssueMessage,
  nextAliasRowId,
  rowsToAliases,
} from "@/lib/alias-rows";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Controlled editor for the command-alias rows. Validates on every render with the same shared
 * validator the server runs and flags each rejected row inline, against the field at fault —
 * both fields, each with its own message, when the alias and the command are both wrong.
 * `maxRows` (default 50) and the inputs' `maxLength` (50 / 100) mirror the caps in the server's
 * `commandAliasesInput` schema. Either form ("!t" or "t") is accepted; the "!" is stripped
 * when the rows are normalized.
 */
export function CommandAliasEditor({
  rows,
  onChange,
  maxRows = 50,
}: {
  rows: AliasRow[];
  onChange: (rows: AliasRow[]) => void;
  maxRows?: number;
}) {
  // The same validator the save path and the server run, so every row the
  // server would reject is flagged here instead of failing the whole save.
  const issuesByRow = new Map<string, AliasRowIssue[]>();
  for (const issue of rowsToAliases(rows).issues) {
    issuesByRow.set(issue.rowId, [...(issuesByRow.get(issue.rowId) ?? []), issue]);
  }

  const handleAdd = () => {
    onChange([...rows, { id: nextAliasRowId(), key: "", value: "" }]);
  };

  const handleRowChange = (id: string, patch: Partial<Pick<AliasRow, "key" | "value">>) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const handleRemove = (id: string) => {
    onChange(rows.filter((row) => row.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Command aliases</p>
          <p className="text-xs text-muted-foreground">
            Add short names for chat commands (e.g. &quot;!t&quot; runs &quot;!task&quot;)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleAdd} disabled={rows.length >= maxRows}>
          <Plus className="size-3.5" />
          Add alias
        </Button>
      </div>

      <div className="space-y-2">
        {rows.map((row) => {
          const rowIssues = issuesByRow.get(row.id) ?? [];
          const keyIssue = rowIssues.find((issue) => issue.field === "key");
          const cmdIssue = rowIssues.find((issue) => issue.field === "value");
          const keyErrorId = `${row.id}-key-error`;
          const cmdErrorId = `${row.id}-cmd-error`;
          const keyInvalid = keyIssue !== undefined;
          const cmdInvalid = cmdIssue !== undefined;
          return (
            <div key={row.id} className="space-y-1">
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label htmlFor={`${row.id}-key`} className="console-label">
                    Alias
                  </Label>
                  <Input
                    id={`${row.id}-key`}
                    value={row.key}
                    onChange={(e) => handleRowChange(row.id, { key: e.target.value })}
                    placeholder="!t"
                    maxLength={50}
                    aria-invalid={keyInvalid || undefined}
                    aria-describedby={keyIssue ? keyErrorId : undefined}
                    className={cn("font-mono", keyInvalid && "border-destructive")}
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label htmlFor={`${row.id}-cmd`} className="console-label">
                    Command
                  </Label>
                  <Input
                    id={`${row.id}-cmd`}
                    value={row.value}
                    onChange={(e) => handleRowChange(row.id, { value: e.target.value })}
                    placeholder="!task"
                    maxLength={100}
                    aria-invalid={cmdInvalid || undefined}
                    aria-describedby={cmdIssue ? cmdErrorId : undefined}
                    className={cn("font-mono", cmdInvalid && "border-destructive")}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => handleRemove(row.id)}
                  aria-label={`Remove alias ${row.key || "(empty)"}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              {keyIssue && (
                <p id={keyErrorId} className="text-xs text-destructive">
                  <span className="font-medium">Alias:</span>{" "}
                  {aliasIssueMessage("key", keyIssue.reason)}
                </p>
              )}
              {cmdIssue && (
                <p id={cmdErrorId} className="text-xs text-destructive">
                  <span className="font-medium">Command:</span>{" "}
                  {aliasIssueMessage("value", cmdIssue.reason)}
                </p>
              )}
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No aliases yet. Click &quot;Add alias&quot; to create one.
          </p>
        )}
        {issuesByRow.size > 0 && (
          <p id="alias-error-summary" className="text-xs text-destructive" role="alert">
            Fix the highlighted aliases before saving.
          </p>
        )}
      </div>
    </div>
  );
}
