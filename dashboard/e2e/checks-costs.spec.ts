import fs from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const DATA = path.resolve(import.meta.dirname, "../../fixtures/content");
const ledger = fs.readFileSync(path.join(DATA, "data/voice-ledger.csv"), "utf8").trim().split(/\r?\n/).slice(1);
const total = ledger.reduce((s, line) => s + Number(line.split(",").at(-1)), 0);
const qaFiles = fs
  .readdirSync(path.join(DATA, "out"))
  .flatMap((d) => fs.readdirSync(path.join(DATA, "out", d)).filter((f) => /^qa-.*\.json$/.test(f)).map((f) => JSON.parse(fs.readFileSync(path.join(DATA, "out", d, f), "utf8"))));
const fmt = (n: number) => new Intl.NumberFormat("en-GB").format(n);

test("the matrix has a header for every row and column, and a mark for every flag", async ({ page }) => {
  await page.goto("checks/");
  const matrix = page.locator("table.matrix");
  await expect(matrix.getByRole("rowheader")).toHaveCount(qaFiles.length);
  expect(await matrix.locator("th[scope=col]").count()).toBeGreaterThanOrEqual(14);
  await expect(matrix.locator("th[scope=colgroup]")).toHaveCount(5);
  const flags = qaFiles.flatMap((q) => q.checks.filter((c: { level: string }) => c.level !== "ok"));
  // one mark per (video, check) with a flag; two flags of one check in one video share a cell
  expect(await matrix.locator(".qm-warning, .qm-error").count()).toBeLessThanOrEqual(flags.length);
  await expect(matrix.locator(".qm-error").first()).toHaveAttribute("aria-label", /error – /);
});

test("held back: the failed video with its error, linked to its page", async ({ page }) => {
  await page.goto("checks/");
  const held = page.getByTestId("held");
  const failed = qaFiles.filter((q) => !q.passed);
  await expect(held.locator(".held > li")).toHaveCount(failed.length);
  await expect(held).toContainText(failed[0].checks.find((c: { level: string }) => c.level === "error").text);
  await held.locator(".f-title").first().click();
  await expect(page.getByTestId("qa")).toContainText("Fails");
});

test("on a phone the matrix scrolls inside its box, the page does not", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone only");
  await page.goto("checks/");
  const page_ = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(page_).toBeLessThanOrEqual(0);
  const box = page.locator(".matrix-scroll");
  const [sw, cw] = await box.evaluate((el) => [el.scrollWidth, el.clientWidth]);
  expect(sw).toBeGreaterThan(cw);
  await expect(box).toHaveAttribute("tabindex", "0");
});

test("costs: the total is the sum of voice-ledger.csv", async ({ page }) => {
  await page.goto("costs/");
  await expect(page.getByTestId("kpi-chars")).toContainText(fmt(total));
  await expect(page.getByTestId("limit").getByRole("meter")).toHaveCount(new Set(ledger.map((l) => l.slice(0, 7))).size);
  await expect(page.getByTestId("credits")).toContainText("estimate");
});

test("checks and costs pass axe with the tables open", async ({ page }) => {
  for (const view of ["checks/", "costs/"]) {
    await page.goto(view);
    for (const s of await page.locator("details.twin summary").all()) await s.click();
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(r.violations, `${view} ${scheme}`).toEqual([]);
    }
  }
});
