import type { Stage } from "../join";

/*
 * The Films view: one row per video, then filters, sort, view mode and columns read from the
 * address. Pure and safe in the browser (no Node, no Zod): the page reapplies the query when the
 * address changes, and a link reproduces the view.
 */

/** One video as the Films view shows it. Missing numbers stay undefined and render as "–". */
export interface FilmRow {
  id: string;
  number: number;
  title: string;
  folder: string;
  made: string;
  stage: Stage;
  format: string;
  series: number;
  seriesTitle: string;
  channel?: string;
  narrator?: string;
  narratorName?: string;
  model?: string;
  /** First text on screen (the first scene's headline), shown in the frame. */
  firstText?: string;
  /** First day live anywhere. */
  published?: string;
  live: string[];
  queued: string[];
  qa?: { passed: boolean; warnings: number; errors: number };
  durationS?: number;
  views: number;
  ytViews?: number;
  igViews?: number;
  avgViewPercent?: number;
  /** Average seconds watched on YouTube. */
  avgViewSeconds?: number;
  likes?: number;
  shares?: number;
  /** Saves on Instagram. */
  saves?: number;
  narrationChars: number;
  takes: number;
}

// ---------- query ----------

export const SORT_KEYS = ["number", "title", "released", "length", "views", "yt", "ig", "watched", "chars"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const COLUMNS = ["released", "format", "length", "qa", "yt", "ig", "watched", "narrator", "chars", "likes", "shares", "saves", "watchTime"] as const;
export type Column = (typeof COLUMNS)[number];
export const DEFAULT_COLUMNS: readonly Column[] = ["released", "format", "length", "qa", "yt", "ig", "watched"];

export const QA_STATES = ["ok", "warning", "error", "none"] as const;
export type QaState = (typeof QA_STATES)[number];

export interface FilmQuery {
  q: string;
  channel?: string;
  platform?: string;
  format?: string;
  series?: number;
  narrator?: string;
  qa?: QaState;
  sort: SortKey;
  dir: "asc" | "desc";
  view: "table" | "sheet";
  cols: Column[];
}

export const DEFAULT_QUERY: FilmQuery = { q: "", sort: "number", dir: "desc", view: "table", cols: [...DEFAULT_COLUMNS] };

type Params = { get(name: string): string | null };

const oneOf = <T extends string>(list: readonly T[], v: string | null): T | undefined => (list as readonly string[]).includes(v ?? "") ? (v as T) : undefined;

/** Reads the query from the address. Unknown values are dropped, so a broken link still opens. */
export function parseQuery(p: Params): FilmQuery {
  const series = Number(p.get("series"));
  const cols = (p.get("cols") ?? "")
    .split(",")
    .map((c) => oneOf(COLUMNS, c))
    .filter((c): c is Column => !!c);
  return {
    q: (p.get("q") ?? "").slice(0, 100),
    channel: p.get("channel") || undefined,
    platform: p.get("platform") || undefined,
    format: p.get("format") || undefined,
    series: Number.isInteger(series) && series > 0 ? series : undefined,
    narrator: p.get("narrator") || undefined,
    qa: oneOf(QA_STATES, p.get("qa")),
    sort: oneOf(SORT_KEYS, p.get("sort")) ?? DEFAULT_QUERY.sort,
    dir: p.get("dir") === "asc" ? "asc" : p.get("dir") === "desc" ? "desc" : DEFAULT_QUERY.dir,
    view: p.get("view") === "sheet" ? "sheet" : "table",
    cols: p.get("cols") === null ? [...DEFAULT_COLUMNS] : COLUMNS.filter((c) => cols.includes(c)),
  };
}

/** The query as address parameters, defaults left out so the link stays short. */
export function toSearch(q: FilmQuery): string {
  const s = new URLSearchParams();
  if (q.q.trim()) s.set("q", q.q.trim());
  for (const k of ["channel", "platform", "format", "narrator", "qa"] as const) if (q[k]) s.set(k, q[k]!);
  if (q.series) s.set("series", String(q.series));
  if (q.sort !== DEFAULT_QUERY.sort || q.dir !== DEFAULT_QUERY.dir) {
    s.set("sort", q.sort);
    s.set("dir", q.dir);
  }
  if (q.view !== "table") s.set("view", q.view);
  const cols = COLUMNS.filter((c) => q.cols.includes(c));
  if (cols.join() !== DEFAULT_COLUMNS.join()) s.set("cols", cols.join(","));
  const str = s.toString();
  return str ? `?${str}` : "";
}

export const isFiltered = (q: FilmQuery) => !!(q.q.trim() || q.channel || q.platform || q.format || q.series || q.narrator || q.qa);

export function qaState(r: FilmRow): QaState {
  if (!r.qa) return "none";
  if (r.qa.errors || !r.qa.passed) return "error";
  return r.qa.warnings ? "warning" : "ok";
}

const fold = (s: string) => s.toLocaleLowerCase("en").normalize("NFD").replace(/\p{M}/gu, "");

const SORT_VALUE: Record<SortKey, (r: FilmRow) => number | string | undefined> = {
  number: (r) => r.number,
  title: (r) => fold(r.title),
  released: (r) => r.published,
  length: (r) => r.durationS,
  views: (r) => r.views,
  yt: (r) => r.ytViews,
  ig: (r) => r.igViews,
  watched: (r) => r.avgViewPercent,
  chars: (r) => r.narrationChars,
};

/** Filters, then sorts. Missing values always go last, whichever the direction; ties keep the video number order. */
export function applyQuery(rows: FilmRow[], q: FilmQuery): FilmRow[] {
  const needle = fold(q.q.trim());
  const out = rows.filter(
    (r) =>
      (!needle || fold(r.title).includes(needle) || r.folder.includes(needle)) &&
      (!q.channel || r.channel === q.channel) &&
      (!q.platform || r.live.includes(q.platform) || r.queued.includes(q.platform)) &&
      (!q.format || r.format === q.format) &&
      (!q.series || r.series === q.series) &&
      (!q.narrator || r.narrator === q.narrator) &&
      (!q.qa || qaState(r) === q.qa),
  );
  const get = SORT_VALUE[q.sort];
  const sign = q.dir === "asc" ? 1 : -1;
  return out.sort((a, b) => {
    const x = get(a);
    const y = get(b);
    if (x === undefined || y === undefined) return x === y ? a.number - b.number : x === undefined ? 1 : -1;
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return c ? c * sign : a.number - b.number;
  });
}

/**
 * Contact sheet strips: videos grouped by the week they were made, counted from the first one.
 * Strips keep the order of the sorted list, so "newest first" puts the latest week on top.
 */
export function weeks(rows: FilmRow[], start: string): { week: number; from: string; rows: FilmRow[] }[] {
  const t0 = Date.parse(`${start}T00:00:00Z`);
  const map = new Map<number, FilmRow[]>();
  for (const r of rows) {
    const w = Math.floor((Date.parse(`${r.made}T00:00:00Z`) - t0) / (7 * 86_400_000));
    map.set(w, [...(map.get(w) ?? []), r]);
  }
  return [...map].map(([w, rs]) => ({ week: w + 1, from: new Date(t0 + w * 7 * 86_400_000).toISOString().slice(0, 10), rows: rs }));
}

/** Options for the filter bar, from the rows themselves (a filter never offers a value with no video). */
export function filterOptions(rows: FilmRow[]) {
  const uniq = <T,>(xs: (T | undefined)[]) => [...new Set(xs.filter((x): x is T => x !== undefined))].sort();
  return {
    channels: uniq(rows.map((r) => r.channel)),
    platforms: uniq(rows.flatMap((r) => [...r.live, ...r.queued])),
    formats: uniq(rows.map((r) => r.format)),
    series: uniq(rows.map((r) => r.series)).sort((a, b) => a - b),
    narrators: uniq(rows.map((r) => r.narrator)).map((id) => ({ id, name: rows.find((r) => r.narrator === id)?.narratorName ?? id })),
  };
}
