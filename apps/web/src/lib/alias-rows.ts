import {
  type AliasIssueReason,
  normalizeAliases,
  normalizeAliasToken,
} from "@dirework/api/config-shared";

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

export interface AliasRowIssue {
  rowId: string;
  reason: AliasIssueReason;
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
 * Collapse rows to the persisted object shape through the SAME shared
 * validator the server's input schema runs (normalizeAliases), so keys and
 * targets are canonical (no leading "!", lowercased) and every row the server
 * would reject — empty, duplicate, self-alias, unknown command — is reported
 * against its row id. Untouched blank rows are dropped.
 */
export function rowsToAliases(rows: AliasRow[]): {
  aliases: Record<string, string>;
  issues: AliasRowIssue[];
} {
  const filled = rows.filter(
    (row) => normalizeAliasToken(row.key) !== "" || normalizeAliasToken(row.value) !== "",
  );
  const { aliases, issues } = normalizeAliases(filled.map((row) => [row.key, row.value] as const));
  return {
    aliases,
    issues: issues.map((issue) => ({ rowId: filled[issue.index].id, reason: issue.reason })),
  };
}
