import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const VIEWS = [
  { path: "", nav: "Overview", h1: "Overview" },
  // the Films item carries the number of videos read from the content directory
  { path: "films/", nav: "Films 18", h1: "Films" },
  { path: "checks/", nav: "Checks", h1: "Checks" },
  { path: "costs/", nav: "Costs", h1: "Costs" },
  { path: "about/", nav: "About the data", h1: "About the data" },
] as const;

const axe = (page: Page) => new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();

test.describe("every view", () => {
  for (const v of VIEWS) {
    test(`${v.nav}: loads under the base path, marks its nav item, passes axe in both themes`, async ({ page }) => {
      const res = await page.goto(v.path);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: v.h1 })).toBeVisible();
      const nav = page.getByRole("navigation", { name: "Views" });
      await expect(nav.getByRole("link", { name: v.nav, exact: true })).toHaveAttribute("aria-current", "page");
      await expect(nav.locator("[aria-current]")).toHaveCount(1);

      for (const scheme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: scheme });
        expect((await axe(page)).violations, `${scheme} theme`).toEqual([]);
      }
    });

    test(`${v.nav}: no horizontal page scroll`, async ({ page }) => {
      await page.goto(v.path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

test("navigation moves between views", async ({ page }) => {
  await page.goto("");
  await page.getByRole("link", { name: "Costs", exact: true }).click();
  await expect(page).toHaveURL(/\/shorts-pipeline\/costs\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Costs" })).toBeVisible();
});

test("theme toggle cycles auto → light → dark and survives a reload", async ({ page }) => {
  await page.goto("");
  const toggle = page.getByRole("button", { name: /^Theme:/ });
  await expect(toggle).toHaveText("Theme: auto");
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(24, 25, 23)");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(toggle).toHaveText("Theme: dark");
  await toggle.click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /./);
});

test("unknown address shows the 404 page", async ({ page }) => {
  const res = await page.goto("no-such-view/");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "Nothing here" })).toBeVisible();
});

test("the page never talks to another host (fonts are self-hosted)", async ({ page }) => {
  const foreign: string[] = [];
  page.on("request", (r) => {
    const host = new URL(r.url()).hostname;
    if (host !== "localhost") foreign.push(r.url());
  });
  for (const v of VIEWS) await page.goto(v.path, { waitUntil: "networkidle" });
  expect(foreign).toEqual([]);
});

test("fonts are loaded", async ({ page }) => {
  await page.goto("", { waitUntil: "networkidle" });
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family);
  });
  expect(loaded.some((f) => /archivo/i.test(f))).toBe(true);
});
