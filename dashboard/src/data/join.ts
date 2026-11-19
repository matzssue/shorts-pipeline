import { FPS, type ComposeProps, type IgMediaStats, type Publication, type QaResult, type StatsSnapshot, type YtVideoStats } from "@shorts/schema";
import type { Catalog, RawFilm } from "./load";

/**
 * The dashboard's view of one video: files of its folder joined with its publications, stats and
 * narration costs. The join goes snapshot row → `link` → publications.csv → `file` → video folder,
 * the same way `pnpm stats` does it.
 */

export const STAGES = ["scripted", "narrated", "rendered", "qaFailed", "qaPassed", "published"] as const;
export type Stage = (typeof STAGES)[number];

export type YtRow = YtVideoStats & { pub: { date: string; channel: string; link: string } };
export type IgRow = IgMediaStats & { pub: { date: string; channel: string; link: string } };

export interface DailyViews {
  platform: "youtube" | "instagram";
  /** Days since publishing. */
  day: number;
  views: number;
}

export interface Film {
  /** URL slug: the folder name, plus the narrator when a folder holds more than one. */
  id: string;
  /** 1-based, in order of the folder date. */
  number: number;
  folder: string;
  made: string;
  cardId: string;
  kind: "topic" | "product";
  title: string;
  format: string;
  series: number;
  seriesTitle: string;
  /** From the publications; unknown before the first one. */
  channel?: string;
  narrator?: string;
  narratorName?: string;
  stage: Stage;
  durationS?: number;
  compose?: ComposeProps;
  qa?: QaResult;
  publications: Publication[];
  /** Rows from the last snapshot that has the video. */
  latest: { youtube?: YtRow; instagram?: IgRow };
  daily: DailyViews[];
  voice: { chars: number; full: number; takes: number; cached: number };
}

export const daysBetween = (from: string, to: string): number => Math.round((Date.parse(`${to.slice(0, 10)}T00:00:00Z`) - Date.parse(`${from.slice(0, 10)}T00:00:00Z`)) / 86_400_000);

function stageOf(raw: RawFilm, pubs: Publication[]): Stage {
  if (pubs.some((p) => p.status === "published" && p.link !== "")) return "published";
  if (raw.qa) return raw.qa.passed ? "qaPassed" : "qaFailed";
  if (raw.compose) return "rendered";
  if (raw.voice) return "narrated";
  return "scripted";
}

/** The folder a publication's file points to, e.g. `out/<folder>/final-<narrator>.mp4`. */
export function pubTarget(p: Publication): { folder?: string; narrator?: string } {
  const m = /(?:^|\/)out\/([^/]+)\/final-([^/]+)\.mp4$/.exec(p.file.replaceAll("\\", "/"));
  return { folder: m?.[1], narrator: m?.[2] };
}

function latestRow<T extends { pub: { link: string } }>(snapshots: StatsSnapshot[], pick: (s: StatsSnapshot) => T[], link: string): T | undefined {
  for (let i = snapshots.length - 1; i >= 0; i--) {
    const row = pick(snapshots[i]!).find((r) => r.pub.link === link);
    if (row) return row;
  }
  return undefined;
}

export function buildFilms(c: Catalog): Film[] {
  const titles = new Map<string, { title: string; kind: "topic" | "product" }>([
    ...c.topics.map((t) => [t.id, { title: t.title, kind: "topic" as const }] as const),
    ...c.products.map((p) => [p.id, { title: p.name, kind: "product" as const }] as const),
  ]);
  const perFolder = new Map<string, number>();
  for (const f of c.films) perFolder.set(f.folder, (perFolder.get(f.folder) ?? 0) + 1);
  const ordered = [...c.films].sort((a, b) => a.made.localeCompare(b.made) || a.folder.localeCompare(b.folder) || (a.narrator ?? "").localeCompare(b.narrator ?? ""));

  return ordered.map((raw, i) => {
    const pubs = c.publications.filter((p) => {
      const t = pubTarget(p);
      return t.folder === raw.folder && (!raw.narrator || !t.narrator || t.narrator === raw.narrator);
    });
    const yt = pubs.find((p) => p.platform === "youtube" && p.link);
    const ig = pubs.find((p) => p.platform === "instagram" && p.link);
    const daily: DailyViews[] = [];
    for (const s of c.snapshots) {
      for (const [platform, pub, rows] of [
        ["youtube", yt, s.youtube],
        ["instagram", ig, s.instagram],
      ] as const) {
        if (!pub) continue;
        const row = rows.find((r) => r.pub.link === pub.link);
        if (row?.views !== undefined) daily.push({ platform, day: daysBetween(pub.date, s.measuredAt), views: row.views });
      }
    }
    const ledger = c.ledger.filter((r) => r.film === raw.folder && (!raw.narrator || r.narrator === raw.narrator));
    const card = titles.get(raw.cardId);
    const series = raw.script.series ?? 1;
    const narrator = c.config.narrators.find((n) => n.id === raw.narrator);
    return {
      id: (perFolder.get(raw.folder) ?? 0) > 1 && raw.narrator ? `${raw.folder}--${raw.narrator}` : raw.folder,
      number: i + 1,
      folder: raw.folder,
      made: raw.made,
      cardId: raw.cardId,
      kind: card?.kind ?? raw.script.input.kind,
      title: card?.title ?? raw.cardId,
      format: raw.script.format,
      series,
      seriesTitle: c.config.series[String(series)] ?? "",
      channel: pubs[0]?.channel,
      narrator: raw.narrator,
      narratorName: narrator?.name,
      stage: stageOf(raw, pubs),
      durationS: raw.compose ? raw.compose.durationInFrames / FPS : undefined,
      compose: raw.compose,
      qa: raw.qa,
      publications: pubs,
      latest: {
        youtube: yt ? latestRow(c.snapshots, (s) => s.youtube, yt.link) : undefined,
        instagram: ig ? latestRow(c.snapshots, (s) => s.instagram, ig.link) : undefined,
      },
      daily,
      voice: {
        chars: ledger.reduce((s, r) => s + r.chars, 0),
        full: ledger.filter((r) => r.kind === "full").length,
        takes: ledger.filter((r) => r.kind === "take").length,
        cached: ledger.filter((r) => r.kind === "cache").length,
      },
    };
  });
}

/** Views across platforms in the latest snapshot (YouTube + Instagram; TikTok has no API). */
export const filmViews = (f: Film): number => (f.latest.youtube?.views ?? 0) + (f.latest.instagram?.views ?? 0);
