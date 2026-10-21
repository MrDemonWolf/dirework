import { expect, test } from "@playwright/test";

// The generated design tokens reach the built bundle: the palette variables are
// set, and the header row is exactly `--spacing-header` (h-header) tall.
test("design tokens resolve in the built app", async ({ page }) => {
  await page.goto("/");
  const banner = page.getByRole("banner");
  await expect(banner).toBeVisible();

  const { primary, header } = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const probe = document.createElement("div");
    probe.style.height = "var(--spacing-header)";
    document.body.appendChild(probe);
    const header = probe.getBoundingClientRect().height;
    probe.remove();
    return { primary: root.getPropertyValue("--primary").trim(), header };
  });
  expect(primary).not.toBe("");
  expect(header).toBe(56);

  const row = await banner.locator(":scope > div").first().boundingBox();
  expect(row?.height).toBe(header);
});
