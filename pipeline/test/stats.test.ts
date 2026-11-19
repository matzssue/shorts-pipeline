import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FetchFn } from "../src/steps/ig-publish.js";
import { fmt, igInsights, igMedia, instagramCode, isPermissionError, parseCsv, readPublications, ytAnalytics, ytAnalyticsUrl, youtubeId, ytVideoStats } from "../src/steps/stats.js";
import type { YtFetch } from "../src/steps/yt-publish.js";

describe("stats: publications.csv", () => {
  it("CSV parser: quotes, commas inside a field, CRLF", () => {
    assert.deepEqual(parseCsv('a,b\r\n"x, y","z ""q"""\r\n\r\n'), [
      ["a", "b"],
      ["x, y", 'z "q"'],
    ]);
  });
  it("reads rows by column name", () => {
    const csv = "date,platform,channel,format,file,link,status\n2026-11-15,YouTube,B,F5,out/f.mp4,https://youtube.com/shorts/AAAAAAAAAAA,scheduled\n";
    const [p] = readPublications(csv);
    assert.equal(p!.platform, "youtube");
    assert.equal(p!.channel, "b");
    assert.equal(p!.link, "https://youtube.com/shorts/AAAAAAAAAAA");
    assert.throws(() => readPublications("date,platform\n"), /missing column channel/);
  });
  it("IDs from YouTube and Instagram links", () => {
    assert.equal(youtubeId("https://youtube.com/shorts/Abc_123-xyZ"), "Abc_123-xyZ");
    assert.equal(youtubeId("https://www.youtube.com/watch?v=Abc_123-xyZ&t=1"), "Abc_123-xyZ");
    assert.equal(youtubeId("https://youtu.be/Abc_123-xyZ"), "Abc_123-xyZ");
    assert.equal(youtubeId("–"), undefined);
    assert.equal(instagramCode("https://www.instagram.com/reel/Cde_456xyz/"), "Cde_456xyz");
    assert.equal(instagramCode("https://www.instagram.com/example_account/reel/Cde_456xyz/?x=1"), "Cde_456xyz");
  });
  it("fmt: fixed decimals, missing = –", () => {
    assert.equal(fmt(57.04, 1), "57.0");
    assert.equal(fmt(1131), "1131");
    assert.equal(fmt(undefined), "–");
  });
});

function ytFake(json: unknown, calls: string[], status = 200): YtFetch {
  return async (url) => {
    calls.push(url);
    return { ok: status < 400, status, headers: { get: () => null }, json: async () => json };
  };
}

describe("stats: YouTube", () => {
  it("counters from the Data API", async () => {
    const calls: string[] = [];
    const s = await ytVideoStats("t", ["abc"], ytFake({ items: [{ id: "abc", snippet: { title: "T" }, status: { privacyStatus: "public" }, statistics: { viewCount: "1131", likeCount: "5" } }] }, calls));
    assert.deepEqual(s[0], { id: "abc", title: "T", publishedAt: undefined, privacy: "public", views: 1131, likes: 5, comments: undefined });
    assert.match(calls[0]!, /part=snippet,status,statistics&id=abc$/);
  });
  it("Analytics: query by video and columns read by name", async () => {
    const u = new URL(ytAnalyticsUrl(["a1", "b2"], "2026-11-15", "2026-11-16"));
    assert.equal(u.searchParams.get("ids"), "channel==MINE");
    assert.equal(u.searchParams.get("dimensions"), "video");
    assert.equal(u.searchParams.get("filters"), "video==a1,b2");
    assert.match(u.searchParams.get("metrics")!, /averageViewPercentage/);
    const json = {
      columnHeaders: [{ name: "video" }, { name: "views" }, { name: "averageViewPercentage" }, { name: "averageViewDuration" }, { name: "likes" }, { name: "comments" }, { name: "shares" }, { name: "subscribersGained" }],
      rows: [["a1", 427, 57.04, 22, 3, 0, 1, 2]],
    };
    const m = await ytAnalytics("t", ["a1"], "2026-11-15", "2026-11-16", ytFake(json, []));
    assert.deepEqual(m.get("a1"), { avgViewPercent: 57.04, avgViewSeconds: 22, shares: 1, subscribersGained: 2 });
  });
  it("Analytics error with the reason", async () => {
    await assert.rejects(ytAnalytics("t", ["a"], "x", "y", ytFake({ error: { message: "Insufficient Permission", errors: [{ reason: "insufficientPermissions" }] } }, [], 403)), /insufficientPermissions/);
  });
});

function igFake(json: unknown, calls: string[], status = 200): FetchFn {
  return async (url) => {
    calls.push(url);
    return { ok: status < 400, status, json: async () => json };
  };
}

describe("stats: Instagram", () => {
  it("media list and insights (time in ms → s)", async () => {
    const calls: string[] = [];
    const media = await igMedia("tok", "u1", igFake({ data: [{ id: "m1", permalink: "https://www.instagram.com/reel/X/", like_count: 2, comments_count: 1 }] }, calls), "https://g");
    assert.equal(media[0]!.likes, 2);
    assert.match(calls[0]!, /^https:\/\/g\/u1\/media\?fields=/);
    const ins = await igInsights(
      "tok",
      "m1",
      igFake({ data: [{ name: "views", values: [{ value: 142 }] }, { name: "reach", total_value: { value: 120 } }, { name: "ig_reels_avg_watch_time", values: [{ value: 8500 }] }] }, []),
      "https://g",
    );
    assert.equal(ins.views, 142);
    assert.equal(ins.reach, 120);
    assert.equal(ins.avgWatchSeconds, 8.5);
  });
  it("a missing permission is recognised and the token never reaches the error", async () => {
    const err = await igInsights("SECRET", "m1", igFake({ error: { message: "(#10) Application does not have permission for this action", code: 10 } }, [], 400), "https://g").catch((e: Error) => e);
    assert.ok(err instanceof Error);
    assert.ok(isPermissionError(err));
    assert.doesNotMatch(err.message, /SECRET/);
  });
});
