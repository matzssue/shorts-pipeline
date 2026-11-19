import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { channelChoices, envName, getChannel } from "./lib/channels.js";
import type { ChannelConfig } from "./lib/config.js";
import { loadConfig } from "./lib/config.js";
import { loadEnv, requireEnv } from "./lib/env.js";
import { mp4Info } from "./lib/mp4.js";
import { CONTENT_DIR, rel } from "./lib/paths.js";
import { buildVideoResource, refreshAccessToken, YtClient, type Playlist } from "./steps/yt-publish.js";

const help = () => `Usage:
  pnpm yt-publish --channel <${channelChoices()}> --check
  pnpm yt-publish --channel <${channelChoices()}> --video <file.mp4> --title "<title>" (--meta <meta.json> | --description "<text>" [--hashtags "#a #b"])
                  [--tags "a,b"] [--playlist "<name or ID>"] [--category <id>] [--publish-at <ISO>] [--confirm]

Uploads a Short to YouTube through the API. Hard-coded: altered or synthetic content = yes, not made for kids.
Without --confirm: preview only – nothing is sent.

  --channel     channel ID from shorts.config.json (sign in: pnpm yt-auth --channel <id>)
  --check       checks the token: channel and playlists (no upload)
  --video       vertical MP4 from out/ (up to 3 min → Short)
  --title       title (max 100 characters)
  --meta        meta-<narrator>.json from pnpm qa (uses caption and hashtags)
  --description description (when there is no meta.json)
  --hashtags    hashtags for --description, space-separated (the first 3 show above the title)
  --tags        search tags, comma-separated (optional)
  --playlist    series playlist – name (as in YouTube Studio) or ID
  --category    category ID (default: youtubeCategoryId of the channel)
  --publish-at  schedule (e.g. 2027-01-16T18:00:00+01:00) – the video stays private until then
  --confirm     really publish – only after the owner approved THIS video`;

