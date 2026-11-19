import { FORMAT_DURATION_S, type Format } from "@shorts/schema/formats";
import type { DailyViews, Film, Stage } from "../join";
import type { Catalog } from "../load";

/*
 * The Overview, computed for a date range. Everything here is pure and safe in the browser: the
 * server turns the catalog into a small `OverviewInput`, the page recomputes the sections when the
 * range in the address changes. Range rule: a video belongs to a range by the day it first went
 * live (or, before that, the day it was made); its numbers come from the latest measurement.
 */

export interface OvQa {
  passed: boolean;
  warnings: number;
  errors: number;
  flagged: { level: "warning" | "error"; text: string }[];
}

export interface OvFilm {
  id: string;
  number: number;
  title: string;
  folder: string;
  made: string;
  format: string;
  series: number;
  seriesTitle: string;
  channel?: string;
  stage: Stage;
  durationS?: number;
  qa?: OvQa;
  /** Platforms with a live post. */
  live: string[];
  /** Platforms planned but not live yet. */
  queued: string[];
  /** First day the video went live anywhere. */
  published?: string;
  yt?: { views?: number; avgViewPercent?: number };
  ig?: { views?: number };
  daily: DailyViews[];
}

export interface OvAccount {
  channel: string;
  platform: "youtube" | "instagram";
  followers?: number;
  /** Followers in the first measurement. */
  first?: number;
}

export interface OverviewInput {
  /** First and last day of the season (first video made → last measurement). */
  start: string;
  end: string;
  measuredAt?: string;
  cards: number;
  channels: { id: string; name: string }[];
  films: OvFilm[];
  accounts: OvAccount[];
  snapshotNotes: string[];
}

export interface Range {
  from: string;
  to: string;
}

const day = (iso: string) => iso.slice(0, 10);

/** Server side: the catalog cut down to what the Overview needs. */
export function toOverview(c: Catalog, films: Film[]): OverviewInput {
  const first = c.snapshots[0];
  const last = c.snapshots.at(-1);
  const accounts: OvAccount[] = [];
  for (const ch of c.config.channels) {
    const a0 = first?.accounts.find((a) => a.channel === ch.id);
    const a1 = last?.accounts.find((a) => a.channel === ch.id);
    accounts.push({ channel: ch.id, platform: "youtube", followers: a1?.youtube?.subscribers, first: a0?.youtube?.subscribers });
    accounts.push({ channel: ch.id, platform: "instagram", followers: a1?.instagram?.followers, first: a0?.instagram?.followers });
  }
  const made = films.map((f) => f.made).sort();
  return {
    start: made[0] ?? day(last?.measuredAt ?? "2026-01-01"),
    end: last ? day(last.measuredAt) : (made.at(-1) ?? "2026-01-01"),
    measuredAt: last?.measuredAt,
    cards: c.topics.length + c.products.length,
    channels: c.config.channels.map((ch) => ({ id: ch.id, name: ch.name })),
    accounts,
    snapshotNotes: last?.notes ?? [],
    films: films.map((f) => {
      const live = f.publications.filter((p) => p.status === "published" && p.link !== "");
      const flagged = (f.qa?.checks ?? []).filter((x) => x.level !== "ok") as OvQa["flagged"];
      return {
        id: f.id,
        number: f.number,
        title: f.title,
        folder: f.folder,
        made: f.made,
        format: f.format,
        series: f.series,
        seriesTitle: f.seriesTitle,
        channel: f.channel,
        stage: f.stage,
        durationS: f.durationS,
        qa: f.qa && {
          passed: f.qa.passed,
          warnings: flagged.filter((x) => x.level === "warning").length,
          errors: flagged.filter((x) => x.level === "error").length,
          flagged,
        },
        live: [...new Set(live.map((p) => p.platform))],
        queued: [...new Set(f.publications.filter((p) => !live.includes(p)).map((p) => p.platform))],
        published: live.map((p) => p.date).sort()[0],
        yt: f.latest.youtube && { views: f.latest.youtube.views, avgViewPercent: f.latest.youtube.avgViewPercent },
        ig: f.latest.instagram && { views: f.latest.instagram.views },
        daily: f.daily,
      };
    }),
  };
}

