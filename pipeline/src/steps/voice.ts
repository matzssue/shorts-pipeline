import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Narrator } from "../lib/narrators.js";
import type { CharTiming, TtsProvider } from "../providers/tts.js";
import type { Scene, SceneTiming, Script, VoiceTimings, WordTiming } from "@shorts/schema";

export type { SceneTiming, VoiceTimings, WordTiming } from "@shorts/schema";

/** The narration of the whole video for one narrator + the character range of each scene. */
export interface VoiceText {
  text: string;
  /** [from, to) in `text`; an empty range for a scene without narration. */
  scenes: { from: number; to: number }[];
}

/** The scene's narration as shown in the captions. */
export function sceneVoiceover(sc: Scene, narrator: string): string {
  return (sc.voiceover_by?.[narrator] ?? sc.voiceover).trim();
}

/** The scene text sent to the TTS: the pronunciation version if there is one, else the caption version. */
export function sceneSpoken(sc: Scene, narrator: string): string {
  return (sc.spoken_by?.[narrator] ?? sceneVoiceover(sc, narrator)).trim();
}

/** TTS tags in brackets, e.g. [whispering] – replaced with spaces (character indexes stay the same). */
export function blankTags(text: string): string {
  return text.replace(/\[[^\]]*\]/g, (m) => " ".repeat(m.length));
}

export function countWords(text: string): number {
  return blankTags(text).match(/\S+/g)?.length ?? 0;
}

export function buildVoiceText(script: Script, narrator: string): VoiceText {
  let text = "";
  const scenes = script.scenes.map((sc) => {
    const part = sceneSpoken(sc, narrator);
    if (part === "") return { from: text.length, to: text.length };
    if (text !== "") text += " ";
    const from = text.length;
    text += part;
    return { from, to: text.length };
  });
  return { text, scenes };
}

/** Words (runs of non-whitespace, without [..] tags) with the timing of their first and last character. */
export function wordTimings(text: string, chars: CharTiming[]): WordTiming[] {
  const words: WordTiming[] = [];
  for (const m of blankTags(text).matchAll(/\S+/g)) {
    const first = chars[m.index];
    const last = chars[m.index + m[0].length - 1];
    if (!first || !last) continue;
    words.push({ text: m[0], start: first.start, end: last.end });
  }
  return words;
}

export function sceneTimings(script: Script, vt: VoiceText, chars: CharTiming[]): SceneTiming[] {
  return script.scenes.map((sc, index) => {
    const r = vt.scenes[index]!;
    const first = chars[r.from];
    const last = chars[r.to - 1];
    return {
      index,
      duration_s: sc.duration_s,
      voice: r.to > r.from && first && last ? { start: first.start, end: last.end } : null,
    };
  });
}

/** Scenes where the narration is longer than the scene – the edit stretches them, or the text needs shortening. */
export function sceneOverruns(timings: SceneTiming[]): string[] {
  return timings
    .filter((t) => t.voice && t.voice.end - t.voice.start > t.duration_s)
    .map((t) => `scene ${t.index + 1}: narration ${(t.voice!.end - t.voice!.start).toFixed(1)} s > ${t.duration_s} s`);
}

/**
 * Swaps pronunciation words for caption words (same word count, 1:1 order).
 * Without `spoken_by` both texts are the same and nothing changes.
 */
export function toDisplayWords(script: Script, narrator: string, spokenWords: WordTiming[]): WordTiming[] {
  const display = script.scenes.flatMap((sc) => sceneVoiceover(sc, narrator).match(/\S+/g) ?? []);
  if (display.length !== spokenWords.length) {
    throw new Error(`the spoken text has ${spokenWords.length} words, the captions ${display.length} – align spoken_by with voiceover_by`);
  }
  return spokenWords.map((w, i) => ({ ...w, text: display[i]! }));
}

export function voiceHash(text: string, n: Narrator): string {
  return createHash("sha256")
    .update(JSON.stringify([text, n.voiceId, n.model, n.languageCode ?? null, n.stability ?? null]))
    .digest("hex")
    .slice(0, 16);
}

export const FULL_RECORDING = "full recording";

export const voiceFiles = (dir: string, narrator: string) => ({
  audio: path.join(dir, "voice", `${narrator}.mp3`),
  timings: path.join(dir, "voice", `${narrator}.json`),
});

/**
 * Voice step: narrator recording + word and scene timings.
 * Same text and voice → result from disk, no second payment.
 */
export async function runVoice(
  dir: string,
  script: Script,
  narrator: Narrator,
  provider: TtsProvider,
): Promise<{ timings: VoiceTimings; cached: boolean }> {
  const vt = buildVoiceText(script, narrator.id);
  if (vt.text === "") throw new Error("the script has no narration");
  const hash = voiceHash(vt.text, narrator);
  const files = voiceFiles(dir, narrator.id);

  if (existsSync(files.audio) && existsSync(files.timings)) {
    const prev = JSON.parse(readFileSync(files.timings, "utf8")) as VoiceTimings;
    if (prev.hash === hash) return { timings: prev, cached: true };
  }

  const res = await provider.synthesize(vt.text, narrator);
  if (res.chars.length !== vt.text.length) {
    throw new Error(`character timings (${res.chars.length}) do not match the text (${vt.text.length} characters)`);
  }
  const timings: VoiceTimings = {
    narrator: narrator.id,
    provider: provider.name,
    voiceId: narrator.voiceId,
    model: narrator.model,
    hash,
    text: vt.text,
    parts: script.scenes.map((sc) => sceneSpoken(sc, narrator.id)),
    sources: script.scenes.map(() => FULL_RECORDING),
    duration_s: res.chars.at(-1)?.end ?? 0,
    billed_chars: res.billedChars,
    words: toDisplayWords(script, narrator.id, wordTimings(vt.text, res.chars)),
    scenes: sceneTimings(script, vt, res.chars),
  };
  mkdirSync(path.dirname(files.audio), { recursive: true });
  writeFileSync(files.audio, res.audio);
  writeFileSync(files.timings, JSON.stringify(timings, null, 2) + "\n", "utf8");
  return { timings, cached: false };
}
