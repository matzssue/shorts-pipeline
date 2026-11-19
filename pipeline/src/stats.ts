import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { channelChoices, channelIds, envName, getChannel } from "./lib/channels.js";
import { loadEnv } from "./lib/env.js";
import { DATA_DIR, rel } from "./lib/paths.js";
import {
  fmt,
  igAccountStats,
  igInsights,
  igMedia,
  instagramCode,
  isPermissionError,
  mdTable,
  readPublications,
  ytAnalytics,
  ytChannelStats,
  youtubeId,
  ytVideoStats,
  type IgMediaStats,
  type Publication,
  type YtVideoStats,
} from "./steps/stats.js";
import { refreshAccessToken } from "./steps/yt-publish.js";

const help = () => `Usage:
  pnpm stats [--channel <${channelChoices()}>] [--save]

Fetches stats for the videos listed in data/publications.csv. Read-only – nothing is published or changed.
  YouTube:   views, likes, comments, subscribers (right away);
             % viewed, average duration, shares, subscribers gained (YouTube Analytics, 1–2 days delay).
  Instagram: likes, comments, followers; views, reach, saves, average watch time
             (needs the instagram_manage_insights permission on the token).
  TikTok:    no API – numbers are entered by hand.

  --channel  only this channel; default: all channels from the config
  --save     save the result to data/stats/<date>.json (for week-over-week comparisons and the dashboard)`;

