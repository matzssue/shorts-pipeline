import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildFilms } from "@/data/join";
import { loadCatalog } from "@/data/load";
import {
  accounts,
  addDays,
  durations,
  inRange,
  lead,
  nearMinimum,
  notes,
  ovViews,
  parseRange,
  presetRange,
  qaFlags,
  recent,
  seasonRange,
  spanDays,
  stages,
  toOverview,
  type OvFilm,
  type Range,
} from "@/data/selectors/overview";
import { starts } from "@/data/selectors/starts";

const catalog = loadCatalog(path.resolve(import.meta.dirname, "../../fixtures/content"));
const input = toOverview(catalog, buildFilms(catalog));
const pick = (r: Range) => input.films.filter(inRange(r));

describe("range from the address", () => {
  it("defaults to the whole season", () => {
    expect(parseRange(input, null, null)).toEqual(seasonRange(input));
    expect(seasonRange(input)).toEqual({ from: "2026-01-05", to: "2026-02-15" });
  });

  it("ignores broken dates and swaps reversed ends", () => {
    expect(parseRange(input, "yesterday", "2026-02-01")).toEqual({ from: input.start, to: "2026-02-01" });
    expect(parseRange(input, "2026-02-30", null)).toEqual(seasonRange(input));
    expect(parseRange(input, "2026-02-10", "2026-02-01")).toEqual({ from: "2026-02-01", to: "2026-02-10" });
  });

  it("shortcuts end on the measurement day", () => {
    expect(presetRange(input, "7d")).toEqual({ from: "2026-02-09", to: "2026-02-15" });
    expect(spanDays(presetRange(input, "14d"))).toBe(14);
    expect(presetRange(input, "season")).toEqual(seasonRange(input));
  });

  it("counts days with both ends included", () => {
    expect(spanDays({ from: "2026-01-05", to: "2026-01-05" })).toBe(1);
    expect(spanDays(seasonRange(input))).toBe(42);
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });
});

describe("cut-down input", () => {
  it("keeps what the Overview needs and splits live from queued", () => {
    const pub = input.films.find((f) => f.stage === "published")!;
    expect(pub.published).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(pub.live).toContain("youtube");
    expect(input.films.find((f) => f.stage === "qaPassed")!.published).toBeUndefined();
    expect(JSON.stringify(input)).not.toMatch(/"scenes"|"words"/);
  });

  it("a video belongs to the range by the day it went live, before that by the day it was made", () => {
    const pub = input.films.find((f) => f.published && f.published !== f.made)!;
    expect(inRange({ from: pub.published!, to: pub.published! })(pub)).toBe(true);
    expect(inRange({ from: pub.made, to: pub.made })(pub)).toBe(false);
    const waiting = input.films.find((f) => !f.published)!;
    expect(inRange({ from: waiting.made, to: waiting.made })(waiting)).toBe(true);
  });
});

describe("sections agree with each other", () => {
  const season = seasonRange(input);
  const films = pick(season);
  const l = lead(input, films, season);

  it("accounts add up to the views in the opening sentence", () => {
    expect(accounts(input, films).reduce((s, a) => s + a.views, 0)).toBe(l.totalViews);
  });

  it("the stage counts match the sentence", () => {
    const st = stages(input, films);
    expect(st.find((s) => s.key === "render")!.count).toBe(l.made);
    expect(st.find((s) => s.key === "publish")!.count).toBe(l.published);
    expect(st.find((s) => s.key === "card")!.count).toBe(l.cards);
  });

  it("names the videos that stand and why", () => {
    const held = stages(input, films).flatMap((s) => s.held.map((h) => `${s.key}:${h.reason}:${h.film.stage}`));
    expect(held).toEqual(
      expect.arrayContaining(["narration:narration:scripted", "render:render:narrated", "qa:qaError:qaFailed", "publish:publish:qaPassed"]),
    );
  });

  it("recent videos are the newest eight", () => {
    const r = recent(films);
    expect(r).toHaveLength(8);
    for (let i = 1; i < r.length; i++) expect(r[i - 1]!.made >= r[i]!.made).toBe(true);
  });
});

describe("edge cases (design doc 5.2)", () => {
  it("a range with nothing published: no views, no median, empty start charts", () => {
    const r = { from: "2025-06-01", to: "2025-06-30" };
    const films = pick(r);
    const l = lead(input, films, r);
    expect(l).toMatchObject({ published: 0, made: 0, totalViews: 0, medianViews: 0, avgViewPercent: undefined, season: false });
    expect(starts(films, "youtube").lines).toEqual([]);
    expect(qaFlags(films)).toEqual([]);
    expect(nearMinimum(durations(films))).toEqual({ near: 0, total: 0 });
  });

  it("one video: its line stays, the median goes", () => {
    const one = input.films.find((f) => f.stage === "published")!;
    const r = { from: one.published!, to: one.published! };
    const films = pick(r).filter((f) => f.stage === "published");
    expect(films.length).toBeGreaterThanOrEqual(1);
    const s = starts(films.slice(0, 1), "youtube");
    expect(s.median).toBeUndefined();
    expect(s.lines).toHaveLength(1);
  });

  it("missing Analytics shows up as a note, not as a zero", () => {
    const films = pick(seasonRange(input));
    const missing = films.filter((f) => f.stage === "published" && f.yt && f.yt.avgViewPercent === undefined);
    expect(missing.length).toBeGreaterThan(0);
    expect(notes(input, films).find((n) => n.kind === "analyticsDelay")?.count).toBe(missing.length);
    const l = lead(input, films, seasonRange(input));
    const pct = films.filter((f) => f.stage === "published").map((f) => f.yt?.avgViewPercent).filter((v): v is number => v !== undefined);
    expect(l.avgViewPercent).toBeCloseTo(pct.reduce((s, v) => s + v, 0) / pct.length, 1);
  });
});

describe("QA ranking", () => {
  const f = (id: string, flagged: OvFilm["qa"] extends infer Q ? (Q extends { flagged: infer F } ? F : never) : never): OvFilm =>
    ({ id, qa: { passed: true, warnings: 0, errors: 0, flagged } }) as OvFilm;

  it("puts errors first, then the most common, and counts a video once per message", () => {
    const flags = qaFlags([
      f("a", [
        { level: "warning", text: "no question at the end" },
        { level: "warning", text: "no question at the end" },
      ]),
      f("b", [{ level: "warning", text: "no question at the end" }, { level: "warning", text: "long first frame" }]),
      f("c", [{ level: "error", text: "narration for another text" }]),
    ]);
    expect(flags.map((x) => [x.text, x.count])).toEqual([
      ["narration for another text", 1],
      ["no question at the end", 2],
      ["long first frame", 1],
    ]);
  });
});

describe("length near the minimum", () => {
  it("counts videos in the bottom quarter of their range", () => {
    const at = (s: number) => ({ film: {} as OvFilm, seconds: s });
    expect(nearMinimum([{ format: "F5", range: [20, 40], films: [at(21), at(24.9), at(25), at(39)] }])).toEqual({ near: 2, total: 4 });
  });
});

describe("views", () => {
  it("adds YouTube and Instagram, missing counts as nothing", () => {
    expect(ovViews({ yt: { views: 3 }, ig: { views: 4 } } as OvFilm)).toBe(7);
    expect(ovViews({} as OvFilm)).toBe(0);
  });
});
