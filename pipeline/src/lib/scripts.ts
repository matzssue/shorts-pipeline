import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { scriptSchema, type Scene, type Script } from "../schema/script.js";
import { parseCard, readCardJson, type CardCheck } from "./cards.js";
import { FORMAT_DURATION_S, type Format } from "./formats.js";
import { isNarratorId, narratorIds } from "./narrators.js";
import { countWords } from "../steps/voice.js";
import { OUT_DIR } from "./paths.js";

export type ScriptCheck = CardCheck<Script>;

export interface ScriptContext {
  input: { kind: "topic" | "product"; id: string };
  format: Format;
  /** The parsed, valid topic or product card. */
  card: unknown;
}

/** How many narrator characters per second fit a calm pace (Polish). */
export const MAX_VOICE_CHARS_PER_S = 16;
/** Longest video clip at the standard generator price. */
export const FLOW_STANDARD_MAX_S = 10;
/** Video generator credits per second at 720p (clips up to 10 s). */
export const FLOW_CREDITS_PER_S_720P = 3;
const MAX_ON_SCREEN_CHARS = 60;

/**
 * Phrases typical of AI-written Polish copy – the narrator should sound like a person.
 * The videos are in Polish, so the list is too.
 */
export const AI_PHRASES: readonly string[] = [
  "w dzisiejszych czasach",
  "w dzisiejszym świecie",
  "warto wiedzieć",
  "warto pamiętać",
  "pamiętaj, że",
  "podsumowując",
  "kluczem jest",
  "kluczowe jest",
  "czy wiesz, że",
  "odkryj",
  "zanurz się",
  "niezwykle",
  "rewolucyjn",
  "sekret",
  "magia",
  "magiczn",
  "game changer",
  "bez wątpienia",
  "to nie tylko",
  "oto odpowiedź",
  "daj znać w komentarzu",
  "zostaw lajka",
];

/** AI phrases found in the text (case-insensitive). */
export function findAiPhrases(text: string): string[] {
  const t = text.toLowerCase();
  return AI_PHRASES.filter((p) => t.includes(p));
}

