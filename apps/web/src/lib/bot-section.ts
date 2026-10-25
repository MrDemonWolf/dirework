// What a Bot settings card shows for the queries it needs (`BotSection`, in
// app/(app)/dashboard/bot/(sections)/bot-data.tsx). React-free, so it is unit-tested directly.

/** The two queries the (sections) layout streams for every Bot settings page. */
export type BotQueryName = "config" | "user";

/** The slice of a `useQuery` result the decision reads. */
export interface BotSectionQuery {
  isPending: boolean;
  data: unknown;
}

export type BotSectionStatus<Q extends BotSectionQuery> =
  /** Still loading with nothing cached (a client fetch after a failed stream): the placeholder. */
  | { kind: "loading" }
  /**
   * Settled without data. The card shows a retry instead of its editors: an editor seeded
   * from defaults would overwrite the streamer's real replies and aliases on Save.
   */
  | { kind: "failed"; query: Q }
  | { kind: "ready" };

/** Decide a card's state from the queries it needs, and only those. */
export function botSectionStatus<Q extends BotSectionQuery>(
  queries: readonly Q[],
): BotSectionStatus<Q> {
  if (queries.some((query) => query.isPending)) return { kind: "loading" };
  const failed = queries.find((query) => query.data === undefined);
  return failed ? { kind: "failed", query: failed } : { kind: "ready" };
}
