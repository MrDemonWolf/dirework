import { AxeBuilder } from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";

import { API_ORIGIN, DEV_LOGIN_SECRET } from "../src/env";

/**
 * WCAG 2.0, 2.1 and 2.2, levels A and AA — the rule tags axe maps to those success criteria.
 * 2.2 AA adds `target-size` (2.5.8, 24×24 CSS px or the spacing exception).
 */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

export type Theme = "dark" | "light";

/**
 * Pin the app theme for every page this context loads, the way a visitor's choice is kept:
 * next-themes' `theme` key in localStorage, which the inline head script applies before paint.
 */
export async function pinTheme(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript((value) => {
    try {
      localStorage.setItem("theme", value);
    } catch {}
  }, theme);
}

/**
 * Scan the current page and fail on any serious or critical violation. The full axe result
 * (every violation, pass, and incomplete check) is attached to the test report, so a failure
 * can be read in CI without rerunning the scan; moderate and minor findings are listed as
 * annotations so they stay visible without failing the run. `theme` is the
 * palette the page must show before the scan (default dark, the app default). Used by
 * 80-a11y and the specs whose screens need seeded state (00-first-run, 27-bot-page-handoff).
 */
export async function expectNoSeriousViolations(
  page: Page,
  name: string,
  { theme = "dark" }: { theme?: Theme | "none" } = {},
): Promise<void> {
  // The theme class is applied by a script after the HTML streams in; until then the page
  // shows the light palette, and a scan during that window measures the wrong colors.
  // Overlays and the bot widget are transparent and theme-free (`none`).
  if (theme !== "none") {
    await page.waitForFunction((t) => document.documentElement.classList.contains(t), theme);
  }
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  await test.info().attach(`axe-${name}.json`, {
    body: JSON.stringify(results, null, 2),
    contentType: "application/json",
  });

  const summarize = (violation: (typeof results.violations)[number]) =>
    `${violation.id} (${violation.impact}): ${violation.help} — ${violation.nodes
      .map((node) => node.target.join(" "))
      .join(", ")}`;
  for (const violation of results.violations) {
    if (violation.impact === "serious" || violation.impact === "critical") continue;
    const line = `${name}: ${summarize(violation)}`;
    test.info().annotations.push({ type: "axe (non-blocking)", description: line });
  }

  const blocking = results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map(summarize);
  expect(blocking, `axe violations on ${name}`).toEqual([]);
}

/**
 * Give the instance a fake connected bot account (`seed: true`) or remove it, through the e2e
 * api worker's test-only `/__e2e/bot-account` knob (src/api-entry.ts). Specs that seed one
 * remove it afterwards: the others expect no bot account.
 */
export async function setBotAccount(page: Page, seed: boolean): Promise<void> {
  const res = await page.request.fetch(`${API_ORIGIN}/__e2e/bot-account`, {
    method: seed ? "POST" : "DELETE",
  });
  expect(res.status(), "seed the bot account").toBe(204);
}

/**
 * Free the one-bot-page chat lease (the api worker's test-only `/__e2e/bot-lease` knob), so a
 * spec that opens bot pages starts with none running, even right after an earlier attempt.
 */
export async function clearBotLease(page: Page): Promise<void> {
  const res = await page.request.fetch(`${API_ORIGIN}/__e2e/bot-lease`, { method: "DELETE" });
  expect(res.status(), "clear the bot lease").toBe(204);
}

/**
 * Mint an owner session through the DEV_LOGIN bypass. The request goes through the web
 * origin's /api/auth proxy, so the session cookie lands on the web origin exactly like a
 * real sign-in; `page.request` shares the page's cookie jar. On the fresh e2e database the
 * first call creates the owner, which claims the instance (00-first-run.spec.ts checks the
 * claim page before that happens); every later call signs in that same owner.
 */
export async function signIn(page: Page): Promise<void> {
  const res = await page.request.post("/api/auth/dev-login", {
    headers: { "content-type": "application/json", "x-dev-login-secret": DEV_LOGIN_SECRET },
    data: {},
  });
  expect(res.ok(), `dev-login answered ${res.status()}`).toBe(true);
}

/**
 * Reveal a masked URL row (SecretUrlRow) by its label and return the full URL. Show is a
 * toggle, and the row reveals itself after a reset, so Show is only pressed while the URL
 * is still hidden.
 */
export async function revealSecretUrl(page: Page, label: string): Promise<string> {
  const show = page.getByRole("button", { name: `Show ${label} URL` });
  if ((await show.getAttribute("aria-pressed")) !== "true") {
    await show.click();
  }
  // The row's Show/Copy/Reset buttons carry the same words in their labels; the revealed
  // value is the one textbox named exactly "<label> URL".
  return page.getByRole("textbox", { name: `${label} URL`, exact: true }).inputValue();
}

const HYDRATION_MESSAGE = /hydrat|Switched to client rendering|did not match/i;
const pageProblems = new WeakMap<Page, string[]>();

/**
 * Start collecting what would mean a page did not hydrate cleanly: every uncaught page error
 * (an inline script throwing, a crashed render) and every console error that mentions
 * hydration. Call it before `page.goto`; `expectNoHydrationErrors` asserts on the result.
 */
