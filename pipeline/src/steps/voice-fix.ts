import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { JOIN_GAP_S, rmsProfile, silenceCut, speechEnd, spliceAudio, type AudioSegment } from "../lib/audio.js";
import type { Narrator } from "../lib/narrators.js";
import type { CharTiming, TtsProvider } from "../providers/tts.js";
import type { Script } from "../schema/script.js";
import {
  buildVoiceText,
  FULL_RECORDING,
  sceneSpoken,
  sceneVoiceover,
  voiceFiles,
  voiceHash,
  wordTimings,
  type SceneTiming,
  type VoiceTimings,
  type WordTiming,
} from "./voice.js";

/**
 * Re-recording one scene of the narration: the scene is recorded together with its neighbours
 * (a short line recorded alone sounds like a different voice), in several versions, and the chosen
 * version is spliced into the existing recording with cuts in silence.
 */

type Span = { start: number; end: number };

/** A take: a few neighbouring scenes recorded in one go. */
export interface Take {
  narrator: string;
  voiceId: string;
  model: string;
  /** The scene being fixed (0-based index). */
  scene: number;
  /** Scenes in the take (context), in order. */
  scenes: number[];
  /** Spoken text of each scene in `scenes`. */
  parts: string[];
  text: string;
  ranges: { from: number; to: number }[];
  chars: CharTiming[];
}

/** The scene plus its neighbours that have narration. */
export function takeContext(script: Script, narrator: string, scene: number): number[] {
  return [scene - 1, scene, scene + 1].filter(
    (i) => i === scene || (i >= 0 && i < script.scenes.length && sceneSpoken(script.scenes[i]!, narrator) !== ""),
  );
}

export function joinParts(parts: string[]): { text: string; ranges: { from: number; to: number }[] } {
  let text = "";
  const ranges = parts.map((p) => {
    if (text) text += " ";
    const from = text.length;
    text += p;
    return { from, to: text.length };
  });
  return { text, ranges };
}

export const takesDir = (dir: string, narrator: string, scene: number): string =>
  path.join(dir, "voice", "takes", `${narrator}-scene-${String(scene + 1).padStart(2, "0")}`);

/**
 * The part of the recording for scene `pos`: from the silence before it to the silence after it.
 * `filmStart` – the scene opens the video (cut from 0, so a breath at the start is not clipped).
 */
export function sceneSegment(rms: number[], spans: (Span | undefined)[], pos: number, filmStart: boolean): { from: number; to: number } {
  const s = spans[pos];
  if (!s) throw new Error(`no timing for scene ${pos + 1} in the recording`);
  const prev = spans[pos - 1];
  const next = spans[pos + 1];
  const from = filmStart ? 0 : prev ? silenceCut(rms, prev.end, s.start) : Math.max(0, s.start - 0.15);
  const to = next ? silenceCut(rms, s.end, next.start) : speechEnd(rms, s.end);
  return { from, to };
}

function takeSpans(t: Take): Span[] {
  return t.ranges.map((r) => ({ start: t.chars[r.from]!.start, end: t.chars[r.to - 1]!.end }));
}

/** Records `count` new takes of the scene and cuts the scene alone out of each one for listening. */
export async function recordTakes(
  dir: string,
  script: Script,
  narrator: Narrator,
  provider: TtsProvider,
  scene: number,
  count: number,
): Promise<{ no: number; preview: string; seconds: number }[]> {
  const scenes = takeContext(script, narrator.id, scene);
  const parts = scenes.map((i) => sceneSpoken(script.scenes[i]!, narrator.id));
  if (parts[scenes.indexOf(scene)] === "") throw new Error(`scene ${scene + 1} has no narration`);
  const { text, ranges } = joinParts(parts);
  const out = takesDir(dir, narrator.id, scene);
  mkdirSync(out, { recursive: true });
  const existing = readdirSync(out).map((f) => /^take-(\d+)\.json$/.exec(f)?.[1]).filter(Boolean).map(Number);
  let no = existing.length ? Math.max(...existing) : 0;

  const results: { no: number; preview: string; seconds: number }[] = [];
  for (let k = 0; k < count; k++) {
    no++;
    const res = await provider.synthesize(text, narrator);
    if (res.chars.length !== text.length) {
      throw new Error(`character timings (${res.chars.length}) do not match the text (${text.length} characters)`);
    }
    const take: Take = { narrator: narrator.id, voiceId: narrator.voiceId, model: narrator.model, scene, scenes, parts, text, ranges, chars: res.chars };
    const base = path.join(out, `take-${no}`);
    writeFileSync(`${base}.mp3`, res.audio);
    writeFileSync(`${base}.json`, JSON.stringify(take) + "\n", "utf8");
    const seg = sceneSegment(rmsProfile(`${base}.mp3`), takeSpans(take), scenes.indexOf(scene), scene === 0);
    const preview = `${base}-scene.mp3`;
    spliceAudio([{ file: `${base}.mp3`, ...seg }], preview);
    results.push({ no, preview, seconds: seg.to - seg.from });
  }
  return results;
}