function fail(msg: string): never {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

function resolveFile(p: string): string {
  const f = [path.resolve(p), path.resolve(CONTENT_DIR, p)].find((c) => existsSync(c));
  if (!f) fail(`file not found: ${p}`);
  return f;
}

async function connect(ch: ChannelConfig): Promise<{ yt: YtClient; expectedId: string | undefined }> {
  const oauth = { clientId: requireEnv("YT_CLIENT_ID"), clientSecret: requireEnv("YT_CLIENT_SECRET") };
  const token = await refreshAccessToken(oauth, requireEnv(envName("YT_REFRESH_TOKEN", ch.id)));
  return { yt: new YtClient(token), expectedId: process.env[envName("YT_CHANNEL_ID", ch.id)] };
}

function findPlaylist(list: Playlist[], q: string): Playlist {
  const p = list.find((x) => x.id === q) ?? list.find((x) => x.title.toLowerCase() === q.toLowerCase());
  if (!p) fail(`no playlist "${q}". Available: ${list.map((x) => `"${x.title}"`).join(", ") || "none"}`);
  return p;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      help: { type: "boolean", short: "h" },
      channel: { type: "string" },
      check: { type: "boolean" },
      video: { type: "string" },
      title: { type: "string" },
      meta: { type: "string" },
      description: { type: "string" },
      hashtags: { type: "string" },
      tags: { type: "string" },
      playlist: { type: "string" },
      category: { type: "string" },
      "publish-at": { type: "string" },
      confirm: { type: "boolean" },
    },
    strict: true,
  });
  if (values.help) return void console.log(help());
  loadEnv();
  let ch: ChannelConfig;
  try {
    ch = getChannel(values.channel);
  } catch (e) {
    fail(`${(e as Error).message}\n\n${help()}`);
  }

  if (values.check) {
    const { yt, expectedId } = await connect(ch);
    const c = await yt.channel();
    console.log(`Channel ${ch.id}: ${c.title} ${c.customUrl ?? ""} · id ${c.id}`);
    if (expectedId && expectedId !== c.id) console.log(`WARNING: the token is for a different channel than ${envName("YT_CHANNEL_ID", ch.id)}.`);
    const pl = await yt.playlists();
    console.log(`Playlists: ${pl.map((p) => `"${p.title}"`).join(", ") || "none"}`);
    return;
  }

  if (!values.video) fail(`missing --video\n\n${help()}`);
  if (!values.title) fail("missing --title");
  if (values.meta && values.description) fail("give --meta or --description, not both");
  if (!values.meta && !values.description) fail("no description: --meta or --description");

  const video = resolveFile(values.video);
  if (path.extname(video).toLowerCase() !== ".mp4") fail("the video must be .mp4");
  let description: string;
  let hashtags: string[] | undefined;
  if (values.meta) {
    const meta = JSON.parse(readFileSync(resolveFile(values.meta), "utf8")) as { caption?: string; hashtags?: string[]; labels?: { ai_generated?: boolean } };
    if (!meta.caption) fail("meta.json has no caption field");
    if (meta.labels?.ai_generated === false) fail("meta.json has ai_generated=false – these videos are always labelled as AI");
    description = meta.caption;
    hashtags = meta.hashtags;
  } else {
    description = values.description!;
    hashtags = values.hashtags?.split(/\s+/);
  }
  const resource = buildVideoResource({
    title: values.title,
    description,
    hashtags,
    tags: values.tags?.split(","),
    categoryId: values.category ?? ch.youtubeCategoryId,
    publishAt: values["publish-at"],
    language: loadConfig().language,
  });

  const info = mp4Info(video);
  if (info.duration && info.duration > 180) fail(`the video is ${info.duration.toFixed(0)} s – a Short is max 3 min`);
  const size = statSync(video).size;

  const hasToken = Boolean(process.env.YT_CLIENT_ID && process.env.YT_CLIENT_SECRET && process.env[envName("YT_REFRESH_TOKEN", ch.id)]);
  if (values.confirm && !hasToken) await connect(ch); // throws with the name of the missing variable
  const conn = hasToken ? await connect(ch) : undefined;
  const channel = conn ? await conn.yt.channel() : undefined;
  if (channel && conn?.expectedId && conn.expectedId !== channel.id) fail(`the token points to channel "${channel.title}", but ${envName("YT_CHANNEL_ID", ch.id)} is different – sign in again: pnpm yt-auth --channel ${ch.id}`);
  const playlist = values.playlist && conn ? findPlaylist(await conn.yt.playlists(), values.playlist) : undefined;

  console.log("── Preview ──");
  console.log(channel ? `Channel:   ${channel.title} ${channel.customUrl ?? ""}` : "Channel:   (no token in .env – preview without a channel)");
  console.log(`Video:     ${rel(video)} · ${info.duration?.toFixed(1) ?? "?"} s · ${info.width ?? "?"}×${info.height ?? "?"} · ${(size / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Title:     ${resource.snippet.title}`);
  console.log(`Category:  ${resource.snippet.categoryId} · language: ${resource.snippet.defaultLanguage} · tags: ${resource.snippet.tags?.join(", ") ?? "none"}`);
  console.log(`Playlist:  ${playlist ? playlist.title : values.playlist ? `${values.playlist} (checked at upload)` : "none"}`);
  console.log("Labels:    synthetic content (AI) – yes · not made for kids");
  console.log(`Visible:   ${resource.status.publishAt ? `scheduled for ${new Date(resource.status.publishAt).toISOString()}` : "public right away"}`);
  console.log("Description:");
  console.log(resource.snippet.description.split("\n").map((l) => `  ${l}`).join("\n"));
  if (info.width && info.height && info.width >= info.height) console.log("WARNING: the video is not vertical – it will not be a Short.");

  if (!values.confirm || !conn) {
    console.log("\nThat was a preview. To publish: the same command with --confirm (only after the owner approved it).");
    return;
  }

  console.log("\n── Publishing ──");
  const loc = await conn.yt.startUpload(resource, size);
  console.log(`Uploading (${(size / 1024 / 1024).toFixed(1)} MB)…`);
  const { id } = await conn.yt.upload(loc, new Uint8Array(readFileSync(video)));
  if (playlist) {
    await conn.yt.addToPlaylist(playlist.id, id).then(
      () => console.log(`Added to playlist "${playlist.title}".`),
      (e: Error) => console.log(`Uploaded, but the playlist failed: ${e.message} – add it in Studio.`),
    );
  }
  console.log(`\nPublished: https://youtube.com/shorts/${id}`);
  console.log("YouTube is still processing the video – it may show up in a few minutes.");
}

main().catch((e: Error) => fail(e.message));
