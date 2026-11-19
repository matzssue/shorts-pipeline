import { z } from "zod";
import { channelId, isoDate } from "./common.js";

/** `data/stats/<date>.json` – one snapshot written by `pnpm stats --save`. */

const count = z.number().int().nonnegative();
const seconds = z.number().nonnegative();

export const ytChannelStatsSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string(),
  subscribers: count.optional(),
  views: count.optional(),
  videos: count.optional(),
});

export const igAccountStatsSchema = z.strictObject({
  username: z.string().optional(),
  followers: count.optional(),
  mediaCount: count.optional(),
});

export const ytVideoStatsSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().optional(),
  publishedAt: z.string().optional(),
  privacy: z.string().optional(),
  views: count.optional(),
  likes: count.optional(),
  comments: count.optional(),
  /** From YouTube Analytics (1–2 days delay). */
  avgViewPercent: z.number().nonnegative().optional(),
  avgViewSeconds: seconds.optional(),
  shares: count.optional(),
  subscribersGained: z.number().int().optional(),
});

export const igMediaStatsSchema = z.strictObject({
  id: z.string().min(1),
  permalink: z.string(),
  timestamp: z.string().optional(),
  likes: count.optional(),
  comments: count.optional(),
  views: count.optional(),
  reach: count.optional(),
  shares: count.optional(),
  saved: count.optional(),
  totalInteractions: count.optional(),
  /** Average watch time in seconds (the API returns ms). */
  avgWatchSeconds: seconds.optional(),
});

/** The publication a stats row belongs to (trimmed in the snapshot). */
const pubRef = z.strictObject({ date: isoDate, channel: channelId, link: z.string() });

export const statsSnapshotSchema = z.strictObject({
  measuredAt: z.iso.datetime(),
  accounts: z.array(
    z.strictObject({
      channel: channelId,
      youtube: ytChannelStatsSchema.optional(),
      instagram: igAccountStatsSchema.optional(),
    }),
  ),
  youtube: z.array(ytVideoStatsSchema.extend({ pub: pubRef })),
  instagram: z.array(igMediaStatsSchema.extend({ pub: pubRef })),
  notes: z.array(z.string()),
});

export type YtChannelStats = z.infer<typeof ytChannelStatsSchema>;
export type IgAccountStats = z.infer<typeof igAccountStatsSchema>;
export type YtVideoStats = z.infer<typeof ytVideoStatsSchema>;
export type IgMediaStats = z.infer<typeof igMediaStatsSchema>;
export type StatsSnapshot = z.infer<typeof statsSnapshotSchema>;
