import { parseCsv, PUBLICATION_COLUMNS, type IgAccountStats, type IgMediaStats, type Publication, type YtChannelStats, type YtVideoStats } from "@shorts/schema";
import type { FetchFn } from "./ig-publish.js";
import { GRAPH } from "./ig-publish.js";
import { API as YT_API, type YtFetch } from "./yt-publish.js";

/**
 * Stats of published videos. Read-only.
 * - YouTube Data API: views, likes, comments, channel subscribers (right away).
 * - YouTube Analytics API: % viewed, average view duration, shares, subscribers gained
 *   (scope `yt-analytics.readonly`; data arrives with a delay of about 1–2 days).
 * - Instagram Graph API: likes and comments from the media list, the rest from `/insights`
 *   (needs the `instagram_manage_insights` permission on the token).
 * TikTok – no API without an app audit; numbers are entered by hand.
 */
export const YT_ANALYTICS = "https://youtubeanalytics.googleapis.com/v2/reports";
export const YT_ANALYTICS_METRICS = ["views", "averageViewPercentage", "averageViewDuration", "likes", "comments", "shares", "subscribersGained"] as const;
/** Reels metrics in `/insights` (`plays` was replaced by `views`). */
export const IG_REEL_METRICS = ["views", "reach", "likes", "comments", "shares", "saved", "total_interactions", "ig_reels_avg_watch_time"] as const;

// ---------- publications.csv ----------

export { PUBLICATION_COLUMNS };
export type { IgAccountStats, IgMediaStats, Publication, YtChannelStats, YtVideoStats };

export { parseCsv };

export function readPublications(csv: string): Publication[] {
  const [head, ...rows] = parseCsv(csv.replace(/^﻿/, ""));
  if (!head) return [];
  const col = (name: string) => head.indexOf(name);
  for (const n of PUBLICATION_COLUMNS) if (col(n) < 0) throw new Error(`publications.csv: missing column ${n}`);
  return rows.map((r) => ({
    date: r[col("date")] ?? "",
    platform: (r[col("platform")] ?? "").toLowerCase(),
    channel: (r[col("channel")] ?? "").toLowerCase(),
    file: r[col("file")] ?? "",
    link: r[col("link")] ?? "",
    status: r[col("status")] ?? "",
  }));
}

/** Video ID from a YouTube URL (shorts/, watch?v=, youtu.be/). */
export function youtubeId(link: string): string | undefined {
  return link.match(/(?:shorts\/|[?&]v=|youtu\.be\/)([\w-]{11})/)?.[1];
}

/** Post code from an Instagram URL (/reel/<code>/ or /p/<code>/). */
export function instagramCode(link: string): string | undefined {
  return link.match(/instagram\.com\/(?:[\w.]+\/)?(?:reels?|p)\/([\w-]+)/)?.[1];
}

// ---------- YouTube ----------

async function ytJson<T>(where: string, res: Awaited<ReturnType<YtFetch>>): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; errors?: { reason?: string }[] } };
  if (!res.ok) {
    const reason = data.error?.errors?.[0]?.reason;
    throw new Error(`YouTube ${where}: ${data.error?.message ?? `HTTP ${res.status}`}${reason ? ` (${reason})` : ""}`);
  }
  return data;
}

const num = (v: unknown): number | undefined => (v === undefined || v === null || v === "" ? undefined : Number(v));

export async function ytChannelStats(token: string, f: YtFetch = fetch as unknown as YtFetch): Promise<YtChannelStats> {
  const r = await ytJson<{ items?: { id: string; snippet: { title: string }; statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string } }[] }>(
    "channel",
    await f(`${YT_API}/channels?part=snippet,statistics&mine=true`, { headers: { Authorization: `Bearer ${token}` } }),
  );
  const it = r.items?.[0];
  if (!it) throw new Error("YouTube channel: the token has no channel.");
  return { id: it.id, title: it.snippet.title, subscribers: num(it.statistics?.subscriberCount), views: num(it.statistics?.viewCount), videos: num(it.statistics?.videoCount) };
}

/** Public video counters (Data API). Up to 50 IDs at once. */
export async function ytVideoStats(token: string, ids: string[], f: YtFetch = fetch as unknown as YtFetch): Promise<YtVideoStats[]> {
  if (!ids.length) return [];
  const r = await ytJson<{ items?: { id: string; snippet?: { title?: string; publishedAt?: string }; status?: { privacyStatus?: string }; statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } }[] }>(
    "videos",
    await f(`${YT_API}/videos?part=snippet,status,statistics&id=${ids.slice(0, 50).join(",")}`, { headers: { Authorization: `Bearer ${token}` } }),
  );
  return (r.items ?? []).map((v) => ({
    id: v.id,
    title: v.snippet?.title,
    publishedAt: v.snippet?.publishedAt,
    privacy: v.status?.privacyStatus,
    views: num(v.statistics?.viewCount),
    likes: num(v.statistics?.likeCount),
    comments: num(v.statistics?.commentCount),
  }));
}

