import { parseArgs } from "node:util";
import { formatCheck } from "./lib/cards.js";
import { loadEnv } from "./lib/env.js";
import { FORMATS, type Format } from "@shorts/schema";
import { getNarrator, narratorChoices, narratorIds, parseNarratorArg } from "./lib/narrators.js";
import { rel } from "./lib/paths.js";
import { checkScript, videoDir } from "./lib/scripts.js";
import { checkTopic } from "./lib/topics.js";
import { ElevenLabsTts } from "./providers/elevenlabs.js";
import { appendVoiceLedger, today } from "./lib/outputs.js";
import { applyTake, recordTakes, takesDir } from "./steps/voice-fix.js";

const help = () => `Usage: pnpm voice-fix --topic <id> --format F5 --narrator <${narratorChoices(false)}> --scene <no> (--takes <count> | --apply <take no>)

Re-records one scene of the narrator audio without recording the whole video.
  1. Change the scene text in script.json (voiceover_by / spoken_by) if needed.
  2. --takes 3   records the scene together with its neighbours in 3 versions (paid, about 3 scenes of characters per take);
                 to listen: voice/takes/<narrator>-scene-NN/take-<no>-scene.mp3
  3. --apply 2   splices take 2 into voice/<narrator>.mp3 (cut in silence), recomputes captions and the hash;
                 the previous version goes to voice/history/
  Then: pnpm compose … --narrator <narrator>`;

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
        scene: { type: "string", short: "s" },
        takes: { type: "string" },
        apply: { type: "string" },
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
  const narrator = parseNarratorArg(values.narrator, false)?.[0];
  const scene = Number(values.scene) - 1;
  const takes = values.takes !== undefined ? Number(values.takes) : undefined;
  const apply = values.apply !== undefined ? Number(values.apply) : undefined;
  const problems: string[] = [];
  if (!values.topic) problems.push("missing --topic");
  if (!format || !(FORMATS as readonly string[]).includes(format)) problems.push("missing or invalid --format");
  if (!narrator) problems.push(`--narrator: ${narratorIds().join(", ")}`);
  if (!Number.isInteger(scene) || scene < 0) problems.push("--scene: scene number from 1");
  if ((takes === undefined) === (apply === undefined)) problems.push("give --takes or --apply");
  if (takes !== undefined && !(Number.isInteger(takes) && takes >= 1 && takes <= 5)) problems.push("--takes: 1–5");
  if (apply !== undefined && !(Number.isInteger(apply) && apply >= 1)) problems.push("--apply: take number");
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
  if (scene >= script.scenes.length) {
    console.error(`The script has ${script.scenes.length} scenes.`);
    return 1;
  }

  if (takes !== undefined) {
    loadEnv();
    const n = getNarrator(narrator!);
    const results = await recordTakes(dir, script, n, new ElevenLabsTts(), scene, takes);
    appendVoiceLedger(results.map((r) => ({ date: today(), film: `${input.id}/${format}`, narrator: n.id, model: n.model, kind: "take" as const, scene: scene + 1, chars: r.chars })));
    for (const r of results) console.log(`Take ${r.no}: ${rel(r.preview)} · scene ${r.seconds.toFixed(1)} s`);
    console.log(`\nListen and apply the best one: pnpm voice-fix --topic ${input.id} --format ${format} --narrator ${n.id} --scene ${scene + 1} --apply <no>`);
    return 0;
  }

  loadEnv();
  const n = getNarrator(narrator!);
  const { timings: t, warnings } = applyTake(dir, script, n, scene, apply!);
  console.log(`Applied take ${apply} (${rel(takesDir(dir, n.id, scene))}) · narrator ${t.duration_s.toFixed(1)} s`);
  for (const w of warnings) console.log(`  ! ${w}`);
  if (!warnings.length) console.log("Joins: silence before each one (last 50 ms < 2% of peak).");
  console.log(`Now: pnpm compose --topic ${input.id} --format ${format} --narrator ${n.id}`);
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => (process.exitCode = code),
  (err) => {
    console.error(`Error: ${(err as Error).message}`);
    process.exitCode = 1;
  },
);
