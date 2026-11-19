import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

/**
 * Reference screenshots of every view, two themes × two widths (desktop and phone projects), the
 * same way as the pattern page: a baseline per platform, a platform without one skips.
 * `README_SHOTS=1` also writes the pictures the README shows (desktop project only).
 */
const VIEWS = [
  { name: "overview", path: "" },
  { name: "films", path: "films/" },
  { name: "film", path: "films/2026-01-18-towels-rolled-vs-folded-F5/?t=420" },
  { name: "checks", path: "checks/" },
  { name: "costs", path: "costs/" },
  { name: "about", path: "about/" },
] as const;

for (const v of VIEWS)
  for (const scheme of ["light", "dark"] as const) {
    test(`${v.name} looks as recorded @visual (${scheme})`, async ({ page }, info) => {
      const file = info.snapshotPath(`${v.name}-${scheme}.png`);
      test.skip(!fs.existsSync(file) && info.config.updateSnapshots === "none", `no ${process.platform} baseline`);
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await page.goto(v.path, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveScreenshot(`${v.name}-${scheme}.png`, { fullPage: true, animations: "disabled" });
    });
  }

test("README pictures", async ({ page, isMobile }) => {
  test.skip(!process.env.README_SHOTS || isMobile, "set README_SHOTS=1 to write docs/screenshots");
  const dir = path.resolve(import.meta.dirname, "../../docs/screenshots");
  fs.mkdirSync(dir, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 860 });
  for (const [name, url, scheme] of [
    ["overview", "", "light"],
    ["film", "films/2026-01-18-towels-rolled-vs-folded-F5/?t=420", "light"],
    ["checks", "checks/", "light"],
    ["films-sheet-dark", "films/?view=sheet", "dark"],
  ] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    if (name === "film") await page.getByTestId("timeline").scrollIntoViewIfNeeded();
    if (name === "checks") await page.getByTestId("matrix").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(dir, `${name}.png`) });
  }
});
