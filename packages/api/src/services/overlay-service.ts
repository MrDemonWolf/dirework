import type { DbClient } from "@dirework/db";

import { buildTaskStylesConfig, buildTimerConfig, buildTimerStylesConfig } from "../config-shared";
import { listTasks } from "./task-service";
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
  const [tasks, taskStyleRow] = await Promise.all([listTasks(db), db.query.taskStyle.findFirst()]);

  return {
    tasks,
    taskStyles: taskStyleRow ? buildTaskStylesConfig(taskStyleRow) : null,
  };
}
