import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { formatCheck } from "./lib/cards.js";
import { FORMATS, type Format } from "./lib/formats.js";
import { mp4Info } from "./lib/mp4.js";
import { getNarrator, narratorChoices, narratorIds, parseNarratorArg } from "./lib/narrators.js";
import { rel } from "./lib/paths.js";
import { checkScript, videoDir } from "./lib/scripts.js";
import { checkTopic } from "./lib/topics.js";
import { renderQaMd, runQa } from "./steps/qa.js";
import { voiceFiles, type VoiceTimings } from "./steps/voice.js";

const help = () => `Usage: pnpm qa --topic <id> --format F5 --narrator <${narratorChoices()}>

QA step: automatic checks of the finished video (final-<narrator>.mp4) and a manual checklist before publishing.
Output: out/<video>/qa-<narrator>.md and meta-<narrator>.json (caption, hashtags, labels).
Exit code 1 when any check is an ERROR. Publishing stays manual.`;

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
  const problems: string[] = [];
  if (!values.topic) problems.push("missing --topic");
  if (!format || !(FORMATS as readonly string[]).includes(format)) problems.push("missing or invalid --format");
  if (narrators.length === 0) problems.push(`--narrator: ${[...narratorIds(), "all"].join(", ")}`);
  if (problems.length) {
    console.error(`Invalid arguments:\n  - ${problems.join("\n  - ")}\n\n${help()}`);
    return 1;
  }

  const input = { kind: "topic" as const, id: values.topic! };
  const topic = checkTopic(input.id);
  if (topic.errors.length || !topic.card) {
    console.log(formatCheck(topic));
    return 1;
  }
  const { dir, exists } = videoDir(input.id, format as Format);
  const scriptFile = path.join(dir, "script.json");
  if (!exists || !existsSync(scriptFile)) {
    console.error(`No script – pnpm make --topic ${input.id} --format ${format}`);
    return 1;
  }
  const sc = checkScript(dir, { input, format: format as Format, card: topic.card });
  if (sc.errors.length || !sc.card) {
    console.log(formatCheck(sc));
    return 1;
  }

  let failed = false;
  const now = new Date();
  for (const id of narrators) {
    const narrator = getNarrator(id);
    const vf = voiceFiles(dir, id);
    const videoFile = path.join(dir, `final-${id}.mp4`);
    const voice = existsSync(vf.timings) ? (JSON.parse(readFileSync(vf.timings, "utf8")) as VoiceTimings) : undefined;
    const video = existsSync(videoFile) ? mp4Info(videoFile) : undefined;
    const qaInput = {
      script: sc.card,
      topic: topic.card,
      format: format as Format,
      narrator,
      voice,
      video,
      mtimes: {
        script: statSync(scriptFile).mtimeMs,
        voice: voice ? statSync(vf.audio).mtimeMs : undefined,
        video: video ? statSync(videoFile).mtimeMs : undefined,
      },
    };
    const res = runQa(qaInput);
    const md = path.join(dir, `qa-${id}.md`);
    writeFileSync(md, renderQaMd(qaInput, res, now), "utf8");
    const meta = {
      topic: input.id,
      format,
      narrator: id,
      video: path.basename(videoFile),
      qa_passed: res.passed,
      checked_at: now.toISOString(),
      caption: sc.card.caption,
      hashtags: sc.card.hashtags,
      // Videos without a product: always labelled as AI-generated, no ad labels or links.
      labels: { ai_generated: true, paid_promotion: false, affiliate_link: null },
      sources: [...new Set(topic.card.facts.map((f) => f.source_url))],
    };
    writeFileSync(path.join(dir, `meta-${id}.json`), JSON.stringify(meta, null, 2) + "\n", "utf8");

    console.log(`\n${narrator.name}: ${res.passed ? "passes" : "DOES NOT pass"} · ${rel(md)}`);
    for (const c of res.checks) if (c.level !== "ok") console.log(`  ${c.level === "error" ? "✗" : "!"} ${c.text}`);
    console.log(`  manual checklist: ${res.manual.length} items`);
    failed ||= !res.passed;
  }
  return failed ? 1 : 0;
}

main(process.argv.slice(2)).then(
  (code) => (process.exitCode = code),
  (err) => {
    console.error(`Error: ${(err as Error).message}`);
    process.exitCode = 1;
  },
);
