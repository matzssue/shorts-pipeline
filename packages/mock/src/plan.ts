/**
 * The mock season: which videos exist, when they were made and published, and which deliberate
 * edge cases (scenarios) each one carries. Everything else is derived from the seed.
 */

export const SEASON = { start: "2026-01-05", end: "2026-02-15" } as const;
/** Time of day of every stats snapshot. */
export const MEASURED_AT_TIME = "09:30:00.000Z";

export type Platform = "youtube" | "instagram" | "tiktok";

export type Stage =
  /** script.json only – waiting for the narration */
  | "scripted"
  /** + narration – waiting for the clips */
  | "narrated"
  /** + compose and QA with an error */
  | "qaFailed"
  /** + compose and passed QA, not published yet */
  | "qaPassed"
  | "published";

export interface FilmPlan {
  /** Index into TOPICS (kind "topic") or PRODUCTS (kind "product"). */
  kind: "topic" | "product";
  index: number;
  format: "F5" | "F1";
  /** Folder date (script made). */
  made: string;
  channel: "a" | "b";
  narrator: "narrator-a" | "narrator-b";
  series: 1 | 2;
  stage: Stage;
  publish?: { date: string; platforms: Platform[] };
  /** Deliberate edge cases, see SCENARIOS. */
  hit?: boolean;
  slowClip?: boolean;
  takes?: boolean;
  cache?: boolean;
}

const yt_ig: Platform[] = ["youtube", "instagram"];
const all: Platform[] = ["youtube", "instagram", "tiktok"];

export const FILMS: FilmPlan[] = [
  { kind: "topic", index: 0, format: "F5", made: "2026-01-05", channel: "a", narrator: "narrator-a", series: 1, stage: "published", publish: { date: "2026-01-06", platforms: all } },
  { kind: "topic", index: 1, format: "F5", made: "2026-01-07", channel: "b", narrator: "narrator-b", series: 2, stage: "published", publish: { date: "2026-01-08", platforms: yt_ig } },
  { kind: "topic", index: 2, format: "F5", made: "2026-01-09", channel: "a", narrator: "narrator-a", series: 1, stage: "published", publish: { date: "2026-01-10", platforms: all }, hit: true },
  { kind: "topic", index: 3, format: "F5", made: "2026-01-11", channel: "b", narrator: "narrator-b", series: 1, stage: "published", publish: { date: "2026-01-12", platforms: yt_ig }, takes: true },
  { kind: "topic", index: 4, format: "F5", made: "2026-01-13", channel: "a", narrator: "narrator-a", series: 2, stage: "published", publish: { date: "2026-01-14", platforms: all } },
  { kind: "topic", index: 5, format: "F5", made: "2026-01-16", channel: "b", narrator: "narrator-b", series: 1, stage: "published", publish: { date: "2026-01-17", platforms: ["youtube"] } },
  { kind: "topic", index: 6, format: "F5", made: "2026-01-18", channel: "a", narrator: "narrator-a", series: 1, stage: "published", publish: { date: "2026-01-19", platforms: yt_ig }, slowClip: true },
  { kind: "topic", index: 7, format: "F5", made: "2026-01-21", channel: "b", narrator: "narrator-b", series: 2, stage: "published", publish: { date: "2026-01-22", platforms: all } },
  { kind: "topic", index: 8, format: "F5", made: "2026-01-24", channel: "a", narrator: "narrator-a", series: 1, stage: "published", publish: { date: "2026-01-25", platforms: yt_ig }, cache: true },
  { kind: "topic", index: 9, format: "F5", made: "2026-01-27", channel: "b", narrator: "narrator-b", series: 1, stage: "published", publish: { date: "2026-01-28", platforms: all } },
  { kind: "topic", index: 10, format: "F5", made: "2026-01-31", channel: "a", narrator: "narrator-a", series: 2, stage: "published", publish: { date: "2026-02-01", platforms: yt_ig } },
  { kind: "topic", index: 11, format: "F5", made: "2026-02-04", channel: "b", narrator: "narrator-b", series: 1, stage: "published", publish: { date: "2026-02-05", platforms: all } },
  { kind: "topic", index: 12, format: "F5", made: "2026-02-08", channel: "a", narrator: "narrator-a", series: 1, stage: "published", publish: { date: "2026-02-09", platforms: yt_ig } },
  { kind: "topic", index: 13, format: "F5", made: "2026-02-13", channel: "b", narrator: "narrator-b", series: 2, stage: "published", publish: { date: "2026-02-14", platforms: all } },
  { kind: "topic", index: 14, format: "F5", made: "2026-02-14", channel: "a", narrator: "narrator-a", series: 1, stage: "qaFailed" },
  { kind: "topic", index: 15, format: "F5", made: "2026-02-15", channel: "b", narrator: "narrator-b", series: 1, stage: "qaPassed" },
  { kind: "topic", index: 16, format: "F5", made: "2026-02-15", channel: "a", narrator: "narrator-a", series: 2, stage: "narrated" },
  { kind: "product", index: 0, format: "F1", made: "2026-02-15", channel: "a", narrator: "narrator-a", series: 1, stage: "scripted" },
];

/** Days the Instagram token had no insights permission: snapshots carry a note and no Reels insights. */
export const IG_NO_INSIGHTS_DAYS = ["2026-01-18", "2026-01-19", "2026-01-20"];
