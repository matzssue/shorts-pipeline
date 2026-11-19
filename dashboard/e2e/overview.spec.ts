import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const WEEK = "?from=2026-02-09&to=2026-02-15";

/** Text of every section, to see which ones a range change touched. */
async function sections(page: Page) {
  const t = (id: string) => page.getByTestId(id).innerText();
  return {
    summary: await t("range-summary"),
    lead: await t("lead"),
    stages: await t("stages"),
    starts: await t("starts"),
    recent: await t("recent"),
    durations: await t("durations"),
    accounts: await t("accounts"),
  };
}

const num = (s: string) => Number(s.replace(/[^\d]/g, ""));

test("changing the range updates the address and every section", async ({ page }) => {
  await page.goto("");
  await expect(page.getByRole("link", { name: "Whole season" })).toHaveAttribute("aria-current", "true");
  const before = await sections(page);

  await page.getByRole("link", { name: "Last 7 days" }).click();
  await expect(page).toHaveURL(new RegExp(`/shorts-pipeline/\\${WEEK}$`));
  await expect(page.getByRole("link", { name: "Last 7 days" })).toHaveAttribute("aria-current", "true");
  await expect(page.getByTestId("range-summary")).toContainText("9 Feb – 15 Feb 2026 · 7 days");
  const after = await sections(page);
  for (const k of Object.keys(before) as (keyof typeof before)[]) expect(after[k], k).not.toBe(before[k]);

  // the link reproduces the view
  await page.goto(WEEK);
  expect(await sections(page)).toEqual(after);
  await page.getByRole("link", { name: "Whole season" }).click();
  await expect(page).toHaveURL(/\/shorts-pipeline\/$/);
  expect(await sections(page)).toEqual(before);
});

test("typed dates set the range", async ({ page }) => {
  await page.goto("");
  await page.getByLabel("From", { exact: true }).fill("2026-02-01");
  await expect(page).toHaveURL(/\?from=2026-02-01&to=2026-02-15$/);
  await page.getByLabel("To", { exact: true }).fill("2026-02-07");
  await expect(page).toHaveURL(/\?from=2026-02-01&to=2026-02-07$/);
  await expect(page.getByTestId("range-summary")).toContainText("1 Feb – 7 Feb 2026 · 7 days");
});

test("dragging across the ruler picks days", async ({ page, isMobile }) => {
  test.skip(isMobile, "dragging is checked with a mouse");
  await page.goto("");
  const ruler = page.getByRole("img", { name: /^Publications day by day/ });
  const box = (await ruler.boundingBox())!;
  const y = box.y + 8;
  await page.mouse.move(box.x + box.width * 0.5, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, y, { steps: 5 });
  await page.mouse.up();
  await expect(page).toHaveURL(/\?from=2026-01-2\d&to=2026-02-0\d$/);
});

test("a range with nothing published says so and keeps empty axes", async ({ page }) => {
  await page.goto("?from=2025-06-01&to=2025-06-30");
  await expect(page.getByTestId("lead")).toHaveText("In 30 days nothing was published.");
  await expect(page.getByTestId("starts").getByText("No video published in this range")).toHaveCount(2);
  await expect(page.getByTestId("recent")).toContainText("No video in this range.");
  await expect(page.getByTestId("qa")).toContainText("QA flagged nothing in this range.");
});

test("a broken address falls back to the whole season", async ({ page }) => {
  await page.goto("?from=soon&to=2026-02-30");
  await expect(page.getByRole("link", { name: "Whole season" })).toHaveAttribute("aria-current", "true");
});

test("the highlighted number agrees with the accounts table", async ({ page }) => {
  for (const q of ["", WEEK]) {
    await page.goto(q);
    const views = num((await page.getByTestId("lead").locator("mark").innerText()) ?? "");
    const cells = await page.getByTestId("accounts").locator("tbody tr td:nth-of-type(4)").allInnerTexts();
    expect(cells.reduce((s, c) => s + num(c), 0), q || "season").toBe(views);
  }
});

test("recent videos: a table on wide screens, a list on a phone", async ({ page, isMobile }) => {
  await page.goto("");
  const recent = page.getByTestId("recent");
  await expect(recent.locator("table.films-t")).toBeVisible({ visible: !isMobile });
  await expect(recent.locator("ol.films-c")).toBeVisible({ visible: isMobile });
  await expect(recent.locator(isMobile ? "ol.films-c > li" : "table.films-t tbody tr")).toHaveCount(8);
});

test("a range passes axe in both themes", async ({ page }) => {
  await page.goto(WEEK);
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(r.violations, scheme).toEqual([]);
  }
});

test("without JavaScript: the whole season, no range controls", async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(WEEK);
  await expect(page.getByTestId("range-summary")).toContainText("5 Jan – 15 Feb 2026 · 6 weeks");
  await expect(page.getByTestId("lead")).toContainText("from 19 cards");
  await expect(page.getByRole("link", { name: "Last 7 days" })).toHaveCount(0);
  await expect(page.getByTestId("starts").locator("path.g-med")).toHaveCount(2);
  await ctx.close();
});
