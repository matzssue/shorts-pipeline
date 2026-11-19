import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const axe = (page: import("@playwright/test").Page) =>
  new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();

test("patterns: passes axe in both themes, also with the tables open and a readout shown", async ({ page }) => {
  await page.goto("patterns/");
  await expect(page.getByRole("heading", { level: 1, name: "Patterns" })).toBeVisible();
  for (const s of await page.locator("details.twin summary").all()) await s.click();
  await page.getByRole("slider").first().focus();
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    expect((await axe(page)).violations, `${scheme} theme`).toEqual([]);
  }
});

test("patterns: no horizontal page scroll", async ({ page }) => {
  await page.goto("patterns/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("crosshair: keyboard moves it day by day and says the values", async ({ page }) => {
  await page.goto("patterns/");
  const slider = page.getByRole("slider", { name: "YouTube Shorts: day" }).first();
  await slider.focus();
  await expect(slider).toHaveAttribute("aria-valuenow", "14");
  await expect(page.locator(".xhair-tip").first()).toContainText("Day 14");
  await slider.press("Home");
  await expect(slider).toHaveAttribute("aria-valuenow", "0");
  await slider.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuenow", "1");
  await expect(slider).toHaveAttribute("aria-valuetext", /^Day 1\. median [\d,]+, \d\d [\d,]+, videos \d+$/);
  await slider.press("End");
  await expect(slider).toHaveAttribute("aria-valuenow", "14");
  await slider.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuenow", "14");
});

test("crosshair: the pointer snaps it to the nearest day", async ({ page, isMobile }) => {
  test.skip(isMobile, "hover needs a mouse");
  await page.goto("patterns/");
  const area = page.locator(".xhair").first();
  const box = (await area.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.52, box.y + box.height / 2);
  await expect(page.locator(".xhair-tip").first()).toContainText("Day 7");
  await page.mouse.move(box.x + box.width + 40, box.y - 40);
  await expect(page.locator(".xhair-tip")).toHaveCount(0);
});

test("a dot shows its value on keyboard focus, without JavaScript", async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto("patterns/");
  const dot = page.locator(".rng .d").first();
  await dot.focus();
  const tip = await dot.evaluate((el) => getComputedStyle(el, "::after").content);
  expect(tip).toMatch(/s"$/);
  expect(tip).toBe(JSON.stringify(await dot.getAttribute("data-tip")));
  await ctx.close();
});

test("charts read the same without JavaScript: lines, labels, axes and the table twin", async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto("patterns/");
  const yt = page.locator("figure").filter({ has: page.getByRole("heading", { name: /YouTube Shorts/ }) }).first();
  await expect(yt.locator("path.g-med")).toHaveCount(1);
  await expect(yt.locator("path.g-top")).toHaveCount(1);
  expect(await yt.locator("path.g-ctx").count()).toBeGreaterThan(5);
  await expect(yt.locator(".tag.hl")).toHaveText(/^\d\d · [\d,]+$/);
  await expect(yt.locator(".tag:not(.hl)")).toHaveText(/^median [\d,]+$/);
  await expect(yt.getByRole("img")).toHaveAttribute("aria-label", /Median on day 14: [\d,]+\. Best start: video \d\d, [\d,]+ views\./);
  // the crosshair is an addition, so it is absent here
  await expect(page.locator(".xhair")).toHaveCount(0);

  const twin = page.locator("details.twin").first();
  await twin.locator("summary").click();
  await expect(twin.getByRole("table")).toBeVisible();
  await expect(twin.locator("tbody tr")).toHaveCount(15);
  await ctx.close();
});

test("the table twin holds the numbers the chart labels show", async ({ page }) => {
  await page.goto("patterns/");
  const yt = page.locator("figure").first();
  const median = (await yt.locator(".tag:not(.hl)").textContent())!.replace("median ", "");
  const best = (await yt.locator(".tag.hl").textContent())!.split(" · ")[1];
  const twin = page.locator("details.twin").first();
  await twin.locator("summary").click();
  const day14 = twin.locator("tbody tr").last();
  await expect(day14.locator("td").nth(0)).toHaveText(median);
  await expect(day14.locator("td").nth(1)).toHaveText(best!);
});

test("edge cases: empty range says so, one video keeps its line without a median", async ({ page }) => {
  await page.goto("patterns/");
  const edge = page.locator("section").filter({ has: page.getByRole("heading", { name: "Edge cases" }) });
  const [empty, one] = [edge.locator("figure").nth(0), edge.locator("figure").nth(1)];
  await expect(empty.getByText("No video published in this range")).toBeVisible();
  await expect(empty.locator("path:not(.g-grid)")).toHaveCount(0);
  await expect(one.locator("path.g-med")).toHaveCount(1);
  await expect(one.locator("path.g-ctx")).toHaveCount(0);
  await expect(one.locator(".tag")).toHaveText(/^\d\d$/);
});

test("limit meter states the overrun in words", async ({ page }) => {
  await page.goto("patterns/");
  const meters = page.locator(".limit-track");
  await expect(meters.nth(0)).toHaveAttribute("aria-valuetext", /^[\d,]+ of [\d,]+ characters · \d+%$/);
  await expect(meters.nth(1)).toHaveAttribute("aria-valuetext", /over the limit$/);
});

/**
 * Reference screenshots of the pattern page, two themes × two widths (desktop and phone projects).
 * Fonts render differently per OS, so a baseline is kept per platform; a platform without one skips.
 */
for (const scheme of ["light", "dark"] as const) {
  test(`patterns look as recorded @visual (${scheme})`, async ({ page }, info) => {
    const file = info.snapshotPath(`patterns-${scheme}.png`);
    const { existsSync } = await import("node:fs");
    test.skip(!existsSync(file) && info.config.updateSnapshots === "none", `no ${process.platform} baseline`);
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.goto("patterns/", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`patterns-${scheme}.png`, { fullPage: true, animations: "disabled" });
  });
}
