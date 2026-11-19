import { rng } from "./prng.js";

/**
 * Number model for published videos.
 * - views after 14 days: log-normal around a median, with one deliberate hit;
 * - growth: saturation curve with a random time constant (most views in the first days);
 * - likes, comments, shares, subscribers: fixed fractions of views per video;
 * - % viewed falls with the video length.
 */

export const MEDIAN_VIEWS_14D = 800;
export const HIT_FACTOR = 6;
/** YouTube Analytics data arrives with a delay: no Analytics fields for videos this many days old or newer. */
export const ANALYTICS_DELAY_DAYS = 2;

export interface VideoModel {
  views14: number;
  /** Days. */
  tau: number;
  likeRate: number;
  commentRate: number;
  shareRate: number;
  subRate: number;
  avgViewPercent: number;
}

export function videoModel(key: string, durationS: number, opts: { hit?: boolean; platformFactor?: [number, number] } = {}): VideoModel {
  const r = rng(`video:${key}`);
  const [pfMin, pfMax] = opts.platformFactor ?? [1, 1];
  const views14 = r.logNormal(MEDIAN_VIEWS_14D, 0.55) * r.float(pfMin, pfMax) * (opts.hit ? HIT_FACTOR : 1);
  return {
    views14,
    tau: r.float(1.2, 3.5),
    likeRate: r.float(0.02, 0.05),
    commentRate: r.float(0.002, 0.006),
    shareRate: r.float(0.003, 0.01),
    subRate: r.float(0.002, 0.005),
    avgViewPercent: Math.round(Math.min(98, Math.max(35, 92 - 0.9 * durationS + 4 * r.normal())) * 10) / 10,
  };
}

/** Views `days` after publishing (0 → 0), monotone. */
export function viewsAt(m: VideoModel, days: number): number {
  if (days <= 0) return 0;
  return Math.round((m.views14 * (1 - Math.exp(-days / m.tau))) / (1 - Math.exp(-14 / m.tau)));
}

export const share = (views: number, rate: number): number => Math.round(views * rate);