function fail(msg: string): never {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

const today = () => new Date().toISOString().slice(0, 10);

interface YtRow extends YtVideoStats {
  pub: Publication;
}
interface IgRow extends Partial<IgMediaStats> {
  pub: Publication;
}

async function youtube(ch: string, pubs: Publication[], notes: string[]) {
  const id = process.env.YT_CLIENT_ID;
  const secret = process.env.YT_CLIENT_SECRET;
  const refresh = process.env[envName("YT_REFRESH_TOKEN", ch)];
  if (!id || !secret || !refresh) return void notes.push(`YouTube ${ch}: no token in .env – pnpm yt-auth --channel ${ch}`);
  const token = await refreshAccessToken({ clientId: id, clientSecret: secret }, refresh);
  const channel = await ytChannelStats(token);
  const ids = pubs.map((p) => youtubeId(p.link)).filter((x): x is string => Boolean(x));
  const stats = new Map((await ytVideoStats(token, ids)).map((s) => [s.id, s]));
  let analytics = new Map<string, Partial<YtVideoStats>>();
  const start = pubs.map((p) => p.date).filter(Boolean).sort()[0] ?? today();
  try {
    analytics = await ytAnalytics(token, ids, start, today());
    if (ids.length && !analytics.size) notes.push(`YouTube ${ch}: no Analytics data yet (1–2 days delay).`);
  } catch (e) {
    const msg = (e as Error).message;
    notes.push(
      /accessNotConfigured|SERVICE_DISABLED/i.test(msg)
        ? `YouTube ${ch}: YouTube Analytics API is disabled in the Google Cloud project – enable it (APIs & Services → Library → "YouTube Analytics API").`
        : isPermissionError(e) || /scope|403/i.test(msg)
          ? `YouTube ${ch}: no Analytics access – sign in again: pnpm yt-auth --channel ${ch}`
          : `YouTube ${ch}: Analytics – ${msg}`,
    );
  }
  const rows: YtRow[] = pubs.map((pub) => {
    const vid = youtubeId(pub.link);
    return { id: vid ?? "?", ...(vid ? stats.get(vid) : {}), ...(vid ? analytics.get(vid) : {}), pub };
  });
  return { channel, rows };
}

async function instagram(ch: string, pubs: Publication[], notes: string[]) {
  const tokenVar = envName("IG_ACCESS_TOKEN", ch);
  const userVar = envName("IG_USER_ID", ch);
  const token = process.env[tokenVar];
  const user = process.env[userVar];
  if (!token || !user) return void notes.push(`Instagram ${ch}: no ${tokenVar} / ${userVar} in .env`);
  const account = await igAccountStats(token, user);
  const media = await igMedia(token, user);
  const byCode = new Map(media.map((m) => [instagramCode(m.permalink), m]));
  let insightsOk = true;
  const rows: IgRow[] = [];
  for (const pub of pubs) {
    const m = byCode.get(instagramCode(pub.link));
    if (!m) {
      rows.push({ pub });
      continue;
    }
    let ins: Partial<IgMediaStats> = {};
    if (insightsOk) {
      try {
        ins = await igInsights(token, m.id);
      } catch (e) {
        insightsOk = false;
        notes.push(
          isPermissionError(e)
            ? `Instagram ${ch}: the token has no insights permission – generate it again with instagram_manage_insights.`
            : `Instagram ${ch}: insights – ${(e as Error).message}`,
        );
      }
    }
    rows.push({ ...m, ...Object.fromEntries(Object.entries(ins).filter(([, v]) => v !== undefined)), pub });
  }
  return { account, rows };
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { help: { type: "boolean", short: "h" }, channel: { type: "string" }, save: { type: "boolean" } }, strict: true });
  if (values.help) return void console.log(help());
  loadEnv();
  let channels: string[];
  try {
    channels = values.channel ? [getChannel(values.channel).id] : channelIds();
  } catch (e) {
    fail((e as Error).message);
  }
  const csvFile = path.join(DATA_DIR, "publications.csv");
  if (!existsSync(csvFile)) fail(`no ${rel(csvFile)} (columns: date,platform,channel,file,link,status)`);
  const pubs = readPublications(readFileSync(csvFile, "utf8"));

  const notes: string[] = [];
  const yt: Awaited<ReturnType<typeof youtube>>[] = [];
  const ig: Awaited<ReturnType<typeof instagram>>[] = [];
  for (const ch of channels) {
    const mine = (platform: string) => pubs.filter((p) => p.channel === ch && p.platform === platform && p.link);
    yt.push(await youtube(ch, mine("youtube"), notes).catch((e: Error) => void notes.push(`YouTube ${ch}: ${e.message}`)));
    ig.push(await instagram(ch, mine("instagram"), notes).catch((e: Error) => void notes.push(`Instagram ${ch}: ${e.message}`)));
  }

  console.log(`# Stats · ${new Date().toISOString()}\n`);
  console.log("## Accounts\n");
  console.log(
    mdTable(
      ["Channel", "YouTube: subscribers / videos", "Instagram: followers / posts"],
      channels.map((ch, i) => [
        ch,
        yt[i] ? `${fmt(yt[i]!.channel.subscribers)} / ${fmt(yt[i]!.channel.videos)}` : "–",
        ig[i] ? `${fmt(ig[i]!.account.followers)} / ${fmt(ig[i]!.account.mediaCount)}` : "–",
      ]),
    ),
  );

  const ytRows = yt.flatMap((x) => x?.rows ?? []);
  console.log("\n## YouTube\n");
  console.log(
    mdTable(
      ["Date", "Channel", "Video", "Status", "Views", "Likes", "Comm.", "Shares", "% viewed", "Avg s", "+Subs"],
      ytRows.map((r) => [r.pub.date, r.pub.channel, r.title ?? r.pub.link, r.privacy ?? "?", fmt(r.views), fmt(r.likes), fmt(r.comments), fmt(r.shares), fmt(r.avgViewPercent, 1), fmt(r.avgViewSeconds), fmt(r.subscribersGained)]),
    ),
  );

  const igRows = ig.flatMap((x) => x?.rows ?? []);
  console.log("\n## Instagram\n");
  console.log(
    mdTable(
      ["Date", "Channel", "Reel", "Views", "Reach", "Likes", "Comm.", "Shares", "Saves", "Avg s"],
      igRows.map((r) => [r.pub.date, r.pub.channel, r.pub.link, fmt(r.views), fmt(r.reach), fmt(r.likes), fmt(r.comments), fmt(r.shares), fmt(r.saved), fmt(r.avgWatchSeconds, 1)]),
    ),
  );

  console.log("\nTikTok: no API – take the numbers from the app (Studio → Analytics).");
  if (notes.length) console.log(`\nNotes:\n${notes.map((n) => `- ${n}`).join("\n")}`);

  if (values.save) {
    const dir = path.join(DATA_DIR, "stats");
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${today()}.json`);
    const strip = <T extends { pub: Publication }>(r: T) => ({ ...r, pub: { date: r.pub.date, channel: r.pub.channel, link: r.pub.link } });
    writeFileSync(
      file,
      `${JSON.stringify({ measuredAt: new Date().toISOString(), accounts: channels.map((ch, i) => ({ channel: ch, youtube: yt[i]?.channel, instagram: ig[i]?.account })), youtube: ytRows.map(strip), instagram: igRows.map(strip), notes }, null, 2)}\n`,
      "utf8",
    );
    console.log(`\nSaved: ${rel(file)}`);
  }
}

main().catch((e: Error) => fail(e.message));
