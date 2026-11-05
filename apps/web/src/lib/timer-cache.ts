// The dashboard's timer actions write their answer into the `timer.get` cache. Every action
// (start, pause, resume, skip, reset) answers with the timer row as it stands after the write,
// the shape `timer.get` returns, so re-reading `timer.get` after a click cost one more /rpc
// round trip (2 Worker requests and a D1 read) for what the answer already said, and the
// transport kept its pre-click label until that read came back. React-free, so it is tested
// against a real QueryClient.

import type { DataTag, QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * Put a timer action's answer into the cache at `timerKey`. Fetches of that key still in
 * flight are cancelled first: a poll that left before the write could otherwise land after the
 * answer and put the old phase back. A null answer means the action changed nothing (pause on a
 * timer chat already paused, skip while idle: the console was showing a stale phase), so the
 * timer is re-read instead. The promise settles once the cache holds the answer (or the re-read
 * has landed), so a mutation that returns it from `onSuccess` stays pending until the console
 * shows the new phase. `row` must have the key's own data type, so an action that ever answers
 * with less than the whole timer fails to compile here instead of corrupting the cache.
 */
export async function applyTimerResult<TRow>(
  queryClient: QueryClient,
  timerKey: DataTag<QueryKey, TRow | null, unknown>,
  row: NoInfer<TRow> | null,
): Promise<void> {
  await queryClient.cancelQueries({ queryKey: timerKey });
  if (row === null) {
    await queryClient.invalidateQueries({ queryKey: timerKey });
    return;
  }
  queryClient.setQueryData(timerKey, row);
}
