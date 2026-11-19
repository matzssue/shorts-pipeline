import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { loadEnv, requireEnv } from "./lib/env.js";
import { OUT_DIR } from "./lib/paths.js";

const HELP = `Usage: pnpm voice-samples --usage
       pnpm voice-samples --list [--language pl] [--gender male|female] [--accent <accent>]
       pnpm voice-samples --film <folder in out/> --voices <id>[,<id>...] [--text <file.txt>] [--lang pl|none] [--prefix <name>]
       pnpm voice-samples --film <folder in out/> --design <personas.json>
       pnpm voice-samples --save <generatedVoiceId> --name <name> [--description <text>]

Narrator samples for picking a voice, ElevenLabs.
  --list      voices from the ElevenLabs library (no credits used); Polish by default
  --film      video folder in out/; text = the joined narration from script.json, or --text
  --voices    voice IDs from --list; every voice uses credits (about 1 per character)
  --text      file with the narration instead of script.json
  --lang      forced pronunciation language (default pl); "none" = not forced,
              a foreign voice then keeps more of its own accent
  --prefix    start of the output file name (default elevenlabs)
  --stability 0–1: lower = more expressive, the model follows [..] tags more closely
  --model     TTS model (default eleven_v4)
  --design    JSON file with characters [{id, description, text, guidance?, remixOf?}] – Voice Design
              (or a remix of a saved voice), a few versions per character, each reads the character's text
  --save      generatedVoiceId from design-ids-*.json → save the voice to the account (--name, --description)
  --usage     character usage in the ElevenLabs plan
Output: out/<video>/voice-samples/`;

type Script = { scenes: { voiceover: string }[] };