/** Caption words of the scene from the take (spoken → caption words 1:1). */
function takeWords(script: Script, take: Take, scene: number): WordTiming[] {
  const pos = take.scenes.indexOf(scene);
  const r = take.ranges[pos]!;
  const spoken = wordTimings(take.parts[pos]!, take.chars.slice(r.from, r.to));
  const display = sceneVoiceover(script.scenes[scene]!, take.narrator).match(/\S+/g) ?? [];
  if (spoken.length !== display.length) {
    throw new Error(`take: scene ${scene + 1} has ${spoken.length} words, the captions ${display.length}`);
  }
  return spoken.map((w, i) => ({ ...w, text: display[i]! }));
}

/**
 * Splices take `takeNo` into the narrator recording (`voice/<narrator>.*`). The previous version is copied to `voice/history/`.
 * All other scenes must have the same text in the script as in the recording.
 */
export function applyTake(
  dir: string,
  script: Script,
  narrator: Narrator,
  scene: number,
  takeNo: number,
  now = new Date(),
): { timings: VoiceTimings; warnings: string[] } {
  const files = voiceFiles(dir, narrator.id);
  if (!existsSync(files.timings) || !existsSync(files.audio)) {
    throw new Error(`no recording for ${narrator.id} – run pnpm make … --narrator ${narrator.id} first`);
  }
  const current = JSON.parse(readFileSync(files.timings, "utf8")) as VoiceTimings;
  const takeBase = path.join(takesDir(dir, narrator.id, scene), `take-${takeNo}`);
  if (!existsSync(`${takeBase}.json`)) throw new Error(`no take ${takeNo} for scene ${scene + 1}`);
  const take = JSON.parse(readFileSync(`${takeBase}.json`, "utf8")) as Take;
  if (take.narrator !== narrator.id || take.voiceId !== narrator.voiceId || take.model !== narrator.model) {
    throw new Error("the take was recorded with a different voice or model than the current narrator");
  }

  const spokenNow = script.scenes.map((sc) => sceneSpoken(sc, narrator.id));
  if (take.parts[take.scenes.indexOf(scene)] !== spokenNow[scene]) {
    throw new Error(`the text of scene ${scene + 1} in script.json differs from the take – record the takes again`);
  }
  if (current.parts) {
    const changed = spokenNow.map((p, i) => i).filter((i) => i !== scene && current.parts![i] !== spokenNow[i]);
    if (changed.length) throw new Error(`scenes ${changed.map((i) => i + 1).join(", ")} have a different text than the recording – record the narration again`);
  }

  const currentRms = rmsProfile(files.audio);
  const takeRms = rmsProfile(`${takeBase}.mp3`);
  const fileEnd = (c: AudioSegment) => (c.file === files.audio ? currentRms : takeRms).length * 0.01;
  const spans = current.scenes.map((s) => s.voice ?? undefined);
  const voiced = script.scenes.map((_, i) => i).filter((i) => spokenNow[i] !== "");
  const prev = voiced[voiced.indexOf(scene) - 1];
  const next = voiced[voiced.indexOf(scene) + 1];

  // The rest of the recording stays in one piece before and after the scene – we cut only at its edges,
  // so repeated fixes do not stretch pauses elsewhere.
  const cutBefore = prev !== undefined ? silenceCut(currentRms, spans[prev]!.end, spans[scene]!.start) : 0;
  const cutAfter = next !== undefined ? silenceCut(currentRms, spans[scene]!.end, spans[next]!.start) : undefined;
  const takeSeg = sceneSegment(takeRms, takeSpans(take), take.scenes.indexOf(scene), prev === undefined);

  // Words are split by the scenes' word counts, not by time – a cut in silence can land just after
  // the aligned start of a word (soft onset) and the word would end up in two pieces.
  const wordCount = (i: number) => sceneVoiceover(script.scenes[i]!, narrator.id).match(/\S+/g)?.length ?? 0;
  const sumWords = (idx: number[]) => idx.reduce((n, i) => n + wordCount(i), 0);
  const wordsBefore = sumWords(script.scenes.map((_, i) => i).filter((i) => i < scene));
  const wordsAfter = sumWords(script.scenes.map((_, i) => i).filter((i) => i > scene));
  if (wordsBefore + wordsAfter > current.words.length) throw new Error("the recording has fewer words than the other scenes – record the narration again");
  const newWords = takeWords(script, take, scene);
  const afterWords = current.words.slice(current.words.length - wordsAfter);

  type Chunk = AudioSegment & { scenes: number[]; words: WordTiming[] };
  const chunks: Chunk[] = [];
  if (prev !== undefined) {
    const sc = voiced.filter((i) => i < scene);
    chunks.push({ file: files.audio, from: 0, to: cutBefore, scenes: sc, words: current.words.slice(0, wordsBefore) });
  }
  chunks.push({ file: `${takeBase}.mp3`, ...takeSeg, scenes: [scene], words: newWords });
  if (cutAfter !== undefined) {
    const sc = voiced.filter((i) => i > scene);
    const end = currentRms.length * 0.01;
    chunks.push({ file: files.audio, from: cutAfter, to: end, scenes: sc, words: afterWords });
  }

  // Keep the previous version – a spliced recording cannot be recreated with one `pnpm make`.
  const history = path.join(dir, "voice", "history");
  mkdirSync(history, { recursive: true });
  const stamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  copyFileSync(files.audio, path.join(history, `${narrator.id}-${stamp}.mp3`));
  copyFileSync(files.timings, path.join(history, `${narrator.id}-${stamp}.json`));

  const tmp = files.audio.replace(/\.mp3$/, ".tmp.mp3");
  const { starts, duration } = spliceAudio(chunks, tmp);
  renameSync(tmp, files.audio);

  const words: WordTiming[] = [];
  const voiceBy = new Map<number, Span>();
  const round = (x: number) => +x.toFixed(3);
  chunks.forEach((c, k) => {
    const t0 = starts[k]!;
    const t1 = t0 + (c.to - c.from);
    const shift = (x: number) => Math.min(Math.max(x - c.from + t0, t0), t1);
    for (const w of c.words) words.push({ text: w.text, start: round(shift(w.start)), end: round(shift(w.end)) });
    for (const i of c.scenes) {
      // The fixed scene: the whole segment with silence at the edges – the edit cuts in the middle of the pause.
      const v = i === scene ? { start: c.from, end: c.to } : spans[i];
      if (v) voiceBy.set(i, { start: round(shift(v.start)), end: round(shift(v.end)) });
    }
  });
  const expected = script.scenes.reduce((n, sc) => n + (sceneVoiceover(sc, narrator.id).match(/\S+/g)?.length ?? 0), 0);
  if (words.length !== expected) throw new Error(`${words.length} words after splicing, but the captions have ${expected}`);

  const scenes: SceneTiming[] = script.scenes.map((sc, index) => ({ index, duration_s: sc.duration_s, voice: voiceBy.get(index) ?? null }));
  const vt = buildVoiceText(script, narrator.id);
  const sources = script.scenes.map((_, i) =>
    i === scene ? path.relative(dir, takeBase).replaceAll("\\", "/") : (current.sources?.[i] ?? FULL_RECORDING),
  );
  const timings: VoiceTimings = {
    ...current,
    hash: voiceHash(vt.text, narrator),
    text: vt.text,
    parts: spokenNow,
    sources,
    duration_s: +duration.toFixed(3),
    billed_chars: undefined,
    words,
    scenes,
  };
  writeFileSync(files.timings, JSON.stringify(timings, null, 2) + "\n", "utf8");

  // Silence before every join: the last 50 ms of a segment < 2% of the peak.
  // Only cuts inside the recording are checked; the end of a TTS file (a trailing sound) is not a cut.
  const out = rmsProfile(files.audio);
  const peak = Math.max(...out);
  const warnings = starts.slice(1).flatMap((s, k) => {
    if (chunks[k]!.to >= fileEnd(chunks[k]!) - 0.02) return [];
    const end = Math.round((s - JOIN_GAP_S) / 0.01);
    const tail = out.slice(Math.max(0, end - 5), end);
    const loud = Math.max(...tail) / peak;
    return loud >= 0.02 ? [`join ${k + 1} (${s.toFixed(2)} s): the segment ends at ${Math.round(loud * 100)}% of peak – a word may be cut off`] : [];
  });
  return { timings, warnings };
}
