# Dirework Pre-Migration Audit

Full code review + audit run 2026-07-01, ahead of the Cloudflare Workers rebuild
(see `MIGRATION.md`). Method: 4 parallel review dimensions (duplication, security,
correctness, UI/UX) with every finding adversarially verified by an independent agent;
only confirmed findings are listed. 45 agents, 29 confirmed findings out of a larger raw set.

**Severity:** 1 high · 11 medium · 17 low.
**Port relevance tags:** `carry-over-bug` = will follow the code into CF unless fixed;
`fix-in-port` = fix while porting (don't reproduce); `fix-in-frontend-regen` = solve in the
regenerated UI; `moot-after-migration` = disappears with migration.

---

## HIGH

### H1. Bot OAuth access/refresh tokens leaked to the browser via `user.me` — security, carry-over-bug
`packages/api/src/routers/user.ts:10-28`
`user.me` returns the whole `botAccount` row — including `accessToken`, `refreshToken`,
`expiresAt`, `scopes` — serialized to dashboard client JS on every load. Chat-scoped Twitch
credentials must never leave the server; any XSS/extension/cache exposure yields working
bot tokens.
**Fix:** restrict select to non-secret columns (`username`, `displayName`, `twitchId`,
`expiresAt`); never return tokens from any procedure. In the CF rebuild the browser bot page
needs the *short-lived chat token* via a dedicated, owner-authenticated endpoint — still never
the refresh token or client secret.

## MEDIUM

### M1. Bot command handlers duplicate tRPC router mutation logic wholesale — duplication, fix-in-port
`packages/api/src/bot/commands.ts` (handleTaskAdd 152-194; timer start/pause/resume/skip/reset 492-623)
Line-for-line copies of `task.create`, `timer.start/pause/resume/skip/reset`, and the
markDone+promote block. Two implementations of the same state machine drift.
**Fix (port):** extract `taskService` / `timerService` functions in `packages/api/src`; both
tRPC procedures and the new `bot.ingest` path call them. This is the cornerstone refactor of
the port — the browser-bot architecture *requires* it.

### M2. `resume()` permanently stuck when paused with 0ms remaining — bugs, carry-over-bug
`packages/api/src/routers/timer.ts:142-159`
Guard `if (!timer?.pausedWithRemaining)` treats legit `0` as "never paused" → timer stuck in
paused forever. **Fix:** nullish check `== null`.

### M3. `BotConfigData`/message config interfaces duplicated across api + web — duplication, carry-over-bug
`packages/api/src/bot/commands.ts:9-49` vs `apps/web/src/lib/config-types.ts:88-132`
32 message keys maintained in 3 places. **Fix:** define once (export from `@dirework/api`),
import everywhere.

### M4. Style config interfaces re-declared inline in overlay display components — duplication, fix-in-frontend-regen
`apps/web/src/components/timer-display.tsx:7-30`, `task-list-display.tsx:8-60`
Hand-maintained copies of `TimerStylesConfig`/`TaskStylesConfig`; already diverging.
**Fix:** import from `config-types.ts`; compose `TimerStylesConfig & { labels; showHours }`.

### M5. Viewer open-tasks query repeated 5× in commands.ts — duplication, fix-in-port
`commands.ts:162-168, 204-210, 260-266, 292-298, 337-343` (+ promote-next-pending 3×)
**Fix:** `getViewerOpenTasks(db, twitchId)` + `promoteNextPending(db, twitchId)` helpers.

### M6. Broadcaster lookup + priority derivation repeated 3× — duplication, fix-in-port
`commands.ts:170-171, 430-431; task.ts:39-42`
**Fix:** `resolveTaskPlacement(db, authorTwitchId)` → `{ isBroadcaster, priority, nextOrder }`.

### M7. Destructive actions fire with no confirmation — uiux, fix-in-frontend-regen
`dashboard.tsx:247,291`; bot disconnect `bot-settings-page.tsx:437`; timer stop; clear-all/done.
Token regenerate silently breaks pasted OBS URLs. **Fix (regen):** shared AlertDialog (as built
for Wolfathon) + warning copy on regenerate.

### M8. No unsaved-changes guard on navigation — uiux, fix-in-frontend-regen
`styles-page.tsx:172-228`, `bot-settings-page.tsx:175`
Hand-tuned themes lost on nav click. **Fix (regen):** beforeunload + in-app nav intercept when dirty.

### M9. 12px base input/button text; iOS zoom-on-focus — uiux, fix-in-frontend-regen
`ui/input.tsx:12`, `ui/button.tsx:9`
**Fix (regen):** ≥16px inputs on touch viewports; text-sm minimum elsewhere.

### M10. Default button variant has no hover state — uiux, carry-over-bug
`ui/button.tsx:13` — hover scoped to `[a]:` descendants only; native buttons get none.
**Fix:** unscoped `hover:bg-primary/90`.

### M11. Animations ignore `prefers-reduced-motion`; active task pulses forever — uiux, fix-in-frontend-regen
`task-manager.tsx:210`, `timer-status-badge.tsx:30`
**Fix (regen):** global motion-reduce rules; static highlight for active task.

## LOW

- **L1 (security, fix-in-port)** Chat path has no task text length limit / per-user cap — `commands.ts:152-194`. tRPC caps at 500; `!task` bypasses. Enforce shared `MAX_TASK_LEN` + pending-task cap in the new `bot.ingest`.
- **L2 (security, fix-in-port)** Overlay token compare is non-constant-time `!==` — `overlay.ts:15` et al. Use timing-safe compare in the single new `verifyOverlayToken` helper.
- **L3 (security, fix-in-port)** Public token inputs unbounded `z.string()` — `overlay.ts:12` et al. Constrain (`.uuid()`/`.length(36)`).
- **L4 (bugs, carry-over-bug)** `reset()` hardcodes `totalCycles: 4`, ignoring configured `defaultCycles` — `timer.ts:199-213` (+ literal repeated `commands.ts:618,501`). Use `DEFAULTS.defaultCycles`/timerConfig.
- **L5 (bugs, fix-in-port)** finished-transition persists `currentCycle = totalCycles + 1` ("5 of 4") — `timer-logic.ts:90-98`. Clamp on finish.
- **L6 (bugs, fix-in-port)** `skip()` from idle/finished still writes DB + emits — `timer.ts:161-197`. Add nextPhase's no-op guard.
- **L7 (duplication, fix-in-port)** Overlay payload assembly written 3× per overlay type — `overlay.ts`. Extract `loadTimerOverlayPayload`/`loadTaskOverlayPayload`; SSE copies die anyway.
- **L8 (duplication, fix-in-port)** Token gate copy-pasted 7× — `overlay.ts, timer.ts, task.ts`. One `verifyOverlayToken` (pairs with L2).
- **L9 (duplication, fix-in-port)** `onBan`/`onTimeout` byte-identical — `bot/index.ts:105-125`. `removeTasksByUsername(db, username)`; reuse in handleClear.
- **L10 (duplication, fix-in-port)** Config-router singleton update envelope repeated 6×; `'singleton'` literal ×13 — `config.ts`. `updateSingleton(db, table, values)` + `SINGLETON_ID` const.
- **L11 (duplication, moot)** `formatTime`/`formatClock` share ceil-to-seconds math — `timer-utils.ts`.
- **L12 (uiux, carry-over-bug)** Command-alias editor loses focus per keystroke; duplicate empty keys collide — `bot-settings-page.tsx:326-342`. Model as `{id,key,value}[]` rows; collapse to object at save.
- **L13 (uiux, fix-in-frontend-regen)** Theme cards lack `aria-pressed` + focus-visible ring — `theme-card.tsx:16-24`.
- **L14 (uiux, carry-over-bug)** Timer/config/task mutations have no `onError` — silent failures — `timer-controls.tsx:160-202` et al. Add error toasts everywhere.
- **L15 (uiux, fix-in-frontend-regen)** Task/Timer MessageEditor near-identical ×2 + defaults re-typed in page — `message-editor.tsx:56-190`, `bot-settings-page.tsx:54-92`. One generic editor; import defaults from api package.
- **L16 (uiux, pattern-worth-keeping)** Style preview hardcodes dark canvas — `style-preview-panel.tsx:93,105`. Keep the OBS-like preview; add light/checkerboard backdrop toggle.

---

## How this folds into the migration

| Phase (MIGRATION.md) | Findings applied |
|---|---|
| DB port | — |
| API port (services) | **M1** (services extraction), M2, M5, M6, L1, L4, L5, L6, L9, L10 |
| Overlay → polling | L2, L3, L7, L8 |
| Server (Hono) | **H1** (column-scoped selects; token endpoint design) |
| Frontend regen | M3, M4, M7, M8, M9, M10, M11, L12, L13, L14, L15, L16 |
