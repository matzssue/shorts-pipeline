import type { ComposeScene, ComposeWord } from "@shorts/schema";

/**
 * Pure timeline functions shared by the video render and the dashboard.
 * Frames everywhere; no React, no Node.
 */

export interface CaptionChunk {
  words: ComposeWord[];
  from: number;
  to: number;
}

/** Caption lines: three words per line, a new line after a full stop, question mark or a longer pause. */
export function chunkWords(words: ComposeWord[], fps: number): CaptionChunk[] {
  const chunks: CaptionChunk[] = [];
  let cur: ComposeWord[] = [];
  const flush = () => {
    if (cur.length) chunks.push({ words: cur, from: cur[0]!.from, to: cur.at(-1)!.to });
    cur = [];
  };
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1];
    const pause = next ? next.from - w.to > fps * 0.35 : true;
    if (cur.length >= 3 || /[.?!:…]$/.test(w.text) || pause) flush();
  });
  flush();
  return chunks;
}

/** Timecode `m:ss:ff` (minutes, seconds, frames), e.g. frame 935 at 30 fps → "0:31:05". */
export function timecode(frame: number, fps: number): string {
  if (!Number.isInteger(frame) || frame < 0) throw new Error(`timecode: frame must be a non-negative integer, got ${frame}`);
  if (!Number.isInteger(fps) || fps <= 0) throw new Error(`timecode: fps must be a positive integer, got ${fps}`);
  const totalSeconds = Math.floor(frame / fps);
  const ff = frame % fps;
  const m = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${m}:${String(ss).padStart(2, "0")}:${String(ff).padStart(2, "0")}`;
}

/** Index of the scene playing at `frame` ([from, from + durationInFrames)), or -1 outside the video. */
export function sceneAt(scenes: Pick<ComposeScene, "from" | "durationInFrames">[], frame: number): number {
  return scenes.findIndex((s) => frame >= s.from && frame < s.from + s.durationInFrames);
}
