import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FLOW_CREDITS_PER_S_720P } from "@shorts/schema/video";
import { buildFilms } from "@/data/join";
import { loadCatalog } from "@/data/load";
import { checksPage, QA_COLUMNS, qaColumn } from "@/data/selectors/checks";
import { costsPage } from "@/data/selectors/costs";

const dir = path.resolve(import.meta.dirname, "../../fixtures/content");
const catalog = loadCatalog(dir);
const films = buildFilms(catalog);
const checks = checksPage(films);
const costs = costsPage(catalog, films);

/** Characters straight from the CSV, without the loader – the view must add up to the file. */
const ledgerChars = fs
  .readFileSync(path.join(dir, "data/voice-ledger.csv"), "utf8")
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .reduce((s, line) => s + Number(line.split(",").at(-1)), 0);

describe("checks", () => {
  it("knows every message QA writes", () => {
    expect(checks.unknown).toEqual([]);
    expect(qaColumn("a check added tomorrow")).toBeUndefined();
  });

  it("has the 13 checks that always run, plus the conditional ones that flagged", () => {
    expect(QA_COLUMNS.filter((c) => c.always)).toHaveLength(13);
    const keys = checks.columns.map((c) => c.key);
    for (const c of QA_COLUMNS.filter((x) => x.always)) expect(keys).toContain(c.key);
    for (const c of checks.columns.filter((x) => !x.always)) expect(checks.rows.some((r) => r.cells[c.key])).toBe(true);
  });

  it("one row per checked video; totals add up", () => {
    const t = checks.totals;
    expect(checks.rows).toHaveLength(films.filter((f) => f.qa).length);
    expect(t.clean + t.withWarnings + t.failed).toBe(t.checked);
    expect(t.checked + t.notChecked).toBe(films.length);
    expect(t.withWarnings).toBeGreaterThanOrEqual(5);
  });

  it("a cell carries the worst level of its messages", () => {
    for (const f of films.filter((x) => x.qa)) {
      const row = checks.rows.find((r) => r.id === f.id)!;
      for (const c of f.qa!.checks) {
        const cell = row.cells[qaColumn(c.text)!.key]!;
        expect(cell.texts).toContain(c.text);
        if (c.level === "error") expect(cell.level).toBe("error");
      }
    }
  });

  it("ranking and weeks count the same flags as the matrix", () => {
    for (const r of checks.ranking) {
      expect(r.warnings).toBe(checks.rows.filter((x) => x.cells[r.key]?.level === "warning").length);
      expect(r.errors).toBe(checks.rows.filter((x) => x.cells[r.key]?.level === "error").length);
    }
    expect(checks.weeks.reduce((s, w) => s + w.videos, 0)).toBe(checks.totals.checked);
    expect(checks.weeks.reduce((s, w) => s + w.flags, 0)).toBe(checks.rows.reduce((s, r) => s + r.warnings + r.errors, 0));
  });

  it("holds back exactly the videos that failed, with their error messages", () => {
    expect(checks.held.map((h) => h.id)).toEqual(checks.rows.filter((r) => !r.passed).map((r) => r.id));
    for (const h of checks.held) expect(h.errors.length).toBeGreaterThan(0);
  });
});

describe("costs", () => {
  it("characters add up to voice-ledger.csv, by video, by month and by narrator", () => {
    expect(costs.total).toBe(ledgerChars);
    expect(costs.perFilm.reduce((s, f) => s + f.full + f.takes, 0)).toBe(ledgerChars);
    expect(costs.months.reduce((s, m) => s + m.used, 0)).toBe(ledgerChars);
    expect(costs.narrators.reduce((s, n) => s + n.chars, 0)).toBe(ledgerChars);
  });

  it("counts retakes and cache hits apart", () => {
    expect(costs.takes).toBe(costs.perFilm.reduce((s, f) => s + f.takes, 0));
    expect(costs.cacheHits).toBe(costs.perFilm.reduce((s, f) => s + f.cached, 0));
    expect(costs.cacheHits).toBeGreaterThan(0);
  });

  it("reads the monthly limit from the config", () => {
    expect(costs.limit).toBe(catalog.config.voiceCharsPerMonth);
  });

  it("credits are seconds of video clips times the 720p rate", () => {
    for (const c of costs.credits) expect(c.credits).toBe(c.clipSeconds * FLOW_CREDITS_PER_S_720P);
  });

  it("characters per 1,000 views: published videos, lowest first", () => {
    const v = costs.perThousand.map((x) => x.value);
    expect(v).toEqual([...v].sort((a, b) => a - b));
    for (const x of costs.perThousand) expect(x.value).toBeCloseTo((x.chars / x.views) * 1000, 6);
  });
});
