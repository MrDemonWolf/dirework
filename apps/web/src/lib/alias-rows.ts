import {
  type AliasIssueReason,
  KNOWN_ALIAS_TARGETS,
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

/** Which input of a row an issue belongs to: the alias name or the command it runs. */
export type AliasRowField = "key" | "value";

export interface AliasRowIssue {
  rowId: string;
  field: AliasRowField;
  reason: AliasIssueReason;
}

/** Row-level copy for each reason, per input, so a row with two problems shows both. */
const ISSUE_MESSAGES: Record<AliasRowField, Partial<Record<AliasIssueReason, string>>> = {
  key: {
    empty: "Fill in the alias, or remove the row.",
    "multi-word": "Use a single word for the alias.",
    "shadows-builtin": "That's a built-in command — pick a different alias name.",
    duplicate: "Duplicate alias — rename or remove one before saving.",
    recursive: "An alias can't point at itself.",
  },
  value: {
    empty: "Fill in the command, or remove the row.",
    "multi-word": "Use a single command name — aliases can't include arguments.",
    "unknown-target": "Unknown command — pick one of the built-in commands.",
  },
};

export function aliasIssueMessage(field: AliasRowField, reason: AliasIssueReason): string {
  return ISSUE_MESSAGES[field][reason] ?? "Fix this field before saving.";
}

/**
 * Stand-ins for the half of a row that is NOT being checked: a real command as the target
 * when probing the alias, and an alias no command is named as when probing the target.
 */
const PROBE_TARGET = KNOWN_ALIAS_TARGETS[0];
const PROBE_KEY = "dirework-alias-probe";

/** Ids for rows the owner adds in this browser. Never used for saved rows (see below). */
let aliasIdCounter = 0;
export function nextAliasRowId(): string {
  aliasIdCounter += 1;
  return `alias-row-${aliasIdCounter}`;
}

/**
 * Saved aliases as rows. The ids are derived from position, not the module counter: the
 * Bot settings editor seeds these rows during SSR AND during hydration, and a counter that
 * a reused Worker isolate (or an earlier client navigation) already advanced would give the
 * two renders different input ids — a hydration mismatch. The `alias-saved-` prefix can't
 * collide with `nextAliasRowId`'s.
 */
export function aliasesToRows(aliases: Record<string, string>): AliasRow[] {
  return Object.entries(aliases).map(([key, value], index) => ({
    id: `alias-saved-${index}`,
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
 *
 * The validator stops at a row's first problem. To flag both inputs of a row that is
 * wrong twice, each rejected row is checked again one half at a time, still by
 * `normalizeAliases`: the aliases against a known command (with every row, so duplicates
 * still count), and the target under an alias no command is named as. Which rows are
 * rejected is always the validator's own verdict.
 */
export function rowsToAliases(rows: AliasRow[]): {
  aliases: Record<string, string>;
  issues: AliasRowIssue[];
} {
  const filled = rows.filter(
    (row) => normalizeAliasToken(row.key) !== "" || normalizeAliasToken(row.value) !== "",
  );
  const { aliases, issues } = normalizeAliases(filled.map((row) => [row.key, row.value] as const));
  if (issues.length === 0) return { aliases, issues: [] };

  const keyIssues = new Map(
    normalizeAliases(filled.map((row) => [row.key, PROBE_TARGET] as const)).issues.map(
      (issue) => [issue.index, issue.reason] as const,
    ),
  );

  const rowIssues: AliasRowIssue[] = [];
  for (const issue of issues) {
    const row = filled[issue.index];
    // Recursion only shows with both halves together ("go" -> "go").
    const keyReason =
      keyIssues.get(issue.index) ?? (issue.reason === "recursive" ? "recursive" : undefined);
    let valueReason: AliasIssueReason | undefined = normalizeAliases([[PROBE_KEY, row.value]])
      .issues[0]?.reason;
    // Only a target spelled like the probe alias can read as recursive: it is unknown anyway.
    if (valueReason === "recursive") valueReason = "unknown-target";
    if (keyReason) rowIssues.push({ rowId: row.id, field: "key", reason: keyReason });
    if (valueReason) rowIssues.push({ rowId: row.id, field: "value", reason: valueReason });
    // Never let a rejected row go unflagged, whatever the split found.
    if (!keyReason && !valueReason) {
      rowIssues.push({ rowId: row.id, field: "key", reason: issue.reason });
    }
  }
  return { aliases, issues: rowIssues };
}
