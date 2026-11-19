import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { buildComposeProps } from "./compose/props.js";
import { FPS } from "./compose/types.js";
import { formatCheck } from "./lib/cards.js";
import { loadConfig } from "./lib/config.js";
import { FORMATS, type Format } from "@shorts/schema";
import { mp4Duration } from "./lib/mp4.js";
import { narratorChoices, narratorIds, parseNarratorArg } from "./lib/narrators.js";
import { rel } from "./lib/paths.js";
import { checkScript, videoDir } from "./lib/scripts.js";
import { checkTopic } from "./lib/topics.js";
import { voiceFiles, type VoiceTimings } from "./steps/voice.js";

const help = () => `Usage: pnpm compose --topic <id> --format F5 --narrator <${narratorChoices()}> [--publish YYYY-MM-DD] [--still <s>]

Compose step: renders a 1080×1920 video in Remotion from the clips, the narrator audio and the overlays.
Needs: script.json, clips in scenes/ and narrator audio (pnpm make … --narrator).
  --publish   publish date; overlays with {yesterday} show the day before (default: today)
  --still     instead of a video: PNG frames at the given seconds, e.g. 1,5.5 (quick preview)
Output: out/<video>/final-<narrator>.mp4 (or still-<narrator>-<s>.png)`;

const ENTRY = fileURLToPath(new URL("./compose/index.ts", import.meta.url));

async function main(argv: string[]): Promise<number> {
  const args = argv[0] === "--" ? argv.slice(1) : argv;
  let values;
  try {
    ({ values } = parseArgs({
      args,
      strict: true,
      options: {
        topic: { type: "string", short: "t" },
        format: { type: "string", short: "f" },
        narrator: { type: "string", short: "n" },
        publish: { type: "string" },
        still: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    }));
  } catch (err) {
    console.error(`Invalid arguments: ${(err as Error).message}\n\n${help()}`);
    return 1;
  }
  if (values.help) {
    console.log(help());
    return 0;
  }
  const format = values.format?.toUpperCase();
  const narrators = parseNarratorArg(values.narrator) ?? [];
  const publish = values.publish ? new Date(`${values.publish}T12:00:00Z`) : new Date();
  const stills = values.still !== undefined ? values.still.split(",").map(Number) : undefined;
  const problems: string[] = [];
  if (!values.topic) problems.push("missing --topic");
  if (!format || !(FORMATS as readonly string[]).includes(format)) problems.push("missing or invalid --format");
  if (narrators.length === 0) problems.push(`--narrator: ${[...narratorIds(), "all"].join(", ")}`);
  if (Number.isNaN(publish.getTime())) problems.push("--publish as YYYY-MM-DD");
  if (stills && !stills.every((s) => s >= 0)) problems.push("--still: comma-separated seconds, e.g. 1,5.5");
  if (problems.length) {
    console.error(`Invalid arguments:\n  - ${problems.join("\n  - ")}\n\n${help()}`);
    return 1;
  }

  const input = { kind: "topic" as const, id: values.topic! };
  const topic = checkTopic(input.id);
  if (topic.errors.length) {
    console.log(formatCheck(topic));
    return 1;
  }
  const { dir, exists } = videoDir(input.id, format as Format);
  if (!exists) {
    console.error(`No video folder – run pnpm make --topic ${input.id} --format ${format} first`);
    return 1;
  }
  const sc = checkScript(dir, { input, format: format as Format, card: topic.card });
  if (sc.errors.length || !sc.card) {
    console.log(formatCheck(sc));
    return 1;
  }
  const script = sc.card;

  const clipDurations: Record<string, number> = {};
  script.scenes.forEach((s, i) => {
    if (s.kind !== "video") return;
    const relPath = `scenes/${String(i + 1).padStart(2, "0")}.mp4`;
    const file = path.join(dir, relPath);
    const d = existsSync(file) ? mp4Duration(file) : null;
    if (d !== null) clipDurations[relPath] = d;
  });

  console.log("Bundling the Remotion project…");
  const serveUrl = await bundle({
    entryPoint: ENTRY,
    publicDir: dir,
    // Imports with a .js extension (NodeNext) point to .ts/.tsx files.
    webpackOverride: (c) => ({ ...c, resolve: { ...c.resolve, extensionAlias: { ".js": [".tsx", ".ts", ".js"] } } }),
  });

  for (const id of narrators) {
    const vf = voiceFiles(dir, id);
    if (!existsSync(vf.timings)) {
      console.error(`No narrator audio for ${id} – pnpm make --topic ${input.id} --format ${format} --narrator ${id}`);
      return 1;
    }
    const voice = JSON.parse(readFileSync(vf.timings, "utf8")) as VoiceTimings;
    const series = script.series ?? 1;
    const { props, warnings } = buildComposeProps({
      script,
      voice,
      audioSrc: `voice/${id}.mp3`,
      clipDurations,
      publishDate: publish,
      series,
      seriesTitle: loadConfig().series[String(series)] ?? "",
      sourceLabel: loadConfig().sourceLabel,
    });
    for (const w of warnings) console.log(`  ! ${w}`);

    const composition = await selectComposition({ serveUrl, id: "FilmF5", inputProps: props });
    if (stills) {
      for (const s of stills) {
        const out = path.join(dir, `still-${id}-${s}.png`);
        const frame = Math.min(Math.round(s * FPS), props.durationInFrames - 1);
        await renderStill({ composition, serveUrl, inputProps: props, output: out, frame });
        console.log(`Frame: ${rel(out)}`);
      }
      continue;
    }
    console.log(`Scenes (s): ${props.scenes.map((s) => (s.from / FPS).toFixed(1)).join(" · ")} · end ${(props.durationInFrames / FPS).toFixed(1)}`);
    const out = path.join(dir, `final-${id}.mp4`);
    let last = -1;
    await renderMedia({
      composition,
      serveUrl,
      inputProps: props,
      codec: "h264",
      outputLocation: out,
      onProgress: ({ progress }) => {
        const pct = Math.floor(progress * 10) * 10;
        if (pct !== last) {
          last = pct;
          process.stdout.write(`${pct}% `);
        }
      },
    });
    console.log(`\nVideo: ${rel(out)} · ${(props.durationInFrames / FPS).toFixed(1)} s`);
  }
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => (process.exitCode = code),
  (err) => {
    console.error(`Error: ${(err as Error).message}`);
    process.exitCode = 1;
  },
);