export function watchHydration(page: Page): void {
  if (pageProblems.has(page)) return;
  const problems: string[] = [];
  pageProblems.set(page, problems);
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && HYDRATION_MESSAGE.test(message.text())) {
      problems.push(`console: ${message.text()}`);
    }
  });
}

/**
 * Wait until React has hydrated the page, so the next fill or click reaches a React handler.
 * The server HTML already carries the editors with their saved values (the routes prefetch
 * their data), so a locator can resolve — and type — before React attaches: that input event
 * is lost, and a controlled value React then writes resets the caret, so a `fill` straddling
 * it appends instead of replacing. Call it after `page.goto` and before the first edit.
 */
export async function waitForHydration(page: Page): Promise<void> {
  // React's streamed segments (`<div hidden id="S:n">`) are gone once their reveal ran.
  await page.waitForFunction(() => !document.querySelector('body > div[hidden][id^="S:"]'));
  // The header's theme switch only mounts in an effect (a placeholder stands in before), so
  // its presence means the effects of the hydrated tree have run.
  await expect(page.getByRole("switch", { name: "Toggle dark mode" })).toBeVisible();
}

/**
 * Assert the page hydrated its server HTML instead of throwing it away. A production React
 * build bails out of hydration SILENTLY when an update reaches a streamed Suspense boundary
 * before its reveal (it just client-renders the boundary), so the console alone can't catch
 * that: once every streamed segment has been revealed, each Base UI id inside <main> must
 * still be a server-generated useId (`_R_…`), never a client one (`_r_…`). A client-rendered
 * copy is also how the dashboard briefly existed twice in the DOM.
 */
export async function expectNoHydrationErrors(page: Page): Promise<void> {
  // The header's theme switch mounts in the same effect flush that used to trigger the
  // bail-out, so by then the outcome is decided.
  await waitForHydration(page);
  const clientIds = await page.evaluate(() =>
    [...document.querySelectorAll('main [id^="base-ui-"]')]
      .map((element) => element.id)
      .filter((id) => id.includes("_r_")),
  );
  expect(clientIds, "server-rendered <main> was client-rendered instead of hydrated").toEqual([]);
  expect(pageProblems.get(page) ?? [], "page errors or hydration warnings").toEqual([]);
}

/** Name of the function an init script calls in the page to report a CSP violation. */
const CSP_REPORTER = "__e2eCspViolation";
const cspReports = new WeakMap<Page, string[]>();

/**
 * Start collecting every Content-Security-Policy violation the page reports, in each of its
 * frames (the live preview's overlay iframe too) and across navigations: an init script hands
 * each `securitypolicyviolation` event to the test through an exposed function. Call it before
 * `page.goto`; `expectNoCspViolations` asserts there were none.
 *
 * One known report is prevented rather than filtered. While zod is still bundled into every
 * page, it checks once per page whether it may compile parsers by calling `Function("")`. The
 * policy has no 'unsafe-eval', so the call throws and zod parses without compiling, as it always
 * does under this policy, but the browser still reports a refused eval. zod's own `jitless`
 * setting skips that check. It is set before any page script runs, so any other refused eval
 * still fails (and if zod ever stops reading it, every watched page fails on a refused eval).
 */
export async function watchCsp(page: Page): Promise<void> {
  if (cspReports.has(page)) return;
  const reports: string[] = [];
  cspReports.set(page, reports);
  await page.exposeFunction(CSP_REPORTER, (line: string) => {
    reports.push(line);
  });
  await page.addInitScript((reporter) => {
    // zod adopts an existing `globalThis.__zod_globalConfig` as its config object.
    const zodHost = globalThis as { __zod_globalConfig?: { jitless?: boolean } };
    zodHost.__zod_globalConfig ??= { jitless: true };
    document.addEventListener("securitypolicyviolation", (event) => {
      const report = (window as unknown as Record<string, ((line: string) => void) | undefined>)[
        reporter
      ];
      // blockedURI is the refused URL, or "inline" / "eval" for code.
      report?.(`${event.effectiveDirective} refused ${event.blockedURI} on ${location.pathname}`);
    });
  }, CSP_REPORTER);
}

/** The violations `watchCsp` has collected on the page so far, oldest first. */
export function cspViolations(page: Page): string[] {
  const reports = cspReports.get(page);
  if (!reports) throw new Error("call watchCsp(page) before loading the page");
  return [...reports];
}

/**
 * Assert the page has refused nothing since `watchCsp`: no inline handler or script, style,
 * font, image, frame or connection outside the policy.
 */
export async function expectNoCspViolations(page: Page): Promise<void> {
  // The browser reports a violation from a queued task, and the report reaches the test
  // asynchronously: one timer round trip through the page lets a pending one land first.
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(cspViolations(page), "Content-Security-Policy violations").toEqual([]);
}

/** Press the named button in the open confirm dialog (ConfirmDialog renders an alertdialog). */
export async function confirmDialog(page: Page, label: string): Promise<void> {
  await page.getByRole("alertdialog").getByRole("button", { name: label, exact: true }).click();
}

/**
 * A task board row by its text. The text alone is ambiguous: the timer console's "Now" line
 * repeats the owner's active task.
 */
export function taskRow(page: Page, text: string): Locator {
  return page.getByRole("listitem").filter({ hasText: text });
}
