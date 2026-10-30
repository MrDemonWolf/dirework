// Dashboard stats. Read-only: the numbers are written by the timer and task services as a
// side effect of writes they already make (services/stats-service.ts).

import { ownerProcedure, router } from "../index";
import { getStatsSummary, readStatsTimeZone } from "../services/stats-service";
import { maybeAdvanceOverdueTimer } from "../services/timer-service";

export const statsRouter = router({
  /**
   * ownerProcedure → `getStatsSummary`: today, this week, the week streak and 14 daily focus
   * buckets in the owner's zone, from one primary-key range read (≤ 35 rows). Part of the
   * dashboard's SSR batch; never polled.
   *
   * An overdue timer is advanced FIRST (its credits land in the same batch as the advance),
   * so a dashboard opened after an unattended session counts the phases that ended meanwhile
   * — even though `timer.get` in the same batch races to do the same advance. Normally this
   * costs one timer_state read, run beside the zone read.
   */
  summary: ownerProcedure.query(async ({ ctx }) => {
    const [timeZone] = await Promise.all([
      readStatsTimeZone(ctx.db),
      maybeAdvanceOverdueTimer(ctx.db),
    ]);
    return getStatsSummary(ctx.db, { timeZone });
  }),
});
