import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildContent, writeContent, type MockContent } from "@shorts/mock";
import { beforeAll, describe, expect, it } from "vitest";
import { buildFilms, daysBetween, filmViews, type Film } from "@/data/join";
import { contentDir, DataError, loadCatalog, type Catalog } from "@/data/load";
import { filmRows } from "@/data/selectors/films";
import { lead, median, notes, stages } from "@/data/selectors/overview";

const FIXTURES = path.resolve(import.meta.dirname, "../../fixtures/content");
const tmp = () => mkdtempSync(path.join(tmpdir(), "dash-"));

/** A small catalog cut out of the mock season: four videos, two snapshots. */
function miniContent(): MockContent {
  const full = buildContent();
  const films = [0, 5, 14, 17].map((i) => full.films[i]!);
  const folders = new Set(films.map((f) => f.folder));
  const inMini = (file: string) => [...folders].some((f) => file.includes(f));
  const keep = (d: string) => full.snapshots.find((s) => s.measuredAt.startsWith(d))!;
  return {
    ...full,
    films,
    publications: full.publications.filter((p) => inMini(p.file)),
    snapshots: [keep("2026-01-20"), keep("2026-02-15")],
    ledger: full.ledger.filter((r) => folders.has(r.film)),
  };
}

describe("mini catalog", () => {
  let dir: string;
  let mini: MockContent;
  let catalog: Catalog;
  let films: Film[];

  beforeAll(() => {
    dir = tmp();
    mini = miniContent();
    writeContent(dir, mini);
    catalog = loadCatalog(dir);
    films = buildFilms(catalog);
  });

  it("reads every folder and gives each video its stage", () => {
    expect(films.map((f) => [f.folder, f.stage])).toEqual([
      ["2026-01-05-drawer-dividers-from-boxes-F5", "published"],
      ["2026-01-16-cable-ties-from-bread-clips-F5", "published"],
      ["2026-02-14-shoe-rack-by-size-F5", "qaFailed"],
      ["2026-02-15-stackable-drawer-trays-F1", "scripted"],
    ]);
    expect(films.map((f) => f.number)).toEqual([1, 2, 3, 4]);
  });

  it("joins the latest stats row through the publication link", () => {
    const f = films[0]!;
    const yt = f.publications.find((p) => p.platform === "youtube")!;
    const row = mini.snapshots.at(-1)!.youtube.find((r) => r.pub.link === yt.link)!;
    expect(f.latest.youtube?.views).toBe(row.views);
    expect(f.channel).toBe("a");
    expect(f.narratorName).toBe("Narrator A");
    expect(f.title).toBe("Drawer dividers from old shoe boxes");
    expect(f.seriesTitle).toBe("Quick tip");
  });

  it("daily views are aligned to the publishing day", () => {
    const f = films[0]!;
    const yt = f.publications.find((p) => p.platform === "youtube")!;
    const days = f.daily.filter((d) => d.platform === "youtube").map((d) => d.day);
    expect(days).toEqual(mini.snapshots.map((s) => daysBetween(yt.date, s.measuredAt)));
  });

  it("a snapshot without Instagram insights gives no Instagram daily point for that day", () => {
    const f = films[0]!;
    expect(f.daily.filter((d) => d.platform === "instagram")).toHaveLength(1);
  });

  it("YouTube-only video has no Instagram numbers", () => {
    const f = films[1]!;
    expect(f.publications.map((p) => p.platform)).toEqual(["youtube"]);
    expect(f.latest.instagram).toBeUndefined();
    expect(filmViews(f)).toBe(f.latest.youtube!.views);
  });

  it("narration characters come from the voice ledger", () => {
    for (const f of films) {
      const sum = mini.ledger.filter((r) => r.film === f.folder).reduce((s, r) => s + r.chars, 0);
      expect(f.voice.chars).toBe(sum);
    }
    expect(films[3]!.voice).toEqual({ chars: 0, full: 0, takes: 0, cached: 0 });
  });

  it("the failed video keeps its QA errors", () => {
    expect(films[2]!.qa?.checks.some((c) => c.level === "error")).toBe(true);
  });
});

describe("broken data stops the build with the file and the field", () => {
  it("invalid script", () => {
    const dir = tmp();
    const mini = miniContent();
    writeContent(dir, mini);
    const rel = `out/${mini.films[0]!.folder}/script.json`;
    writeFileSync(path.join(dir, rel), JSON.stringify({ ...mini.films[0]!.script, format: "F9" }));
    expect(() => loadCatalog(dir)).toThrow(DataError);
    expect(() => loadCatalog(dir)).toThrow(`${rel}: format:`);
  });

  it("invalid JSON", () => {
    const dir = tmp();
    writeContent(dir, miniContent());
    writeFileSync(path.join(dir, "shorts.config.json"), "{ nope");
    expect(() => loadCatalog(dir)).toThrow(/^shorts\.config\.json: invalid JSON/);
  });

  it("invalid CSV row names the row", () => {
    const dir = tmp();
    writeContent(dir, miniContent());
    writeFileSync(path.join(dir, "data/publications.csv"), "date,platform,channel,file,link,status\n15.02.2026,youtube,a,x.mp4,,published\n");
    expect(() => loadCatalog(dir)).toThrow("data/publications.csv row 2: date:");
  });

  it("missing CSV column", () => {
    const dir = tmp();
    writeContent(dir, miniContent());
    writeFileSync(path.join(dir, "data/publications.csv"), "date,platform\n");
    expect(() => loadCatalog(dir)).toThrow("data/publications.csv: missing column channel");
  });
});

describe("content directory", () => {
  it("defaults to the committed fixtures", () => {
    expect(contentDir({}, "/repo/dashboard")).toBe(path.resolve("/repo/fixtures/content"));
  });

  it("refuses a custom directory in the public build", () => {
    expect(() => contentDir({ DASHBOARD_CONTENT_DIR: "/real", DASHBOARD_BASE_PATH: "/shorts-pipeline" })).toThrow(/not allowed/);
  });
});

describe("full mock season", () => {
  const catalog = loadCatalog(FIXTURES);
  const films = buildFilms(catalog);
  const rows = filmRows(films);
  const l = lead(catalog, films);

  it("has every stage the generator planned", () => {
    const count = (s: string) => films.filter((f) => f.stage === s).length;
    expect(films).toHaveLength(18);
    expect([count("published"), count("qaFailed"), count("qaPassed"), count("narrated"), count("scripted")]).toEqual([14, 1, 1, 1, 1]);
  });

  it("the opening sentence agrees with the table", () => {
    expect(l.totalViews).toBe(rows.reduce((s, r) => s + r.views, 0));
    expect(l.published).toBe(rows.filter((r) => r.stage === "published").length);
    expect(l.medianViews).toBe(median(rows.filter((r) => r.stage === "published").map((r) => r.views)));
    expect(l.made).toBe(rows.filter((r) => r.durationS !== undefined).length);
    expect(l.qaFailed).toBe(1);
    expect(l.channels).toBe(2);
    expect(l.avgViewPercent).toBeGreaterThan(35);
  });

  it("each step of the funnel holds at most as many videos as the one before", () => {
    const counts = stages(catalog, films).slice(1).map((s) => s.count);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]!);
  });

  it("measurement notes name the gaps", () => {
    expect(notes(catalog, films).map((n) => n.kind)).toEqual(expect.arrayContaining(["analyticsDelay", "missingPlatform", "noApi"]));
  });

  it("median handles even and empty lists", () => {
    expect(median([])).toBe(0);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});
