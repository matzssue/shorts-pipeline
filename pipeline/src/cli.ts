import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { formatCheck, type CardCheck } from "./lib/cards.js";
import { loadEnv } from "./lib/env.js";
import { FORMATS, PRODUCT_FORMATS, PRODUCT_ID_RE, TOPIC_FORMATS, type Format } from "@shorts/schema";
import { getNarrator, narratorChoices, narratorIds, parseNarratorArg, type NarratorId } from "./lib/narrators.js";
import { rel } from "./lib/paths.js";
import { checkProduct } from "./lib/products.js";
import {
  checkScript,
  renderPrompts,
  sceneFilesStatus,
  totalDuration,
  videoDir,
  videoSeconds,
} from "./lib/scripts.js";
import { checkTopic } from "./lib/topics.js";
import { ElevenLabsTts } from "./providers/elevenlabs.js";
import { runVoice, sceneOverruns, voiceFiles } from "./steps/voice.js";

export { FORMATS, PRODUCT_FORMATS, TOPIC_FORMATS, type Format };

const help = () => `Usage:
  pnpm make --topic <id> --format <F5|F3>          video without a product (topic card)
  pnpm make --product <id> --format <F1|F2|F3|F4>  product video (product card)

Cards: topics/<id>.json, products/<id>.json (check with pnpm validate).
The pipeline only writes files to out/ – publishing is a separate, manual step.

Options:
  -t, --topic <id>      topic card ID (kebab-case)
  -p, --product <id>    product card ID (kebab-case)
  -f, --format <code>   F1 problem→solution, F2 "3 things for X", F3 character series,
                        F4 seasonal guide, F5 niche tip (no product)
  -n, --narrator <id>   voice step: narrator (${narratorChoices()}) – ElevenLabs, paid;
                        the same text is never recorded twice
  -h, --help            this help

Give exactly one of --topic or --product.`;

export type MakeInput = { kind: "topic"; id: string } | { kind: "product"; id: string };

export interface MakeArgs {
  input: MakeInput;
  format: Format;
  /** Narrators for the voice step; empty = no recording. */
  narrators: NarratorId[];
}

export class UsageError extends Error {}

/** Parses and validates arguments (no disk access). */
export function parseMakeArgs(argv: string[]): MakeArgs | "help" {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      strict: true,
      allowPositionals: false,
      options: {
        topic: { type: "string", short: "t" },
        product: { type: "string", short: "p" },
        format: { type: "string", short: "f" },
        narrator: { type: "string", short: "n" },
        help: { type: "boolean", short: "h" },
      },
    }));
  } catch (err) {
    throw new UsageError((err as Error).message);
  }

  if (values.help) return "help";

  const errors: string[] = [];
  const topic = values.topic?.trim();
  const product = values.product?.trim();
  const format = values.format?.trim().toUpperCase();

  let input: MakeInput | undefined;
  if (topic && product) {
    errors.push("give --topic or --product, not both");
  } else if (!topic && !product) {
    errors.push("missing --topic or --product");
  } else {
    const kind = topic ? "topic" : "product";
    const id = (topic ?? product)!;
    if (!PRODUCT_ID_RE.test(id)) {
      errors.push(`--${kind} "${id}" must be kebab-case (lowercase letters, digits, hyphens)`);
    } else {
      input = { kind, id };
    }
  }

  if (!format) {
    errors.push("missing --format");
  } else if (!(FORMATS as readonly string[]).includes(format)) {
    errors.push(`--format "${values.format}" – allowed: ${FORMATS.join(", ")}`);
  } else if (input) {
    const allowed: readonly Format[] = input.kind === "topic" ? TOPIC_FORMATS : PRODUCT_FORMATS;
    if (!allowed.includes(format as Format)) {
      errors.push(`format ${format} does not fit --${input.kind} – allowed: ${allowed.join(", ")}`);
    }
  }

  const narrators = parseNarratorArg(values.narrator);
  if (!narrators) errors.push(`--narrator "${values.narrator}" – allowed: ${[...narratorIds(), "all"].join(", ")}`);

  if (errors.length > 0) throw new UsageError(errors.join("\n  - "));
  return { input: input!, format: format as Format, narrators: narrators! };
}

