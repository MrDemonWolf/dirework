import type { DbClient } from "@dirework/db";

import { buildTaskStylesConfig, buildTimerConfig, buildTimerStylesConfig } from "../config-shared";
import { listOverlayTasks } from "./task-service";
import { maybeAdvanceOverdueTimer } from "./timer-service";

// Overlay payload assembly (L7) — one implementation per overlay type,
// shared by the public overlay query procedures.

export async function loadTimerOverlayPayload(db: DbClient) {
  const [timerState, timerConfigRow, timerStyleRow] = await Promise.all([
    // Overlay polls drive phase transitions — no always-on server on Workers.
    maybeAdvanceOverdueTimer(db),
    db.query.timerConfig.findFirst(),
    db.query.timerStyle.findFirst(),
  ]);

  return {
    timerState: timerState ?? null,
    timerConfig: timerConfigRow ? buildTimerConfig(timerConfigRow) : null,
    timerStyles: timerStyleRow ? buildTimerStylesConfig(timerStyleRow) : null,
  };
}

export async function loadTaskOverlayPayload(db: DbClient) {
  // Style first: when the overlay hides done tasks, their rows are never read
  // (only counted), which keeps every 3s poll to the open tasks.
  const taskStyleRow = await db.query.taskStyle.findFirst();
  const taskStyles = taskStyleRow ? buildTaskStylesConfig(taskStyleRow) : null;
  const showDone = taskStyles?.display.showDone ?? true;
  const { tasks, counts } = await listOverlayTasks(db, showDone ? undefined : { doneLimit: 0 });

  return { tasks, counts, taskStyles };
}
