import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Titles of the visible videos, in order (table on desktop, list on a phone, frames in the sheet). */
const titles = (page: Page) => page.locator(".ftable tbody .f-title:visible, .flist .f-title:visible, .sheet .f-title:visible").allInnerTexts();
const count = (page: Page) => page.getByTestId("films-count");

test("filters and sort live in the address and come back from a link", async ({ page }) => {
  await page.goto("films/");
  await expect(count(page)).toHaveText("18 videos");
  await page.getByRole("combobox", { name: "Channel" }).selectOption("a");
  await page.getByRole("combobox", { name: "QA" }).selectOption("ok");
  await page.getByRole("combobox", { name: "Sort" }).selectOption({ label: "Most viewed" });
  await expect(page).toHaveURL(/\/films\/\?channel=a&qa=ok&sort=views&dir=desc$/);
  const shown = await titles(page);
  expect(shown.length).toBeGreaterThan(1);
  expect(shown.length).toBeLessThan(18);
  await expect(count(page)).toHaveText(`${shown.length} of 18 videos`);

  const url = page.url();
  await page.goto("films/");
  await page.goto(url);
  expect(await titles(page)).toEqual(shown);
  await expect(page.getByRole("combobox", { name: "Channel" })).toHaveValue("a");
  await expect(page.getByRole("combobox", { name: "QA" })).toHaveValue("ok");
});

test("a column header sorts, says so, and turns the order around on a second press", async ({ page, isMobile }) => {
  test.skip(isMobile, "the phone list sorts with the Sort control");
  await page.goto("films/");
  const head = page.getByRole("columnheader", { name: "Views" });
  await head.getByRole("button").focus();
  await page.keyboard.press("Enter");
  await expect(head).toHaveAttribute("aria-sort", "descending");
  await expect(page).toHaveURL(/sort=views&dir=desc$/);
  await page.keyboard.press("Enter");
  await expect(head).toHaveAttribute("aria-sort", "ascending");
  await expect(page).toHaveURL(/sort=views&dir=asc$/);
  await expect(page.getByRole("combobox", { name: "Sort" })).toHaveValue("views:asc");
});

test("works from the keyboard: search, pick a view, clear", async ({ page }) => {
  await page.goto("films/");
  await page.getByRole("searchbox", { name: "Title" }).focus();
  await page.keyboard.type("drawer");
  await expect(page).toHaveURL(/\?q=drawer$/);
  const found = await titles(page);
  expect(found.length).toBeGreaterThan(0);
  for (const t of found) expect(t.toLowerCase()).toContain("drawer");

  await page.getByRole("button", { name: "Contact sheet" }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Contact sheet" })).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/\?q=drawer&view=sheet$/);
  await expect(page.getByTestId("sheet")).toBeVisible();

  await page.getByRole("link", { name: "Clear filters" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/films\/\?view=sheet$/);
  await expect(count(page)).toHaveText("18 videos");
});

test("no match: says so and offers to clear", async ({ page }) => {
  await page.goto("films/?q=zzzz-nothing");
  await expect(page.getByTestId("films-empty")).toContainText("No video matches the filters.");
  await page.getByTestId("films-empty").getByRole("link", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/films\/$/);
  await expect(count(page)).toHaveText("18 videos");
});

test("columns can be switched off and the choice is in the link", async ({ page, isMobile }) => {
  test.skip(isMobile, "columns belong to the wide table");
  await page.goto("films/");
  await page.locator("summary", { hasText: "Columns" }).click();
  await page.getByRole("checkbox", { name: "QA" }).uncheck();
  await page.getByRole("checkbox", { name: "Characters" }).check();
  await expect(page).toHaveURL(/cols=released%2Cformat%2Clength%2Cyt%2Cig%2Cwatched%2Cchars$/);
  await expect(page.getByRole("columnheader", { name: "QA" })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "Characters" })).toBeVisible();
});

test("the contact sheet groups frames into weeks", async ({ page }) => {
  await page.goto("films/?view=sheet&dir=asc&sort=number");
  const strips = page.getByTestId("sheet").getByRole("heading", { level: 2 });
  await expect(strips.first()).toHaveText("W1 · 5 Jan");
  expect(await page.locator(".sheet li").count()).toBe(18);
  // a video without a render is an empty frame
  expect(await page.locator(".sheet .frame.none").count()).toBe(2);
});

test("a very long title does not break the layout", async ({ page }) => {
  const long = "Supercalifragilisticexpialidocious".repeat(6) + " and a title that goes on and on " + "word ".repeat(30);
  for (const view of ["", "?view=sheet"]) {
    await page.goto(`films/${view}`);
    await page.locator(".f-title:visible").first().evaluate((el, text) => (el.textContent = text), long);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, view || "table").toBeLessThanOrEqual(0);
  }
});

test("passes axe in both themes, table and contact sheet, with filters open", async ({ page }) => {
  for (const view of ["films/?channel=b", "films/?view=sheet"]) {
    await page.goto(view);
    if (!view.includes("sheet")) await page.locator("summary", { hasText: "Columns" }).click();
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(r.violations, `${view} ${scheme}`).toEqual([]);
    }
  }
});

test("without JavaScript: every video, no filter bar", async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto("films/?channel=a");
  await expect(page.getByTestId("films-count")).toHaveText("18 videos");
  await expect(page.getByRole("search")).toHaveCount(0);
  await ctx.close();
});
