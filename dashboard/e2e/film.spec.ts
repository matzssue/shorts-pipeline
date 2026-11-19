import fs from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const OUT = path.resolve(import.meta.dirname, "../../fixtures/content/out");
const ID = "2026-01-18-towels-rolled-vs-folded-F5";
type Compose = { scenes: { from: number; durationInFrames: number; headline: string; playbackRate: number }[]; words: { text: string; from: number; to: number }[]; durationInFrames: number };
/** The file the render reads – the preview is checked against it, not against the page's own data. */
const compose = JSON.parse(fs.readFileSync(path.join(OUT, ID, "compose-narrator-a.json"), "utf8")) as Compose;
const tc = (f: number) => `${Math.floor(f / 1800)}:${String(Math.floor(f / 30) % 60).padStart(2, "0")}:${String(f % 30).padStart(2, "0")}`;
const unrendered = fs.readdirSync(OUT).find((d) => !fs.readdirSync(path.join(OUT, d)).some((f) => f.startsWith("compose-")))!;

test("the preview shows what compose-*.json puts on screen at ?t=", async ({ page }) => {
  // the first word of every scene: headline of that scene, the caption line with that word on the accent box
  for (const s of compose.scenes) {
    const w = compose.words.find((x) => x.from >= s.from && x.from < s.from + s.durationInFrames);
    if (!w) continue;
    await page.goto(`films/${ID}/?t=${w.from}`);
    await expect(page.getByTestId("playhead")).toHaveAttribute("aria-valuenow", String(w.from));
    await expect(page.getByTestId("tc")).toHaveText(tc(w.from));
    if (s.headline) await expect(page.getByTestId("pv-headline")).toHaveText(s.headline);
    else await expect(page.getByTestId("pv-headline")).toHaveCount(0);
    await expect(page.getByTestId("pv-caption")).toContainText(w.text);
    await expect(page.locator(".pv-cc .on", { hasText: w.text })).toHaveCount(1);
  }
});

test("the playhead moves with the keyboard and writes ?t=", async ({ page }) => {
  await page.goto(`films/${ID}/`);
  const ph = page.getByTestId("playhead");
  await ph.focus();
  await page.keyboard.press("End");
  await expect(ph).toHaveAttribute("aria-valuenow", String(compose.durationInFrames - 1));
  await expect(page.locator(".edl tbody tr").last()).toHaveClass(/cur/);
  await page.keyboard.press("Home");
  await expect(ph).toHaveAttribute("aria-valuenow", "0");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowRight");
  await expect(ph).toHaveAttribute("aria-valuenow", "31");
  await expect(ph).toHaveAttribute("aria-valuetext", /^0:01:01, scene 1, video/);
  await expect(page).toHaveURL(/\?t=31$/);
  await page.reload();
  await expect(page.getByTestId("playhead")).toHaveAttribute("aria-valuenow", "31");
});

test("the playhead follows a click or a tap", async ({ page, isMobile }) => {
  await page.goto(`films/${ID}/`);
  const ph = page.getByTestId("playhead");
  await ph.scrollIntoViewIfNeeded();
  const box = (await ph.boundingBox())!;
  const x = box.x + box.width * 0.5;
  const y = box.y + box.height * 0.5;
  if (isMobile) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  const now = Number(await ph.getAttribute("aria-valuenow"));
  expect(Math.abs(now - compose.durationInFrames / 2)).toBeLessThan(compose.durationInFrames * 0.02);
  const scene = compose.scenes.findIndex((s) => now >= s.from && now < s.from + s.durationInFrames);
  await expect(page.locator(".edl tbody tr").nth(scene)).toHaveClass(/cur/);
});

test("the slowed clip and the average view are on the timeline", async ({ page }) => {
  await page.goto(`films/${ID}/`);
  const slow = compose.scenes.findIndex((s) => s.playbackRate < 1);
  expect(slow).toBeGreaterThanOrEqual(0);
  await expect(page.locator(".tk-v .clip").nth(slow)).toHaveClass(/slow/);
  await expect(page.locator(".tl-avg")).toContainText("average view");
});

test("a video without a render says so and still lists its scenes", async ({ page }) => {
  await page.goto(`films/${unrendered}/`);
  await expect(page.getByTestId("timeline")).toContainText("No render yet");
  await expect(page.getByTestId("playhead")).toHaveCount(0);
  expect(await page.locator(".edl tbody tr").count()).toBeGreaterThan(0);
});

test("titles in Films open the video's page", async ({ page }) => {
  await page.goto("films/");
  const first = page.locator(".f-title:visible").first();
  const title = await first.innerText();
  await first.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
});

test("fits a phone and passes axe in both themes", async ({ page }) => {
  for (const id of [ID, unrendered]) {
    await page.goto(`films/${id}/?t=${compose.durationInFrames - 1}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, id).toBeLessThanOrEqual(0);
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(r.violations, `${id} ${scheme}`).toEqual([]);
    }
  }
});

test("without JavaScript: the first frame, every section, no dead slider", async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(`films/${ID}/?t=300`);
  await expect(page.getByTestId("tc")).toHaveText("0:00:00");
  await expect(page.getByTestId("pv-headline")).toHaveText(compose.scenes[0]!.headline);
  await expect(page.getByRole("slider")).toHaveCount(0);
  for (const s of ["slate", "edl", "qa", "releases", "voice", "facts"]) await expect(page.getByTestId(s)).toBeVisible();
  await ctx.close();
});