function slug(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

async function listVoices(client: ElevenLabsClient, language: string, gender?: string, accent?: string): Promise<void> {
  const res = await client.voices.getShared({ language, gender, accent, pageSize: 40, sort: "usage_character_count_1y" });
  for (const v of res.voices) {
    if (!v.freeUsersAllowed) continue;
    console.log(`${v.voiceId}  ${v.name}  · ${v.gender}, ${v.age}, ${v.accent} · ${v.useCase} · ${v.descriptive}`);
  }
}

type SampleOptions = { model: string; textFile?: string; lang?: string; prefix: string; stability?: number };

async function makeSamples(client: ElevenLabsClient, film: string, voiceIds: string[], opts: SampleOptions): Promise<void> {
  const filmDir = path.join(OUT_DIR, film);
  let text: string;
  if (opts.textFile) {
    text = readFileSync(opts.textFile, "utf8").trim();
  } else {
    const scriptFile = path.join(filmDir, "script.json");
    if (!existsSync(scriptFile)) throw new Error(`No ${scriptFile}`);
    const script = JSON.parse(readFileSync(scriptFile, "utf8")) as Script;
    text = script.scenes.map((s) => s.voiceover.trim()).filter(Boolean).join(" ");
  }
  const outDir = path.join(filmDir, "voice-samples");
  mkdirSync(outDir, { recursive: true });

  for (const voiceId of voiceIds) {
    const voice = await client.voices.get(voiceId).catch(() => undefined);
    const name = voice?.name ?? voiceId;
    const { data, rawResponse } = await client.textToSpeech
      .convert(voiceId, {
        text,
        modelId: opts.model,
        languageCode: opts.lang,
        ...(opts.stability !== undefined && { voiceSettings: { stability: opts.stability } }),
      })
      .withRawResponse();
    const chunks: Uint8Array[] = [];
    for await (const chunk of data) chunks.push(chunk);
    const file = path.join(outDir, `${opts.prefix}-${slug(name)}.mp3`);
    writeFileSync(file, Buffer.concat(chunks));
    console.log(`${name}: ${path.relative(OUT_DIR, file)} · characters: ${rawResponse.headers.get("x-character-count") ?? "?"}`);
  }
}

type Persona = { id: string; description: string; text: string; guidance?: number; remixOf?: string };

/**
 * Voice Design: a character description becomes a few voice versions, each reading the character's text.
 * With `remixOf` (ID of a voice saved on the account) – a remix of that voice following the description.
 */
async function designVoices(client: ElevenLabsClient, film: string, personasFile: string): Promise<void> {
  const outDir = path.join(OUT_DIR, film, "voice-samples");
  mkdirSync(outDir, { recursive: true });
  const personas = JSON.parse(readFileSync(personasFile, "utf8")) as Persona[];
  const ids: Record<string, string[]> = {};

  for (const p of personas) {
    const common = {
      voiceDescription: p.description,
      text: p.text,
      outputFormat: "mp3_44100_128" as const,
      ...(p.guidance !== undefined && { guidanceScale: p.guidance }),
    };
    const res = p.remixOf
      ? await client.textToVoice.remix(p.remixOf, common)
      : await client.textToVoice.design({ ...common, modelId: "eleven_ttv_v3" });
    const generated: string[] = (ids[p.id] = []);
    res.previews.forEach((preview, i) => {
      const ext = preview.mediaType.includes("mpeg") ? "mp3" : preview.mediaType.split("/").pop();
      const file = path.join(outDir, `design-${p.id}-${i + 1}.${ext}`);
      writeFileSync(file, Buffer.from(preview.audioBase64, "base64"));
      generated.push(preview.generatedVoiceId);
      console.log(`${p.id} #${i + 1}: ${path.basename(file)} · ${preview.durationSecs.toFixed(1)} s`);
    });
  }
  // generatedVoiceId lets you save the chosen version as a voice on the account (textToVoice.create).
  const idsFile = path.join(outDir, `design-ids-${path.basename(personasFile, ".json")}.json`);
  writeFileSync(idsFile, JSON.stringify(ids, null, 2) + "\n");
}

async function main(argv: string[]): Promise<number> {
  const args = argv[0] === "--" ? argv.slice(1) : argv;
  let values;
  try {
    ({ values } = parseArgs({
      args,
      strict: true,
      options: {
        list: { type: "boolean" },
        usage: { type: "boolean" },
        save: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        language: { type: "string", default: "pl" },
        gender: { type: "string" },
        accent: { type: "string" },
        film: { type: "string" },
        voices: { type: "string" },
        text: { type: "string" },
        lang: { type: "string", default: "pl" },
        prefix: { type: "string", default: "elevenlabs" },
        stability: { type: "string" },
        design: { type: "string" },
        model: { type: "string", default: "eleven_v4" },
        help: { type: "boolean", short: "h" },
      },
    }));
  } catch (err) {
    console.error(`Invalid arguments: ${(err as Error).message}\n\n${HELP}`);
    return 1;
  }
  if (values.help || (!values.list && !values.usage && !values.save && !values.film)) {
    console.log(HELP);
    return values.help ? 0 : 1;
  }

  loadEnv();
  requireEnv("ELEVENLABS_API_KEY");
  const client = new ElevenLabsClient();

  if (values.usage) {
    const s = await client.user.subscription.get();
    const reset = s.nextCharacterCountResetUnix ? new Date(s.nextCharacterCountResetUnix * 1000).toISOString().slice(0, 10) : "?";
    console.log(`Plan: ${s.tier} · characters used: ${s.characterCount} / ${s.characterLimit} · reset: ${reset}`);
    return 0;
  }
  if (values.save) {
    if (!values.name) {
      console.error(`Give --name.\n\n${HELP}`);
      return 1;
    }
    const voice = await client.textToVoice.create({
      voiceName: values.name,
      voiceDescription: values.description ?? values.name,
      generatedVoiceId: values.save,
    });
    console.log(`Saved voice: ${voice.name} · voice_id: ${voice.voiceId}`);
    return 0;
  }
  if (values.list) {
    await listVoices(client, values.language!, values.gender, values.accent);
    return 0;
  }
  if (values.design) {
    await designVoices(client, values.film!, path.resolve(values.design));
    return 0;
  }
  const voiceIds = (values.voices ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (voiceIds.length === 0) {
    console.error(`Give --voices.\n\n${HELP}`);
    return 1;
  }
  await makeSamples(client, values.film!, voiceIds, {
    model: values.model!,
    textFile: values.text ? path.resolve(values.text) : undefined,
    lang: values.lang === "none" ? undefined : values.lang,
    prefix: values.prefix!,
    stability: values.stability !== undefined ? Number(values.stability) : undefined,
  });
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => (process.exitCode = code),
  (err) => {
    console.error(`Error: ${(err as Error).message}`);
    process.exitCode = 1;
  },
);
