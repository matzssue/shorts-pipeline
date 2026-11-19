import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

/*
 * The built site (out/) carries only the mock: every address in the pages and their data points to
 * example.com, the site itself or its repository, and no platform domain appears anywhere.
 */

const OUT = path.resolve(import.meta.dirname, "../out");
const files = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const all = files(OUT);
const host = (u?: string) => (u ? new URL(u).hostname : undefined);
const allowed = new Set(["example.com", host(process.env.DASHBOARD_SITE_URL), host(process.env.DASHBOARD_REPO_URL)].filter(Boolean));

test("pages and their data link only to example.com, the site and its repository", () => {
  const bad: string[] = [];
  for (const f of all.filter((x) => /\.(html|txt|json|xml)$/.test(x))) {
    for (const u of fs.readFileSync(f, "utf8").match(/https?:\/\/[^\s"'<>)\\]+/g) ?? []) {
      const h = new URL(u).hostname;
      if (!allowed.has(h)) bad.push(`${path.relative(OUT, f)}: ${u}`);
    }
  }
  expect(bad).toEqual([]);
});

test("no platform domain anywhere in the build", () => {
  const platforms = /\b(youtube\.com|youtu\.be|instagram\.com|tiktok\.com|facebook\.com|elevenlabs\.io)\b/i;
  const bad = all.filter((f) => !/\.(png|woff2?|ico)$/.test(f) && platforms.test(fs.readFileSync(f, "utf8"))).map((f) => path.relative(OUT, f));
  expect(bad).toEqual([]);
});
