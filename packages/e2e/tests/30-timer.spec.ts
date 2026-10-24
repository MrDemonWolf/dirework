import { DEFAULT_PHASE_LABELS, DEFAULT_TIMER_STYLES } from "@dirework/api/config-defaults";
import { expect, test, type Page } from "@playwright/test";

import { confirmDialog, revealSecretUrl, signIn } from "./helpers";

/** Digits of a work phase that has just begun: 25:00 counting down through 24:xx. */
const FRESH_WORK_DIGITS = /^2[45]:[0-5]\d$/;

test("starts a session, shows it ticking on the timer overlay, and stops it", async ({
  page,
  context,
}) => {
  // Start runs a short "starting" countdown (5s by default) before the work phase, and the
  // overlay is a second page: more than the default 30s budget.
  test.setTimeout(60_000);
  await signIn(page);
  await page.goto("/dashboard");

  // Idempotent: a retry, or an earlier run that stopped partway, can leave a session
  // running, and the Start button only exists while the timer is idle.
  const start = page.getByRole("button", { name: "Start", exact: true });
  const stop = page.getByRole("button", { name: "Stop timer" });
  await expect(start.or(stop)).toBeVisible();
  if (await stop.isVisible()) {
    await stop.click();
    await confirmDialog(page, "Stop timer");
    await expect(start).toBeVisible();
  }

  await start.click();

  // The live region announces the phase; it reads the work phase once the starting
  // countdown has run out and the dashboard poll has picked the change up.
  const announcement = page.getByRole("status").filter({ hasText: "Timer:" });
  await expect(announcement).toHaveText(`Timer: ${DEFAULT_PHASE_LABELS.work}`, {
    timeout: 20_000,
  });
  await expect(page.getByRole("img", { name: "Pomodoro 1 of 4" })).toBeVisible();
  await expect(page.getByText(FRESH_WORK_DIGITS)).toBeVisible();

  // The overlay polls the api directly with its token and counts down locally between polls.
  const overlayUrl = await revealSecretUrl(page, "Timer overlay");
  const overlay = await context.newPage();
  await overlay.goto(overlayUrl);
  await expect(overlay.getByText(DEFAULT_PHASE_LABELS.work)).toBeVisible();
  const digits = overlay.getByText(FRESH_WORK_DIGITS);
  await expect(digits).toBeVisible();
  await expect(overlay.getByText("1/4")).toBeVisible();

  // Sampled a little over a second apart, the digits must have moved on.
  const sample = (await digits.textContent()) ?? "";
  expect(sample).toMatch(FRESH_WORK_DIGITS);
  await overlay.waitForTimeout(1500);
  await expect(digits).not.toHaveText(sample);
  await overlay.close();

  await stop.click();
  await confirmDialog(page, "Stop timer");
  await expect(start).toBeVisible();
});

/**
 * Show hours has no dashboard control yet; the owner sets it through the same `/rpc` proxy
 * the dashboard uses (session cookie, JSON body).
 */
async function setShowHours(page: Page, showHours: boolean): Promise<void> {
  const res = await page.request.post("/rpc/config.updateTimerConfig", {
    headers: { "content-type": "application/json" },
    data: { showHours },
  });
  expect(res.ok(), `config.updateTimerConfig answered ${res.status()}`).toBe(true);
}

/** Save the Idle phase label in the Theme Center (a no-op when it already reads `text`). */
async function setIdleLabel(page: Page, text: string): Promise<void> {
  await page.goto("/dashboard/styles");
  await page.getByRole("tab", { name: "Phase labels" }).click();
  const idle = page.getByLabel("Idle", { exact: true });
  if ((await idle.inputValue()) === text) return;
  await idle.fill(text);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Styles saved")).toBeVisible();
}

test("keeps the overlay's text inside the progress ring, with and without hours", async ({
  page,
  context,
}) => {
  test.setTimeout(60_000);
  await signIn(page);
  await page.goto("/dashboard");
  const overlayUrl = await revealSecretUrl(page, "Timer overlay");
  const overlay = await context.newPage();
  // Every preset shares the default frame and ring geometry. The timer is idle here (the
  // test above stops it), so the overlay shows the idle label over the full work length.
  const { dimensions, ring } = DEFAULT_TIMER_STYLES;
  const inset = ring.width + ring.gap;
  // The longest default label ("Gathering the Pack") as the idle one: at its configured
  // size it is wider than the ring, so it must be shrunk to fit, not wrapped or clipped.
  const longLabel = DEFAULT_PHASE_LABELS.starting;
  await setIdleLabel(page, longLabel);

  try {
    for (const showHours of [false, true]) {
      await setShowHours(page, showHours);
      await overlay.goto(overlayUrl);
      const clock = overlay.getByText(showHours ? /^\d{2}:\d{2}:\d{2}$/ : /^\d{2}:\d{2}$/);
      await expect(clock).toBeVisible();
      const ringBox = await overlay.getByRole("img", { name: "Timer progress ring" }).boundingBox();
      if (!ringBox) throw new Error("the progress ring has no box");
      // The overlay scales the frame to the window, and the ring's inner edge with it.
      const scale = ringBox.width / Number.parseFloat(dimensions.width);
      const inner = {
        left: ringBox.x + inset * scale,
        right: ringBox.x + ringBox.width - inset * scale,
        top: ringBox.y + inset * scale,
        bottom: ringBox.y + ringBox.height - inset * scale,
      };
      const label = overlay.getByText(longLabel, { exact: true });
      for (const line of [clock, label]) {
        const box = await line.boundingBox();
        if (!box) throw new Error("a text line has no box");
        const where = `"${await line.textContent()}" (hours ${showHours ? "on" : "off"})`;
        expect(box.x, `${where} left edge`).toBeGreaterThanOrEqual(inner.left);
        expect(box.x + box.width, `${where} right edge`).toBeLessThanOrEqual(inner.right);
        expect(box.y, `${where} top edge`).toBeGreaterThanOrEqual(inner.top);
        expect(box.y + box.height, `${where} bottom edge`).toBeLessThanOrEqual(inner.bottom);
      }
    }
  } finally {
    await setShowHours(page, false);
    await overlay.close();
    await setIdleLabel(page, DEFAULT_PHASE_LABELS.idle);
  }
});
