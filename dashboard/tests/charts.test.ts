import path from "node:path";
import { describe, expect, it } from "vitest";
import { count, filmNo, fmtDec, fmtInt, fmtPct } from "@/charts/format";
import { lastPoint, linePath } from "@/charts/path";
import { linear, niceStep, pct, ticks } from "@/charts/scale";
import { buildFilms, type DailyViews, type Film } from "@/data/join";
import { loadCatalog } from "@/data/load";
import { starts } from "@/data/selectors/starts";

describe("linear scale", () => {
  it("maps the domain onto 0–100 and back", () => {
    const x = linear([0, 14]);
    expect(x(0)).toBe(0);
    expect(x(7)).toBe(50);
    expect(x(14)).toBe(100);
    expect(x.invert(50)).toBe(7);
  });

  it("flips for a y axis drawn top-down", () => {
    const y = linear([0, 6000], [100, 0]);
    expect(y(0)).toBe(100);
    expect(y(6000)).toBe(0);
    expect(y(1500)).toBe(75);
    expect(y.invert(75)).toBe(1500);
  });

  it("does not divide by zero on an empty domain", () => {
    const x = linear([5, 5]);
    expect(x(5)).toBe(0);
    expect(x(9)).toBe(0);
  });
});

describe("ticks", () => {
  it("picks steps of 1, 2 or 5 × 10ⁿ", () => {
    expect(niceStep(4462, 3)).toBe(2000);
    expect(niceStep(100, 4)).toBe(50);
    expect(niceStep(0.9, 3)).toBe(0.5);
    expect(niceStep(7, 7)).toBe(1);
    expect(niceStep(0, 3)).toBe(1);
  });

  it("covers the data with nice ends", () => {
    expect(ticks(0, 4462, 3)).toEqual([0, 2000, 4000, 6000]);
    expect(ticks(0, 7682, 3)).toEqual([0, 5000, 10000]);
    expect(ticks(20.8, 60, 4)).toEqual([20, 30, 40, 50, 60]);
    expect(ticks(0, 1, 4)).toEqual([0, 0.5, 1]);
  });

  it("keeps decimals clean", () => {
    expect(ticks(0, 0.3, 3)).toEqual([0, 0.1, 0.2, 0.3]);
  });

  it("gives an empty range an axis", () => {
    expect(ticks(0, 0)).toEqual([0, 1]);
    expect(ticks(40, 40, 4)).toEqual([40, 41]);
  });

  it("accepts reversed bounds", () => {
    expect(ticks(4462, 0, 3)).toEqual([0, 2000, 4000, 6000]);
  });

  it("formats percentages for styles", () => {
    expect(pct(100 / 3)).toBe("33.333%");
    expect(pct(25)).toBe("25%");
  });
});

describe("line path", () => {
  const x = linear([0, 4]);
  const y = linear([0, 100], [100, 0]);

  it("draws through every value", () => {
    expect(linePath([0, 25, 50, 75, 100], x, y)).toBe("M0.00 100.00L25.00 75.00L50.00 50.00L75.00 25.00L100.00 0.00");
  });

  it("breaks at a missing value instead of jumping across it", () => {
    expect(linePath([0, 25, undefined, 75, 100], x, y)).toBe("M0.00 100.00L25.00 75.00M75.00 25.00L100.00 0.00");
  });

  it("is empty without values", () => {
    expect(linePath([undefined, undefined], x, y)).toBe("");
    expect(lastPoint([undefined])).toBeUndefined();
  });

  it("finds the last defined point for the end label", () => {
    expect(lastPoint([1, 2, undefined])).toEqual({ i: 1, v: 2 });
  });
});

describe("format", () => {
  it("groups thousands and fixes decimals", () => {
    expect(fmtInt(4462)).toBe("4,462");
    expect(fmtInt(1_000_000)).toBe("1,000,000");
    expect(fmtDec(40, 1)).toBe("40.0");
    expect(fmtPct(86.25)).toBe("86.3%");
  });

  it("chooses the word by number", () => {
    expect(count(1, "video", "videos")).toBe("1 video");
    expect(count(0, "video", "videos")).toBe("0 videos");
    expect(count(22, "video", "videos")).toBe("22 videos");
    expect(count(1000, "video", "videos")).toBe("1,000 videos");
  });

  it("numbers videos like the slate", () => {
    expect(filmNo(2)).toBe("02");
    expect(filmNo(112)).toBe("112");
  });
});

/** A film with only what `starts` reads. */
const film = (n: number, daily: DailyViews[]): Film => ({ id: `f${n}`, number: n, title: `Film ${n}`, daily }) as unknown as Film;
const yt = (pairs: [number, number][]): DailyViews[] => pairs.map(([day, views]) => ({ platform: "youtube", day, views }));

describe("starts", () => {
  it("aligns videos to their day of publishing and takes the median of mature ones", () => {
    const s = starts(
      [
        film(1, yt([[0, 10], [1, 20], [2, 30]])),
        film(2, yt([[0, 30], [1, 40], [2, 90]])),
        film(3, yt([[0, 20], [1, 60], [2, 60]])),
        film(4, yt([[0, 100]])), // too young: drawn, but not in the median
      ],
      "youtube",
      2,
    );
    expect(s.lines).toHaveLength(4);
    expect(s.mature).toBe(3);
    expect(s.median).toEqual([20, 40, 60]);
    expect(s.best?.filmId).toBe("f2");
    expect(s.max).toBe(100);
  });

  it("leaves the median empty on a day no video has a value", () => {
    const s = starts([film(1, yt([[1, 5], [2, 9]])), film(2, yt([[1, 7], [2, 11]]))], "youtube", 2);
    expect(s.median).toEqual([undefined, 6, 10]);
  });

  it("keeps gaps where a snapshot has no value", () => {
    const s = starts([film(1, yt([[0, 5], [2, 9]]))], "youtube", 2);
    expect(s.lines[0]!.values).toEqual([5, undefined, 9]);
  });

  it("drops the median with a single video but keeps its line", () => {
    const s = starts([film(1, yt([[0, 5], [1, 7]]))], "youtube", 1);
    expect(s.median).toBeUndefined();
    expect(s.best?.filmId).toBe("f1");
    expect(s.lines).toHaveLength(1);
  });

  it("is empty with nothing published", () => {
    const s = starts([], "instagram");
    expect(s).toMatchObject({ lines: [], mature: 0, median: undefined, best: undefined, max: 0 });
  });

  it("ignores the other platform and days past the window", () => {
    const s = starts([film(1, [...yt([[0, 1], [20, 99]]), { platform: "instagram", day: 0, views: 500 }])], "youtube", 14);
    expect(s.max).toBe(1);
  });

  it("on the mock season: the best start is the highest value on the last day", () => {
    const films = buildFilms(loadCatalog(path.resolve(import.meta.dirname, "../../fixtures/content")));
    for (const platform of ["youtube", "instagram"] as const) {
      const s = starts(films, platform);
      const last = s.lines.map((l) => l.values[s.days]).filter((v): v is number => v !== undefined);
      expect(s.mature).toBe(last.length);
      expect(s.best?.values[s.days]).toBe(Math.max(...last));
      expect(s.median?.[s.days]).toBeLessThanOrEqual(s.best!.values[s.days]!);
    }
  });
});
