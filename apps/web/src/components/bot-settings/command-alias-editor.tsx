"use client";

import { Plus, Trash2 } from "lucide-react";

import {
  type AliasIssueReason,
  aliasTokenHasWhitespace,
  normalizeAliasToken,
} from "@dirework/api/config-shared";

import { type AliasRow, nextAliasRowId, rowsToAliases } from "@/lib/alias-rows";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Row-level copy for each reason the shared alias validator rejects. */
const ISSUE_MESSAGES: Record<AliasIssueReason, string> = {
  empty: "Fill in both the alias and the command, or remove the row.",
  "multi-word": "Use a single command name — aliases can't include arguments.",
  "shadows-builtin": "That's a built-in command — pick a different alias name.",
  duplicate: "Duplicate alias — rename or remove one before saving.",
  recursive: "An alias can't point at itself.",
  "unknown-target": "Unknown command — pick one of the built-in commands.",
};

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
  const issueByRow = new Map(
    rowsToAliases(rows).issues.map((issue) => [issue.rowId, issue.reason] as const),
  );

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
          const issue = issueByRow.get(row.id);
          const errorId = `${row.id}-error`;
          // Point the error at the field that caused it.
          const keyInvalid =
            issue === "duplicate" ||
            issue === "recursive" ||
            issue === "shadows-builtin" ||
            (issue === "multi-word" && aliasTokenHasWhitespace(row.key)) ||
            (issue === "empty" && normalizeAliasToken(row.key) === "");
          const cmdInvalid =
            issue === "unknown-target" ||
            (issue === "multi-word" && aliasTokenHasWhitespace(row.value)) ||
            (issue === "empty" && normalizeAliasToken(row.value) === "");
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
                    aria-describedby={issue ? errorId : undefined}
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
                    aria-describedby={issue ? errorId : undefined}
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
              {issue && (
                <p id={errorId} className="text-xs text-destructive">
                  {ISSUE_MESSAGES[issue]}
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
        {issueByRow.size > 0 && (
          <p id="alias-error-summary" className="text-xs text-destructive" role="alert">
            Fix the highlighted aliases before saving.
          </p>
        )}
      </div>
    </div>
  );
}
