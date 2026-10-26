// Dashboard stats. Read-only: the numbers are written by the timer and task services as a
// side effect of writes they already make (services/stats-service.ts).

import { ownerProcedure, router } from "../index";
import { getStatsSummary } from "../services/stats-service";

export const statsRouter = router({
  /**
   * ownerProcedure → `getStatsSummary`: today, this week, the week streak and 14 daily focus
   * buckets in the owner's zone, from one primary-key range read (≤ 35 rows). Part of the
   * dashboard's SSR batch; never polled.
   */
  summary: ownerProcedure.query(({ ctx }) => getStatsSummary(ctx.db)),
});