// ---------- range ----------

const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** A real calendar day: 2026-02-30 does not roll over into March. */
const valid = (s: string | null | undefined): s is string => {
  if (!s || !ISO.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
};

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Days from `from` to `to`, both included. */
export const spanDays = (r: Range): number => Math.round((Date.parse(`${r.to}T00:00:00Z`) - Date.parse(`${r.from}T00:00:00Z`)) / 86_400_000) + 1;

export const seasonRange = (input: OverviewInput): Range => ({ from: input.start, to: input.end });

/** Range from the address; anything missing or broken falls back to the season's end. Reversed ends swap. */
export function parseRange(input: OverviewInput, from: string | null | undefined, to: string | null | undefined): Range {
  const r = { from: valid(from) ? from : input.start, to: valid(to) ? to : input.end };
  return r.from <= r.to ? r : { from: r.to, to: r.from };
}

export const PRESETS = ["season", "14d", "7d"] as const;
export type Preset = (typeof PRESETS)[number];

export function presetRange(input: OverviewInput, p: Preset): Range {
  if (p === "season") return seasonRange(input);
  const n = p === "14d" ? 14 : 7;
  return { from: addDays(input.end, -(n - 1)), to: input.end };
}

export const sameRange = (a: Range, b: Range) => a.from === b.from && a.to === b.to;

export const filmDate = (f: OvFilm): string => f.published ?? f.made;
export const inRange = (r: Range) => (f: OvFilm) => filmDate(f) >= r.from && filmDate(f) <= r.to;
export const ovViews = (f: OvFilm): number => (f.yt?.views ?? 0) + (f.ig?.views ?? 0);

// ---------- sections ----------

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export const isPublished = (f: OvFilm) => f.stage === "published";
export const isMade = (f: OvFilm) => f.stage === "rendered" || f.stage === "qaFailed" || f.stage === "qaPassed" || f.stage === "published";

/** Numbers behind the opening sentence. */
export interface Lead {
  days: number;
  /** The range is the whole season (the sentence then names the cards too). */
  season: boolean;
  cards: number;
  /** Videos with a rendered timeline. */
  made: number;
  published: number;
  channels: number;
  totalViews: number;
  /** Median of views per published video. */
  medianViews: number;
  /** Mean % watched on YouTube over videos that already have Analytics. */
  avgViewPercent?: number;
  qaFailed: number;
}

export function lead(input: OverviewInput, films: OvFilm[], r: Range): Lead {
  const published = films.filter(isPublished);
  const pct = published.map((f) => f.yt?.avgViewPercent).filter((v): v is number => v !== undefined);
  return {
    days: spanDays(r),
    season: sameRange(r, seasonRange(input)),
    cards: input.cards,
    made: films.filter(isMade).length,
    published: published.length,
    channels: new Set(published.map((f) => f.channel).filter(Boolean)).size,
    totalViews: published.reduce((s, f) => s + ovViews(f), 0),
    medianViews: median(published.map(ovViews)),
    avgViewPercent: pct.length ? Math.round((pct.reduce((s, v) => s + v, 0) / pct.length) * 10) / 10 : undefined,
    qaFailed: films.filter((f) => f.stage === "qaFailed").length,
  };
}

export type StageKey = "card" | "script" | "narration" | "render" | "qa" | "publish";
export type HeldReason = "narration" | "render" | "qaError" | "qaMissing" | "publish";

export interface StageCount {
  key: StageKey;
  count: number;
  /** Videos that stopped right before this step, and why. */
  held: { film: OvFilm; reason: HeldReason }[];
}

/** From card to publication: how many videos reached each step and which ones stand. */
export function stages(input: OverviewInput, films: OvFilm[]): StageCount[] {
  const held = (s: Stage, reason: HeldReason) => films.filter((f) => f.stage === s).map((film) => ({ film, reason }));
  return [
    { key: "card", count: input.cards, held: [] },
    { key: "script", count: films.length, held: [] },
    { key: "narration", count: films.filter((f) => f.stage !== "scripted").length, held: held("scripted", "narration") },
    { key: "render", count: films.filter(isMade).length, held: held("narrated", "render") },
    {
      key: "qa",
      count: films.filter((f) => f.stage === "qaPassed" || isPublished(f)).length,
      held: [...held("qaFailed", "qaError"), ...held("rendered", "qaMissing")],
    },
    { key: "publish", count: films.filter(isPublished).length, held: held("qaPassed", "publish") },
  ];
}

export interface MeasurementNote {
  platform: "YT" | "IG" | "TT" | "—";
  kind: "analyticsDelay" | "missingPlatform" | "noApi" | "snapshot";
  count?: number;
  text?: string;
}

/** What the numbers do not cover, said before anyone asks. */
export function notes(input: OverviewInput, films: OvFilm[]): MeasurementNote[] {
  const out: MeasurementNote[] = [];
  const published = films.filter(isPublished);
  const noAnalytics = published.filter((f) => f.yt && f.yt.avgViewPercent === undefined).length;
  if (noAnalytics) out.push({ platform: "YT", kind: "analyticsDelay", count: noAnalytics });
  const noIg = published.filter((f) => !f.live.includes("instagram")).length;
  if (noIg) out.push({ platform: "IG", kind: "missingPlatform", count: noIg });
  const tiktok = films.filter((f) => f.live.includes("tiktok") || f.queued.includes("tiktok")).length;
  if (tiktok) out.push({ platform: "TT", kind: "noApi", count: tiktok });
  for (const text of input.snapshotNotes) out.push({ platform: "—", kind: "snapshot", text });
  return out;
}

/** The newest videos first, by the day they were made. */
export const recent = (films: OvFilm[], n = 8): OvFilm[] => [...films].sort((a, b) => b.made.localeCompare(a.made) || b.number - a.number).slice(0, n);

export interface DurationRow {
  format: Format;
  range: readonly [number, number];
  films: { film: OvFilm; seconds: number }[];
}

export function durations(films: OvFilm[]): DurationRow[] {
  return (Object.keys(FORMAT_DURATION_S) as Format[]).map((format) => ({
    format,
    range: FORMAT_DURATION_S[format],
    films: films.filter((f) => f.format === format && f.durationS !== undefined).map((film) => ({ film, seconds: film.durationS! })),
  }));
}

/** Videos that end in the bottom quarter of their allowed length: a shorter script would fail the check. */
export function nearMinimum(rows: DurationRow[]): { near: number; total: number } {
  let near = 0;
  let total = 0;
  for (const r of rows)
    for (const f of r.films) {
      total++;
      if ((f.seconds - r.range[0]) / (r.range[1] - r.range[0]) < 0.25) near++;
    }
  return { near, total };
}

export interface QaFlag {
  text: string;
  level: "warning" | "error";
  /** Videos that got this message. */
  count: number;
}

/** What QA reports most often: errors first, then by number of videos. */
export function qaFlags(films: OvFilm[]): QaFlag[] {
  const map = new Map<string, QaFlag>();
  for (const f of films)
    for (const x of new Map((f.qa?.flagged ?? []).map((q) => [q.text, q])).values()) {
      const cur = map.get(x.text) ?? { text: x.text, level: x.level, count: 0 };
      cur.count++;
      map.set(x.text, cur);
    }
  return [...map.values()].sort((a, b) => (a.level === b.level ? b.count - a.count || a.text.localeCompare(b.text) : a.level === "error" ? -1 : 1));
}

export interface AccountRow extends OvAccount {
  name: string;
  /** Videos in the range live on this channel and platform. */
  films: number;
  views: number;
}

export function accounts(input: OverviewInput, films: OvFilm[]): AccountRow[] {
  return input.accounts.map((a) => {
    const mine = films.filter((f) => f.channel === a.channel && f.live.includes(a.platform));
    return {
      ...a,
      name: input.channels.find((c) => c.id === a.channel)?.name ?? a.channel,
      films: mine.length,
      views: mine.reduce((s, f) => s + ((a.platform === "youtube" ? f.yt?.views : f.ig?.views) ?? 0), 0),
    };
  });
}
