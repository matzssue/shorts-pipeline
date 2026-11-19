import { FLOW_CREDITS_PER_S_720P } from "@shorts/schema/video";
import { filmViews, type Film } from "../join";
import type { Catalog } from "../load";

/*
 * The Costs view, in the units the pipeline records: narration characters (voice-ledger.csv) and
 * video generator credits (seconds of generated clips × the 720p rate). No money: no price is recorded.
 */

export interface FilmCost {
  id: string;
  number: number;
  title: string;
  /** Characters of full recordings and of scene retakes; cache hits cost 0 and are only counted. */
  full: number;
  takes: number;
  cached: number;
}

export interface CostsPage {
  total: number;
  takes: number;
  cacheHits: number;
  /** Videos with a full recording. */
  narrated: number;
  perFilm: FilmCost[];
  months: { month: string; used: number }[];
  limit?: number;
  narrators: { id: string; name: string; model: string; videos: number; chars: number; seconds: number; takes: number }[];
  credits: { id: string; number: number; title: string; clipSeconds: number; credits: number; made: boolean }[];
  perThousand: { id: string; number: number; title: string; chars: number; views: number; value: number }[];
}

export function costsPage(c: Catalog, films: Film[]): CostsPage {
  const ofFilm = (f: Film) => c.ledger.filter((r) => r.film === f.folder && (!f.narrator || r.narrator === f.narrator));
  const perFilm: FilmCost[] = films
    .map((f) => {
      const rows = ofFilm(f);
      const sum = (k: string) => rows.filter((r) => r.kind === k).reduce((s, r) => s + r.chars, 0);
      return { id: f.id, number: f.number, title: f.title, full: sum("full"), takes: sum("take"), cached: rows.filter((r) => r.kind === "cache").length };
    })
    .filter((x) => x.full + x.takes + x.cached > 0);

  const monthly = new Map<string, number>();
  for (const r of c.ledger) monthly.set(r.date.slice(0, 7), (monthly.get(r.date.slice(0, 7)) ?? 0) + r.chars);

  const narrators = c.config.narrators
    .map((n) => {
      const mine = films.filter((f) => f.narrator === n.id && ofFilm(f).length);
      const rows = c.ledger.filter((r) => r.narrator === n.id);
      return {
        id: n.id,
        name: n.name,
        model: n.model,
        videos: mine.length,
        chars: rows.reduce((s, r) => s + r.chars, 0),
        // seconds of finished video narrated by this voice (rendered videos only)
        seconds: mine.reduce((s, f) => s + (f.durationS ?? 0), 0),
        takes: rows.filter((r) => r.kind === "take").length,
      };
    })
    .filter((n) => n.videos > 0);

  const credits = films.map((f) => {
    const raw = c.films.find((r) => r.folder === f.folder && (r.narrator ?? "") === (f.narrator ?? ""))!;
    const clipSeconds = raw.script.scenes.filter((s) => s.kind === "video").reduce((s, x) => s + x.duration_s, 0);
    return { id: f.id, number: f.number, title: f.title, clipSeconds, credits: clipSeconds * FLOW_CREDITS_PER_S_720P, made: !!f.compose };
  });

  const perThousand = films
    .filter((f) => f.stage === "published" && filmViews(f) > 0)
    .map((f) => {
      const chars = ofFilm(f).reduce((s, r) => s + r.chars, 0);
      const views = filmViews(f);
      return { id: f.id, number: f.number, title: f.title, chars, views, value: (chars / views) * 1000 };
    })
    .sort((a, b) => a.value - b.value);

  return {
    total: c.ledger.reduce((s, r) => s + r.chars, 0),
    takes: c.ledger.filter((r) => r.kind === "take").reduce((s, r) => s + r.chars, 0),
    cacheHits: c.ledger.filter((r) => r.kind === "cache").length,
    narrated: perFilm.filter((x) => x.full > 0).length,
    perFilm,
    months: [...monthly].sort(([a], [b]) => a.localeCompare(b)).map(([month, used]) => ({ month, used })),
    limit: c.config.voiceCharsPerMonth,
    narrators,
    credits,
    perThousand,
  };
}
