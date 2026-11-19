import type { Catalog } from "../load";
import { filmViews, type Film } from "../join";

/** Numbers behind the opening sentence of the Overview. */
export interface Lead {
  cards: number;
  /** Videos with a rendered timeline (rendered, QA'd or published). */
  made: number;
  published: number;
  channels: number;
  totalViews: number;
  /** Median of views per published video. */
  medianViews: number;
  /** Mean % viewed on YouTube over videos that already have Analytics; undefined without any. */
  avgViewPercent?: number;
  qaFailed: number;
  measuredAt?: string;
}

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

const isPublished = (f: Film) => f.stage === "published";
const isMade = (f: Film) => f.compose !== undefined;

export function lead(c: Catalog, films: Film[]): Lead {
  const published = films.filter(isPublished);
  const pct = published.map((f) => f.latest.youtube?.avgViewPercent).filter((v): v is number => v !== undefined);
  return {
    cards: c.topics.length + c.products.length,
    made: films.filter(isMade).length,
    published: published.length,
    channels: new Set(published.map((f) => f.channel).filter(Boolean)).size,
    totalViews: films.reduce((s, f) => s + filmViews(f), 0),
    medianViews: median(published.map(filmViews)),
    avgViewPercent: pct.length ? Math.round((pct.reduce((s, v) => s + v, 0) / pct.length) * 10) / 10 : undefined,
    qaFailed: films.filter((f) => f.stage === "qaFailed").length,
    measuredAt: c.snapshots.at(-1)?.measuredAt,
  };
}

export interface StageCount {
  key: "card" | "script" | "narration" | "render" | "qa" | "publish";
  count: number;
}

/** From card to publication: how many videos reached each step. */
export function stages(c: Catalog, films: Film[]): StageCount[] {
  return [
    { key: "card", count: c.topics.length + c.products.length },
    { key: "script", count: films.length },
    { key: "narration", count: films.filter((f) => f.stage !== "scripted").length },
    { key: "render", count: films.filter(isMade).length },
    { key: "qa", count: films.filter((f) => f.qa?.passed).length },
    { key: "publish", count: films.filter(isPublished).length },
  ];
}

export interface MeasurementNote {
  platform: "YT" | "IG" | "TT" | "—";
  kind: "analyticsDelay" | "missingPlatform" | "noApi" | "snapshot";
  count?: number;
  text?: string;
}

/** What the numbers do not cover, said before anyone asks. */
export function notes(c: Catalog, films: Film[]): MeasurementNote[] {
  const out: MeasurementNote[] = [];
  const published = films.filter(isPublished);
  const noAnalytics = published.filter((f) => f.latest.youtube && f.latest.youtube.avgViewPercent === undefined).length;
  if (noAnalytics) out.push({ platform: "YT", kind: "analyticsDelay", count: noAnalytics });
  const noIg = published.filter((f) => !f.publications.some((p) => p.platform === "instagram")).length;
  if (noIg) out.push({ platform: "IG", kind: "missingPlatform", count: noIg });
  const tiktok = c.publications.filter((p) => p.platform === "tiktok").length;
  if (tiktok) out.push({ platform: "TT", kind: "noApi", count: tiktok });
  for (const text of c.snapshots.at(-1)?.notes ?? []) out.push({ platform: "—", kind: "snapshot", text });
  return out;
}