/** Whether the path `a.b.c` exists in the object (product card). */
function hasPath(obj: unknown, dotted: string): boolean {
  let cur: unknown = obj;
  for (const key of dotted.split(".")) {
    if (cur === null || typeof cur !== "object" || !(key in cur)) return false;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur !== undefined && cur !== null && cur !== "";
}

export function totalDuration(scenes: Scene[]): number {
  return scenes.reduce((s, sc) => s + sc.duration_s, 0);
}

export function videoSeconds(scenes: Scene[]): number {
  return scenes.filter((s) => s.kind === "video").reduce((s, sc) => s + sc.duration_s, 0);
}

/** Validates `script.json` against the card and the format. */
export function checkScriptData(data: unknown, ctx: ScriptContext): Omit<ScriptCheck, "file"> {
  const id = ctx.input.id;
  const warnings: string[] = [];
  const { card: s, errors } = parseCard(scriptSchema, data);
  if (!s) return { id, errors, warnings };

  if (s.input.kind !== ctx.input.kind || s.input.id !== ctx.input.id) {
    errors.push(`input: the script is for ${s.input.kind} "${s.input.id}", not ${ctx.input.kind} "${ctx.input.id}"`);
  }
  if (s.format !== ctx.format) errors.push(`format: the script has ${s.format}, the run uses ${ctx.format}`);

  const [min, max] = FORMAT_DURATION_S[ctx.format];
  const total = totalDuration(s.scenes);
  if (total < min || total > max) {
    errors.push(`scenes: ${total} s in total – format ${ctx.format} takes ${min}–${max} s`);
  }

  const factIds =
    ctx.input.kind === "topic"
      ? new Set(((ctx.card as { facts?: { id: string }[] }).facts ?? []).map((f) => f.id))
      : undefined;
  const allowed = () => narratorIds().join(", ");

  s.scenes.forEach((sc, i) => {
    const at = `scenes.${i}`;
    if (sc.kind !== "text" && sc.prompt.trim() === "") errors.push(`${at}.prompt: a ${sc.kind} scene needs a prompt`);
    if (sc.kind === "video" && sc.duration_s > FLOW_STANDARD_MAX_S) {
      warnings.push(`${at}.duration_s: ${sc.duration_s} s clip – over ${FLOW_STANDARD_MAX_S} s costs more to generate`);
    }
    const perS = sc.voiceover.length / sc.duration_s;
    if (perS > MAX_VOICE_CHARS_PER_S) {
      warnings.push(`${at}.voiceover: ${Math.round(perS)} chars/s (max ${MAX_VOICE_CHARS_PER_S}) – shorten the text or lengthen the scene`);
    }
    if (sc.on_screen_text.length > MAX_ON_SCREEN_CHARS) {
      warnings.push(`${at}.on_screen_text: ${sc.on_screen_text.length} chars – too long to read`);
    }
    const ai = findAiPhrases(`${sc.voiceover} ${sc.on_screen_text}`);
    if (ai.length > 0) warnings.push(`${at}: sounds like AI ("${ai.join('", "')}") – rewrite it`);
    for (const [narrator, text] of Object.entries(sc.voiceover_by ?? {})) {
      const nat = `${at}.voiceover_by.${narrator}`;
      if (!isNarratorId(narrator)) {
        errors.push(`${nat}: unknown narrator – allowed: ${allowed()}`);
        continue;
      }
      const nPerS = text.length / sc.duration_s;
      if (nPerS > MAX_VOICE_CHARS_PER_S) {
        warnings.push(`${nat}: ${Math.round(nPerS)} chars/s (max ${MAX_VOICE_CHARS_PER_S}) – shorten the text or lengthen the scene`);
      }
      const nAi = findAiPhrases(text);
      if (nAi.length > 0) warnings.push(`${nat}: sounds like AI ("${nAi.join('", "')}")`);
    }
    for (const [narrator, spoken] of Object.entries(sc.spoken_by ?? {})) {
      const sat = `${at}.spoken_by.${narrator}`;
      if (!isNarratorId(narrator)) {
        errors.push(`${sat}: unknown narrator – allowed: ${allowed()}`);
        continue;
      }
      const shown = sc.voiceover_by?.[narrator] ?? sc.voiceover;
      if (countWords(spoken) !== countWords(shown)) {
        errors.push(`${sat}: ${countWords(spoken)} words, but the captions have ${countWords(shown)} – word timings will not map 1:1`);
      }
    }
    sc.claims.forEach((c, j) => {
      const ok = factIds ? factIds.has(c.source) : hasPath(ctx.card, c.source);
      if (!ok) errors.push(`${at}.claims.${j}.source: "${c.source}" does not exist in the card`);
    });
  });

  if (total > 0 && videoSeconds(s.scenes) / total < 0.5) {
    warnings.push(`scenes: video is ${videoSeconds(s.scenes)} of ${total} s – most of the video should be motion`);
  }
  if (s.hashtags.length === 0) warnings.push("hashtags: no hashtags");
  const hookAi = findAiPhrases(s.hooks.join(" "));
  if (hookAi.length > 0) warnings.push(`hooks: sounds like AI ("${hookAi.join('", "')}")`);
  const exclamations = s.scenes.reduce((n, sc) => n + (sc.voiceover.match(/!/g)?.length ?? 0), 0);
  if (exclamations > 1) warnings.push(`scenes: ${exclamations} exclamation marks in the narration – max 1 per video`);

  return { id, card: s, errors, warnings };
}

/** Video folder: `out/<date>-<id>-<format>/`. Returns the newest existing one or a path for today. */
export function videoDir(id: string, format: Format, opts: { outDir?: string; today?: Date } = {}): { dir: string; exists: boolean } {
  const outDir = opts.outDir ?? OUT_DIR;
  const suffix = `-${id}-${format}`;
  const existing = existsSync(outDir)
    ? readdirSync(outDir)
        .filter((d) => /^\d{4}-\d{2}-\d{2}-/.test(d) && d.endsWith(suffix))
        .sort()
    : [];
  const last = existing.at(-1);
  if (last) return { dir: path.join(outDir, last), exists: true };
  const date = (opts.today ?? new Date()).toISOString().slice(0, 10);
  return { dir: path.join(outDir, `${date}${suffix}`), exists: false };
}

export function checkScript(dir: string, ctx: ScriptContext): ScriptCheck {
  const file = path.join(dir, "script.json");
  const { data, error } = readCardJson(file);
  if (error) return { id: ctx.input.id, file, errors: [error], warnings: [] };
  return { file, ...checkScriptData(data, ctx) };
}

export const sceneFileBase = (i: number): string => `scenes/${String(i + 1).padStart(2, "0")}`;

/** Prompt list for generating the clips by hand in a video generator. */
export function renderPrompts(s: Script): string {
  const lines: string[] = [
    `# Scene prompts – ${s.input.id} (${s.format})`,
    "",
    "Generator settings: aspect ratio **9:16**, **720p**, **1 result** per generation. Upscale a good clip to 1080p.",
    "If the generator does not offer the given length, pick the nearest longer one – the edit trims it.",
    "Save the files in this video's folder under the names below. `text` cards are drawn by the edit – nothing to generate.",
    "",
  ];
  let credits = 0;
  s.scenes.forEach((sc, i) => {
    if (sc.kind === "text") return;
    const ext = sc.kind === "video" ? "mp4" : "png";
    if (sc.kind === "video") credits += sc.duration_s * FLOW_CREDITS_PER_S_720P;
    lines.push(`## Scene ${i + 1} – ${sc.kind}, ${sc.duration_s} s → \`${sceneFileBase(i)}.${ext}\``, "");
    lines.push(`What it should show: ${sc.visual}`, "", "```", sc.prompt, "```", "");
  });
  lines.push(`Estimate: about ${credits} generator credits for the 720p clips (no retries).`, "");
  return lines.join("\n");
}

/** Which scene files are already in place and which are missing. */
export function sceneFilesStatus(dir: string, s: Script): { present: string[]; missing: string[] } {
  const present: string[] = [];
  const missing: string[] = [];
  s.scenes.forEach((sc, i) => {
    if (sc.kind === "text") return;
    const file = `${sceneFileBase(i)}.${sc.kind === "video" ? "mp4" : "png"}`;
    (existsSync(path.join(dir, file)) ? present : missing).push(file);
  });
  return { present, missing };
}
