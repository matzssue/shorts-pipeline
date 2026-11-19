import type { Film } from "../join";
import { median } from "./overview";

export type Platform = "youtube" | "instagram";

export interface StartLine {
  filmId: string;
  number: number;
  title: string;
  /** Cumulative views by day since publishing (index = day); undefined where no snapshot exists. */
  values: (number | undefined)[];
}

export interface Starts {
  platform: Platform;
  days: number;
  lines: StartLine[];
  /** Videos with a value on the last day: only they form the median and compete for the best start. */
  mature: number;
  /** Median by day over mature videos with a value that day; absent with fewer than two (one line is not a median). */
  median?: (number | undefined)[];
  best?: StartLine;
  /** Largest value on any line, for a shared scale. */
  max: number;
}

/**
 * How videos start on one platform: views in the first `days` days, aligned to the day of
 * publishing, so an old video and a new one compare fairly.
 */
export function starts(films: Film[], platform: Platform, days = 14): Starts {
  const lines: StartLine[] = [];
  for (const f of films) {
    const pts = f.daily.filter((d) => d.platform === platform && d.day >= 0 && d.day <= days);
    if (!pts.length) continue;
    const values: (number | undefined)[] = Array.from({ length: days + 1 }, () => undefined);
    for (const p of pts) values[p.day] = p.views;
    lines.push({ filmId: f.id, number: f.number, title: f.title, values });
  }
  const mature = lines.filter((l) => l.values[days] !== undefined);
  const med =
    mature.length >= 2
      ? Array.from({ length: days + 1 }, (_, d) => {
          const vs = mature.map((l) => l.values[d]).filter((v): v is number => v !== undefined);
          return vs.length ? median(vs) : undefined;
        })
      : undefined;
  const best = mature.reduce<StartLine | undefined>((b, l) => (!b || l.values[days]! > b.values[days]! ? l : b), undefined);
  const max = Math.max(0, ...lines.flatMap((l) => l.values.filter((v): v is number => v !== undefined)));
  return { platform, days, lines, mature: mature.length, median: med, best, max };
}
