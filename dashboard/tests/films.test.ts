import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildFilms } from "@/data/join";
import { loadCatalog } from "@/data/load";
import {
  applyQuery,
  DEFAULT_COLUMNS,
  DEFAULT_QUERY,
  filterOptions,
  isFiltered,
  parseQuery,
  qaState,
  toSearch,
  weeks,
  type FilmQuery,
  type FilmRow,
} from "@/data/selectors/filmQuery";
import { filmRows } from "@/data/selectors/films";

const catalog = loadCatalog(path.resolve(import.meta.dirname, "../../fixtures/content"));
const rows = filmRows(buildFilms(catalog), catalog);
const q = (patch: Partial<FilmQuery>): FilmQuery => ({ ...DEFAULT_QUERY, ...patch });
const params = (s: string) => new URLSearchParams(s);

describe("query in the address", () => {
  it("an empty address is the default view", () => {
    expect(parseQuery(params(""))).toEqual(DEFAULT_QUERY);
    expect(toSearch(DEFAULT_QUERY)).toBe("");
  });

  it("round-trips every setting", () => {
    const full = q({ q: "drawer", channel: "b", platform: "instagram", format: "F5", series: 2, narrator: "narrator-a", qa: "warning", sort: "views", dir: "asc", view: "sheet", cols: ["qa", "chars", "released"] });
    const s = toSearch(full);
    expect(s).toBe("?q=drawer&channel=b&platform=instagram&format=F5&narrator=narrator-a&qa=warning&series=2&sort=views&dir=asc&view=sheet&cols=released%2Cqa%2Cchars");
    expect(parseQuery(params(s))).toEqual({ ...full, cols: ["released", "qa", "chars"] });
  });

  it("drops what it does not know", () => {
    const p = parseQuery(params("?sort=price&dir=sideways&qa=great&series=-1&view=grid&cols=released,bogus"));
    expect(p).toEqual(q({ cols: ["released"] }));
  });

  it("an empty column list stays empty, a missing one is the default", () => {
    expect(parseQuery(params("?cols=")).cols).toEqual([]);
    expect(toSearch(q({ cols: [] }))).toBe("?cols=");
    expect(parseQuery(params("?q=x")).cols).toEqual([...DEFAULT_COLUMNS]);
  });

  it("knows when the list is filtered", () => {
    expect(isFiltered(DEFAULT_QUERY)).toBe(false);
    expect(isFiltered(q({ q: "  " }))).toBe(false);
    expect(isFiltered(q({ sort: "views" }))).toBe(false);
    expect(isFiltered(q({ series: 2 }))).toBe(true);
  });
});

describe("filters", () => {
  it("each filter keeps only matching videos", () => {
    expect(applyQuery(rows, q({ channel: "b" })).every((r) => r.channel === "b")).toBe(true);
    expect(applyQuery(rows, q({ format: "F1" })).map((r) => r.format)).toEqual(["F1"]);
    expect(applyQuery(rows, q({ series: 2 })).every((r) => r.series === 2)).toBe(true);
    expect(applyQuery(rows, q({ qa: "error" })).map((r) => r.stage)).toEqual(["qaFailed"]);
    expect(applyQuery(rows, q({ qa: "none" })).every((r) => !r.qa)).toBe(true);
    expect(applyQuery(rows, q({ platform: "tiktok" })).length).toBeGreaterThan(0);
  });

  it("filters add up to the whole list", () => {
    const byQa = (["ok", "warning", "error", "none"] as const).reduce((s, x) => s + applyQuery(rows, q({ qa: x })).length, 0);
    expect(byQa).toBe(rows.length);
  });

  it("title search ignores case and accents and also finds the folder name", () => {
    const one = rows[0]!;
    const word = one.title.split(" ")[0]!;
    expect(applyQuery(rows, q({ q: word.toUpperCase() }))).toContainEqual(one);
    const accent = { ...one, id: "x", title: "Café drawer" } as FilmRow;
    expect(applyQuery([accent], q({ q: "cafe" }))).toHaveLength(1);
    expect(applyQuery(rows, q({ q: one.folder.slice(0, 10) })).length).toBeGreaterThan(0);
  });

  it("offers only values that have videos", () => {
    const o = filterOptions(rows);
    expect(o.channels).toEqual(["a", "b"]);
    expect(o.formats).toEqual(["F1", "F5"]);
    expect(o.narrators.map((n) => n.name)).toEqual(["Narrator A", "Narrator B"]);
  });
});

describe("sort", () => {
  it("default: newest first by video number", () => {
    const r = applyQuery(rows, DEFAULT_QUERY);
    expect(r.map((x) => x.number)).toEqual([...rows.map((x) => x.number)].sort((a, b) => b - a));
  });

  it("missing values go last in both directions", () => {
    for (const dir of ["asc", "desc"] as const) {
      const r = applyQuery(rows, q({ sort: "yt", dir }));
      const firstMissing = r.findIndex((x) => x.ytViews === undefined);
      expect(r.slice(firstMissing).every((x) => x.ytViews === undefined)).toBe(true);
      const vals = r.slice(0, firstMissing).map((x) => x.ytViews!);
      expect(vals).toEqual([...vals].sort((a, b) => (dir === "asc" ? a - b : b - a)));
    }
  });

  it("titles sort alphabetically", () => {
    const r = applyQuery(rows, q({ sort: "title", dir: "asc" })).map((x) => x.title.toLowerCase());
    expect(r).toEqual([...r].sort((a, b) => a.localeCompare(b)));
  });
});

describe("rows and strips", () => {
  it("QA state follows errors, then warnings", () => {
    expect(qaState({ qa: { passed: false, warnings: 0, errors: 1 } } as FilmRow)).toBe("error");
    expect(qaState({ qa: { passed: true, warnings: 2, errors: 0 } } as FilmRow)).toBe("warning");
    expect(qaState({ qa: { passed: true, warnings: 0, errors: 0 } } as FilmRow)).toBe("ok");
    expect(qaState({} as FilmRow)).toBe("none");
  });

  it("a rendered video carries its first text on screen", () => {
    expect(rows.filter((r) => r.durationS !== undefined).every((r) => r.firstText)).toBe(true);
  });

  it("contact sheet strips are weeks from the first video, in the list's order", () => {
    const start = rows.map((r) => r.made).sort()[0]!;
    const desc = weeks(applyQuery(rows, DEFAULT_QUERY), start);
    expect(desc.map((w) => w.week)).toEqual([...desc.map((w) => w.week)].sort((a, b) => b - a));
    expect(desc.flatMap((w) => w.rows)).toHaveLength(rows.length);
    const asc = weeks(applyQuery(rows, q({ dir: "asc" })), start);
    expect(asc[0]).toMatchObject({ week: 1, from: start });
  });
});
