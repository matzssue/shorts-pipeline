import type { Overlay, Script } from "@shorts/schema";
import type { VoiceTimings } from "../steps/voice.js";
import { FPS, type ComposeOverlay, type ComposeProps, type ComposeScene, type ComposeWord } from "./types.js";

/** Strongest clip slow-down that still looks natural. */
export const MIN_PLAYBACK_RATE = 0.75;
/** Silence at the end of the video after the last word. */
const TAIL_S = 1.2;
/** Silence before the first word – the viewer reads the topic from the first frame first. */
export const LEAD_IN_S = 0.6;

export interface ComposeInput {
  script: Script;
  voice: VoiceTimings;
  /** Narrator audio path relative to the video folder. */
  audioSrc: string;
  /** Clip lengths (s) by path relative to the video folder. */
  clipDurations: Record<string, number>;
  /** Publish date – `{yesterday}` in overlays = the day before. */
  publishDate: Date;
  series: number;
  seriesTitle: string;
  sourceLabel?: string;
}

export interface ComposeResult {
  props: ComposeProps;
  warnings: string[];
}

/** DD.MM.YYYY – the date format printed on labels. */
export function formatDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getUTCFullYear()}`;
}

function resolveOverlay(o: Overlay | undefined, publish: Date): ComposeOverlay | undefined {
  if (!o) return undefined;
  if (o.type !== "label") return o;
  const yesterday = new Date(publish.getTime() - 24 * 3600 * 1000);
  return { ...o, value: o.value.replaceAll("{yesterday}", formatDate(yesterday)) };
}

const frames = (s: number): number => Math.round(s * FPS);

/**
 * Builds the video timeline: each scene lasts as long as the script planned, but never shorter than its narration.
 * The narration is cut between scenes in the middle of the pause between words, so a card (e.g. a quiz)
 * can keep silence for a countdown.
 */
export function buildComposeProps(input: ComposeInput): ComposeResult {
  const { script, voice } = input;
  const warnings: string[] = [];
  const timings = voice.scenes;
  if (timings.length !== script.scenes.length) {
    throw new Error(`the narration has ${timings.length} scenes, the script ${script.scenes.length} – record the narration again`);
  }
  const missing = timings.filter((t) => !t.voice).map((t) => t.index + 1);
  if (missing.length > 0) throw new Error(`scenes without narration (${missing.join(", ")}) – the edit does not support them yet`);

  // Audio cut points: half of the pause between a scene's last word and the next scene's first word.
  const cuts: number[] = [0];
  for (let i = 1; i < timings.length; i++) cuts.push((timings[i - 1]!.voice!.end + timings[i]!.voice!.start) / 2);
  cuts.push(voice.duration_s + TAIL_S);

  const scenes: ComposeScene[] = [];
  const words: ComposeWord[] = [];
  let from = 0;
  script.scenes.forEach((sc, i) => {
    const a = cuts[i]!;
    const b = cuts[i + 1]!;
    const delay = i === 0 ? frames(LEAD_IN_S) : 0;
    const durationInFrames = Math.max(frames(sc.duration_s), delay + frames(b - a));
    const seconds = durationInFrames / FPS;

    let src: string | undefined;
    let playbackRate = 1;
    if (sc.kind !== "text") {
      src = `scenes/${String(i + 1).padStart(2, "0")}.${sc.kind === "video" ? "mp4" : "png"}`;
      const clip = input.clipDurations[src];
      if (sc.kind === "video") {
        if (clip === undefined) throw new Error(`missing clip ${src}`);
        if (clip < seconds) {
          playbackRate = (clip - 0.05) / seconds;
          if (playbackRate < MIN_PLAYBACK_RATE) {
            warnings.push(`scene ${i + 1}: ${clip.toFixed(1)} s clip for ${seconds.toFixed(1)} s – slowed to ${Math.round(playbackRate * 100)}%, generate a longer one`);
          }
        }
      }
    }

    scenes.push({
      kind: sc.kind,
      src,
      from,
      durationInFrames,
      playbackRate,
      headline: sc.on_screen_text,
      overlay: resolveOverlay(sc.overlay, input.publishDate),
      audio: { startFrom: frames(a), endAt: frames(b), delay },
    });

    const at = from + delay;
    for (const w of voice.words) {
      if (w.start >= a && w.start < b) words.push({ text: w.text, from: at + frames(w.start - a), to: at + frames(w.end - a) });
    }
    from += durationInFrames;
  });

  return {
    props: {
      series: input.series,
      seriesTitle: input.seriesTitle,
      sourceLabel: input.sourceLabel ?? "Source",
      audioSrc: input.audioSrc,
      scenes,
      words,
      durationInFrames: from,
    },
    warnings,
  };
}