export function ytAnalyticsUrl(ids: string[], startDate: string, endDate: string): string {
  const p = new URLSearchParams({
    ids: "channel==MINE",
    startDate,
    endDate,
    metrics: YT_ANALYTICS_METRICS.join(","),
    dimensions: "video",
    filters: `video==${ids.join(",")}`,
  });
  return `${YT_ANALYTICS}?${p}`;
}

/** % viewed and the rest from YouTube Analytics, by video ID. */
export async function ytAnalytics(token: string, ids: string[], startDate: string, endDate: string, f: YtFetch = fetch as unknown as YtFetch): Promise<Map<string, Partial<YtVideoStats>>> {
  const out = new Map<string, Partial<YtVideoStats>>();
  if (!ids.length) return out;
  const r = await ytJson<{ columnHeaders?: { name: string }[]; rows?: (string | number)[][] }>(
    "Analytics",
    await f(ytAnalyticsUrl(ids, startDate, endDate), { headers: { Authorization: `Bearer ${token}` } }),
  );
  const cols = (r.columnHeaders ?? []).map((c) => c.name);
  for (const row of r.rows ?? []) {
    const get = (n: string) => num(row[cols.indexOf(n)]);
    out.set(String(row[cols.indexOf("video")]), {
      avgViewPercent: get("averageViewPercentage"),
      avgViewSeconds: get("averageViewDuration"),
      shares: get("shares"),
      subscribersGained: get("subscribersGained"),
    });
  }
  return out;
}

// ---------- Instagram ----------

interface IgError {
  error?: { message?: string; code?: number };
}

async function igGet<T>(f: FetchFn, base: string, path: string, token: string, params: Record<string, string>): Promise<T> {
  const res = await f(`${base}${path}?${new URLSearchParams({ ...params, access_token: token })}`, { method: "GET" });
  const data = (await res.json().catch(() => ({}))) as T & IgError;
  if (!res.ok || data.error) throw new Error(`Instagram ${path.split("/").at(-1) || path}: ${data.error?.message ?? `HTTP ${res.status}`}${data.error?.code ? ` (code ${data.error.code})` : ""}`);
  return data;
}

export async function igAccountStats(token: string, userId: string, f: FetchFn = fetch as unknown as FetchFn, base = GRAPH): Promise<IgAccountStats> {
  const r = await igGet<{ username?: string; followers_count?: number; media_count?: number }>(f, base, `/${userId}`, token, { fields: "username,followers_count,media_count" });
  return { username: r.username, followers: r.followers_count, mediaCount: r.media_count };
}

/** The account's latest posts (up to 50) with likes and comments – works without the insights permission. */
export async function igMedia(token: string, userId: string, f: FetchFn = fetch as unknown as FetchFn, base = GRAPH): Promise<IgMediaStats[]> {
  const r = await igGet<{ data?: { id: string; permalink: string; timestamp?: string; like_count?: number; comments_count?: number }[] }>(f, base, `/${userId}/media`, token, {
    fields: "id,permalink,timestamp,like_count,comments_count",
    limit: "50",
  });
  return (r.data ?? []).map((m) => ({ id: m.id, permalink: m.permalink, timestamp: m.timestamp, likes: m.like_count, comments: m.comments_count }));
}

/** Reel stats from `/insights` (needs `instagram_manage_insights`). */
export async function igInsights(token: string, mediaId: string, f: FetchFn = fetch as unknown as FetchFn, base = GRAPH): Promise<Partial<IgMediaStats>> {
  const r = await igGet<{ data?: { name: string; values?: { value?: number }[]; total_value?: { value?: number } }[] }>(f, base, `/${mediaId}/insights`, token, {
    metric: IG_REEL_METRICS.join(","),
  });
  const m = new Map((r.data ?? []).map((d) => [d.name, d.total_value?.value ?? d.values?.[0]?.value]));
  const ms = m.get("ig_reels_avg_watch_time");
  return {
    views: m.get("views"),
    reach: m.get("reach"),
    likes: m.get("likes"),
    comments: m.get("comments"),
    shares: m.get("shares"),
    saved: m.get("saved"),
    totalInteractions: m.get("total_interactions"),
    avgWatchSeconds: ms === undefined ? undefined : ms / 1000,
  };
}

/** Whether the error means a missing insights permission (code 10 / 200 / 190 or "permission"). */
export function isPermissionError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /\(code (10|200|190)\)|permission|insufficient/i.test(msg);
}

// ---------- output ----------

/** Number for the table: 1131 → "1131", 57.04 → "57.0"; missing → "–". */
export function fmt(v: number | undefined, digits = 0): string {
  if (v === undefined || Number.isNaN(v)) return "–";
  return v.toFixed(digits);
}

export function mdTable(head: string[], rows: string[][]): string {
  const line = (cells: string[]) => `| ${cells.join(" | ")} |`;
  return [line(head), line(head.map(() => "---")), ...rows.map(line)].join("\n");
}
