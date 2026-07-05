"use client";

import { Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Alias rows carry a stable client-side id (audit L12) so React keys survive
 * key edits — the old object-keyed model re-rendered the input on every
 * keystroke (losing focus) and collapsed duplicate empty keys into one entry.
 * Rows collapse back to a Record<alias, command> at save time.
 */
export interface AliasRow {
  id: string;
  key: string;
  value: string;
}

let aliasIdCounter = 0;
export function nextAliasRowId(): string {
  aliasIdCounter += 1;
  return `alias-row-${aliasIdCounter}`;
}

export function aliasesToRows(aliases: Record<string, string>): AliasRow[] {
  return Object.entries(aliases).map(([key, value]) => ({
    id: nextAliasRowId(),
    key,
    value,
  }));
}

/**
 * Collapse rows to the persisted object shape. Rows with an empty alias are
 * dropped; duplicate aliases are reported so the caller can block the save.
 */
export function rowsToAliases(rows: AliasRow[]): {
  aliases: Record<string, string>;
  duplicates: string[];
} {
  const aliases: Record<string, string> = {};
  const duplicates: string[] = [];
  for (const row of rows) {
    const key = row.key.trim();
    if (!key) continue;
    if (key in aliases) {
      duplicates.push(key);
      continue;
    }
    aliases[key] = row.value.trim();
  }
  return { aliases, duplicates };
}

export function CommandAliasEditor({
  rows,
  onChange,
  maxRows = 50,
  knownCommands,
}: {
  rows: AliasRow[];
  onChange: (rows: AliasRow[]) => void;
  maxRows?: number;
  /** Built-in command names — unknown targets get a non-blocking warning */
  knownCommands?: string[];
}) {
  const keyCounts = new Map<string, number>();
  for (const row of rows) {
    const key = row.key.trim();
    if (!key) continue;
    keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
  }

  const knownSet = new Set((knownCommands ?? []).map((c) => c.toLowerCase()));
  const isUnknownCommand = (value: string) => {
    if (knownSet.size === 0) return false;
    const base = value.trim().toLowerCase().split(/\s+/)[0] ?? "";
    return base !== "" && !knownSet.has(base);
  };

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
          <p className="text-sm font-medium">Command Aliases</p>
          <p className="text-xs text-muted-foreground">
            Map custom command names to built-in commands (e.g. &quot;!t&quot; to &quot;!task&quot;)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleAdd} disabled={rows.length >= maxRows}>
          <Plus className="size-3.5" />
          Add Alias
        </Button>
      </div>

      <div className="space-y-2">
        {rows.map((row) => {
          const trimmedKey = row.key.trim();
          const isDuplicate = trimmedKey !== "" && (keyCounts.get(trimmedKey) ?? 0) > 1;
          const isUnknown = isUnknownCommand(row.value);
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
                    aria-invalid={isDuplicate || undefined}
                    aria-describedby={isDuplicate ? "alias-duplicate-error" : undefined}
                    className={cn("font-mono", isDuplicate && "border-destructive")}
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
                    aria-describedby={isUnknown ? `${row.id}-cmd-warning` : undefined}
                    className="font-mono"
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
              {isUnknown && (
                <p id={`${row.id}-cmd-warning`} className="text-xs text-warning">
                  Unknown command — this alias won&apos;t fire.
                </p>
              )}
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No aliases configured. Click &quot;Add Alias&quot; to create one.
          </p>
        )}
        {rows.some((row) => {
          const k = row.key.trim();
          return k !== "" && (keyCounts.get(k) ?? 0) > 1;
        }) && (
          <p id="alias-duplicate-error" className="text-xs text-destructive" role="alert">
            Two aliases share the same name — rename or remove one before saving.
          </p>
        )}
      </div>
    </div>
  );
}
