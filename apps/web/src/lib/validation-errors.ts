import { TRPCClientError } from "@trpc/client";

import { API_UNREACHABLE_MESSAGE, describeTrpcError } from "@/lib/trpc-errors";

/** The parts of a zod issue the dashboard needs — zod's own type, structurally. */
export interface IssueLike {
  path: readonly PropertyKey[];
  message: string;
}

/** "timerStyles.dimensions.width" → "timer styles › dimensions › width" */
function describePath(path: readonly PropertyKey[]): string {
  return path
    .map((segment) =>
      String(segment)
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .toLowerCase(),
    )
    .join(" › ");
}

/** One readable line for a list of zod issues: the first issue plus a count of the rest. */
export function describeIssues(issues: readonly IssueLike[]): string {
  const [first] = issues;
  if (!first) return "Invalid input";
  const where = describePath(first.path);
  const text = where ? `${where}: ${first.message}` : first.message;
  return issues.length > 1 ? `${text} (+${issues.length - 1} more)` : text;
}

/**
 * A zod message rewritten for a named field: the byte cap as the chat limit it is, the rest
 * prefixed with the field's label.
 */
function describeFieldMessage(label: string, message: string): string {
  const bytes = /at most (\d+) bytes/.exec(message);
  if (bytes) return `'${label}' is over the ${bytes[1]}-byte chat limit`;
  if (/control characters/.test(message)) return `'${label}' contains a control character`;
  return `'${label}': ${message}`;
}

/**
 * Like `describeIssues`, but names the first issue's field by the label the owner sees
 * (`resolve` maps an issue path to it, or null to fall back to the path in words), and hands
 * that field back so the caller can focus it.
 */
export function describeFieldIssues<F extends { label: string }>(
  issues: readonly IssueLike[],
  resolve: (path: readonly PropertyKey[]) => F | null,
): { text: string; field: F | null } {
  const [first] = issues;
  if (!first) return { text: "Invalid input", field: null };
  const field = resolve(first.path);
  if (!field) return { text: describeIssues(issues), field: null };
  const text = describeFieldMessage(field.label, first.message);
  return { text: issues.length > 1 ? `${text} (+${issues.length - 1} more)` : text, field };
}

function isIssueList(value: unknown): value is IssueLike[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        Array.isArray((item as IssueLike).path) &&
        typeof (item as IssueLike).message === "string",
    )
  );
}

/**
 * Toast text for a failed mutation. Transport failures (outage page, network)
 * get the shared "can't reach the API" copy. A tRPC input-validation failure
 * whose `message` is the serialized zod issue list is shown as one readable
 * line naming the field instead of the raw JSON blob (the api worker already
 * rewrites most of these; this is the client-side fallback).
 */
export function formatMutationError(err: unknown): string {
  const raw =
    err instanceof TRPCClientError
      ? describeTrpcError(err)
      : typeof err === "object" && err !== null && typeof (err as Error).message === "string"
        ? (err as Error).message
        : API_UNREACHABLE_MESSAGE;
  const message = raw.trim();
  if (!message.startsWith("[")) return raw;
  try {
    const parsed: unknown = JSON.parse(message);
    return isIssueList(parsed) ? describeIssues(parsed) : raw;
  } catch {
    return raw;
  }
}
