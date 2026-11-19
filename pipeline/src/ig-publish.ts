import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { channelChoices, envName, getChannel } from "./lib/channels.js";
import type { ChannelConfig } from "./lib/config.js";
import { loadEnv, requireEnv } from "./lib/env.js";
import { mp4Info } from "./lib/mp4.js";
import { CONTENT_DIR, rel } from "./lib/paths.js";
import { buildCaption, createAndUpload, IgClient, readVideo, waitFinished } from "./steps/ig-publish.js";

const help = () => `Usage:
  pnpm ig-publish --channel <${channelChoices()}> --check
  pnpm ig-publish --channel <${channelChoices()}> --video <file.mp4> (--meta <meta.json> | --caption "<text>" [--hashtags "#a #b"]) [--cover-ms <ms>] [--confirm]

Publishes a Reel on Instagram through the API. The AI label ("AI info") is always on.
Without --confirm: preview only (account, file, caption) – nothing is sent.

  --channel     channel ID from shorts.config.json; token from IG_ACCESS_TOKEN_<ID>, IG_USER_ID_<ID>
  --check       checks the token: account and publishing limit (no upload)
  --video       video file (vertical MP4 from out/), uploaded straight from disk
  --meta        meta-<narrator>.json from pnpm qa (uses caption and hashtags)
  --caption     caption (when there is no meta.json)
  --hashtags    hashtags for --caption, space-separated (max 5 – Instagram limit)
  --cover-ms    cover: frame in ms from the start of the video (default: first frame)
  --confirm     really publish – only after the owner approved THIS post`;

function fail(msg: string): never {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

function resolveFile(p: string): string {
  const f = [path.resolve(p), path.resolve(CONTENT_DIR, p)].find((c) => existsSync(c));
  if (!f) fail(`file not found: ${p}`);
  return f;
}

function envKeys(ch: ChannelConfig) {
  return { token: envName("IG_ACCESS_TOKEN", ch.id), user: envName("IG_USER_ID", ch.id) };
}

function client(ch: ChannelConfig): IgClient {
  const k = envKeys(ch);
  return new IgClient(requireEnv(k.token), requireEnv(k.user));
}

async function check(ch: ChannelConfig): Promise<void> {
  const c = client(ch);
  const acc = await c.account();
  console.log(`Channel ${ch.id}: @${acc.username ?? "?"} (${acc.name ?? "?"}) · id ${acc.id}`);
  try {
    const lim = (await c.publishingLimit()).data?.[0];
    if (lim) console.log(`Publishing limit: ${lim.quota_usage ?? 0} / ${lim.config?.quota_total ?? "?"} in 24 h`);
  } catch (e) {
    console.log(`Publishing limit: could not read it (${(e as Error).message})`);
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      help: { type: "boolean", short: "h" },
      channel: { type: "string" },
      check: { type: "boolean" },
      video: { type: "string" },
      meta: { type: "string" },
      caption: { type: "string" },
      hashtags: { type: "string" },
      "cover-ms": { type: "string" },
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
  if (values.check) return check(ch);

  if (!values.video) fail(`missing --video\n\n${help()}`);
  if (values.meta && values.caption) fail("give --meta or --caption, not both");
  if (!values.meta && !values.caption) fail("no caption: --meta or --caption");

  const video = resolveFile(values.video);
  if (path.extname(video).toLowerCase() !== ".mp4") fail("the video must be .mp4");
  let caption: string;
  if (values.meta) {
    const meta = JSON.parse(readFileSync(resolveFile(values.meta), "utf8")) as { caption?: string; hashtags?: string[]; labels?: { ai_generated?: boolean } };
    if (!meta.caption) fail("meta.json has no caption field");
    if (meta.labels?.ai_generated === false) fail("meta.json has ai_generated=false – these videos are always labelled as AI");
    caption = buildCaption({ caption: meta.caption, hashtags: meta.hashtags });
  } else {
    caption = buildCaption({ caption: values.caption!, hashtags: values.hashtags?.split(/\s+/) });
  }

  const info = mp4Info(video);
  let coverMs: number | undefined;
  if (values["cover-ms"] !== undefined) {
    coverMs = Number(values["cover-ms"]);
    if (!Number.isFinite(coverMs) || coverMs < 0) fail("--cover-ms must be a number of ms ≥ 0");
    if (info.duration && coverMs > info.duration * 1000) fail(`--cover-ms is past the end of the video (${info.duration.toFixed(1)} s)`);
  }
  const sizeMb = statSync(video).size / 1024 / 1024;
  const keys = envKeys(ch);
  const hasToken = Boolean(process.env[keys.token] && process.env[keys.user]);
  if (values.confirm && !hasToken) client(ch); // throws with the name of the missing variable
  const c = hasToken ? client(ch) : undefined;
  const acc = c ? await c.account() : undefined;

  console.log("── Preview ──");
  console.log(`Channel:  ${ch.id} (${ch.name})`);
  console.log(acc ? `Account:  @${acc.username ?? "?"} (${acc.name ?? "?"})` : "Account:  (no token in .env – preview without an account)");
  console.log(`Video:    ${rel(video)} · ${info.duration?.toFixed(1) ?? "?"} s · ${info.width ?? "?"}×${info.height ?? "?"} · ${sizeMb.toFixed(1)} MB`);
  console.log("Label:    AI info – on");
  console.log(`Cover:    ${coverMs !== undefined ? `frame at ${(coverMs / 1000).toFixed(1)} s` : "first frame (default)"}`);
  console.log("Caption:");
  console.log(caption.split("\n").map((l) => `  ${l}`).join("\n"));
  if (info.width && info.height && info.width >= info.height) console.log("WARNING: the video is not vertical.");

  if (!values.confirm || !c) {
    console.log("\nThat was a preview. To publish: the same command with --confirm (only after the owner approved it).");
    return;
  }

  console.log("\n── Publishing ──");
  console.log(`Uploading (${sizeMb.toFixed(1)} MB)…`);
  const container = await createAndUpload(c, caption, readVideo(video), {
    coverMs,
    onAttempt: (id, i, err) =>
      console.log(err ? `  [try ${i}] container ${id}: ${err.message}${i < 5 ? " – retrying in 60 s" : ""}` : `  [try ${i}] container ${id}: uploaded`),
  });
  console.log("Instagram is processing the video…");
  await waitFinished(c, container.id, { onTick: (s, i) => console.log(`  [${i}] ${s}`) });
  const { id: mediaId } = await c.publish(container.id);
  const media = await c.media(mediaId).catch(() => ({ id: mediaId, permalink: undefined }));
  console.log(`\nPublished: ${media.permalink ?? `media ${mediaId}`}`);
}

main().catch((e: Error) => fail(e.message));