async function main(argv: string[]): Promise<number> {
  // pnpm may pass a "--" separator before the script arguments
  const args = argv[0] === "--" ? argv.slice(1) : argv;

  let parsed: MakeArgs | "help";
  try {
    parsed = parseMakeArgs(args);
  } catch (err) {
    if (err instanceof UsageError) {
      console.error(`Invalid arguments:\n  - ${err.message}\n\n${help()}`);
      return 1;
    }
    throw err;
  }

  if (parsed === "help") {
    console.log(help());
    return 0;
  }

  const { input, format, narrators } = parsed;
  const check: CardCheck<unknown> = input.kind === "topic" ? checkTopic(input.id) : checkProduct(input.id);
  console.log(formatCheck(check));
  if (check.errors.length > 0) {
    console.error(`\nThe ${input.kind} card is invalid – fix it (pnpm validate) and run again.`);
    return 1;
  }

  if (input.kind === "topic") {
    const formats = (check.card as { formats: string[] }).formats;
    if (!formats.includes(format)) {
      console.error(`\nThe topic card allows formats: ${formats.join(", ")} – not ${format}.`);
      return 1;
    }
  }

  const env = loadEnv();
  console.log(`\n${input.kind === "topic" ? "Topic" : "Product"}: ${input.id} · format: ${format}`);
  console.log(`.env: ${env.loaded ? "loaded" : "no file (steps that call APIs will need keys)"}`);

  // Script step: the script is written outside the pipeline (by a person or an LLM); the pipeline validates it.
  const { dir, exists } = videoDir(input.id, format);
  if (!exists || !existsSync(path.join(dir, "script.json"))) {
    mkdirSync(path.join(dir, "scenes"), { recursive: true });
    console.log(`\nNo script yet. Save it as ${rel(dir)}${path.sep}script.json (schema: src/schema/script.ts) and run again.`);
    return 0;
  }

  const sc = checkScript(dir, { input, format, card: check.card });
  console.log(`\n${formatCheck(sc)}`);
  if (sc.errors.length > 0 || !sc.card) {
    console.error("\nThe script is invalid – fix script.json.");
    return 1;
  }
  const script = sc.card;
  const total = totalDuration(script.scenes);
  console.log(`Length: ${total} s · video: ${videoSeconds(script.scenes)} s · scenes: ${script.scenes.length}`);

  // Scenes step: prompts for the video generator + which clip files are in place.
  mkdirSync(path.join(dir, "scenes"), { recursive: true });
  writeFileSync(path.join(dir, "prompts.md"), renderPrompts(script), "utf8");
  const files = sceneFilesStatus(dir, script);
  console.log(`Scene prompts: ${rel(dir)}${path.sep}prompts.md`);
  console.log(`Scenes: ${files.present.length} ready, ${files.missing.length} missing${files.missing.length ? ` (${files.missing.join(", ")})` : ""}`);

  // Voice step: narrator audio + word and scene timings.
  if (narrators.length === 0) {
    console.log(`Narrator: skipped (--narrator ${narratorChoices()}).`);
  } else {
    const tts = new ElevenLabsTts();
    for (const id of narrators) {
      const n = getNarrator(id);
      const { timings, cached } = await runVoice(dir, script, n, tts);
      const files = voiceFiles(dir, id);
      const cost = cached ? "from cache, no cost" : `characters: ${timings.billed_chars ?? "?"}`;
      console.log(`Narrator ${n.name}: ${rel(files.audio)} · ${timings.duration_s.toFixed(1)} s · ${cost}`);
      // Scene lengths from the current script – the cache may hold old ones.
      const current = timings.scenes.map((t, i) => ({ ...t, duration_s: script.scenes[i]?.duration_s ?? t.duration_s }));
      for (const w of sceneOverruns(current)) console.log(`  ! ${w}`);
    }
  }
  console.log("Next: pnpm compose, then pnpm qa.");
  return 0;
}

// Run only as a script (importing in tests does not start the CLI).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => (process.exitCode = code),
    (err) => {
      console.error(`Error: ${(err as Error).message}`);
      process.exitCode = 1;
    },
  );
}
