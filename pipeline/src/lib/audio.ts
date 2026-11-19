import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ffmpeg } from "./ffmpeg.js";

/** Loudness analysis window: 10 ms. */
export const RMS_STEP_S = 0.01;

/** Loudness (RMS) every 10 ms – decoded to 16 kHz mono WAV. */
export function rmsProfile(file: string): number[] {
  const tmp = mkdtempSync(path.join(tmpdir(), "rms-"));
  try {
    const wav = path.join(tmp, "a.wav");
    ffmpeg(["-i", file, "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", "-bitexact", wav]);
    const buf = readFileSync(wav);
    let off = 12;
    while (buf.toString("ascii", off, off + 4) !== "data") off += 8 + buf.readUInt32LE(off + 4);
    const size = buf.readUInt32LE(off + 4);
    const pcm = new Int16Array(buf.buffer.slice(buf.byteOffset + off + 8, buf.byteOffset + off + 8 + size));
    const out: number[] = [];
    for (let i = 0; i + 160 <= pcm.length; i += 160) {
      let s = 0;
      for (let k = i; k < i + 160; k++) s += pcm[k]! * pcm[k]!;
      out.push(Math.sqrt(s / 160));
    }
    return out;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * Cut point between scenes: the middle of the longest quiet stretch around the boundary.
 * TTS character timings can be off (about 0.06 s) – cutting by them clips the start of a word.
 */
export function silenceCut(rms: number[], prevEnd: number, nextStart: number): number {
  const lo = Math.max(0, Math.floor((Math.min(prevEnd, nextStart) - 0.35) / RMS_STEP_S));
  const hi = Math.min(rms.length - 1, Math.ceil((Math.max(prevEnd, nextStart) + 0.1) / RMS_STEP_S));
  if (hi < lo) return (prevEnd + nextStart) / 2;
  const min = Math.min(...rms.slice(lo, hi + 1));
  const quiet = (k: number) => rms[k]! <= Math.max(min * 3, min + 60);
  let best = { from: lo, len: 0 };
  for (let k = lo; k <= hi; ) {
    if (!quiet(k)) {
      k++;
      continue;
    }
    let e = k;
    while (e + 1 <= hi && quiet(e + 1)) e++;
    if (e - k + 1 > best.len) best = { from: k, len: e - k + 1 };
    k = e + 1;
  }
  return (best.from + best.len / 2) * RMS_STEP_S;
}

/** End of speech after the last word: start of the first 150 ms of silence + 50 ms (or the end of the file). */
export function speechEnd(rms: number[], after: number): number {
  const peak = Math.max(...rms);
  for (let k = Math.max(0, Math.floor((after - 0.1) / RMS_STEP_S)); k + 15 < rms.length; k++) {
    if (rms.slice(k, k + 15).every((x) => x < peak * 0.02)) return k * RMS_STEP_S + 0.05;
  }
  return rms.length * RMS_STEP_S;
}

export interface AudioSegment {
  file: string;
  /** Seconds in the source file: [from, to). */
  from: number;
  to: number;
}

/** Silence at scene joins (the edit cuts in its middle) and a fade at the segment edges. */
export const JOIN_GAP_S = 0.08;
export const JOIN_FADE_S = 0.02;

/** Joins segments into one MP3 with `JOIN_GAP_S` of silence between them; returns where each segment starts. */
export function spliceAudio(segments: AudioSegment[], out: string): { starts: number[]; duration: number } {
  const inputs: string[] = [];
  const filters: string[] = [];
  const starts: number[] = [];
  let t = 0;
  segments.forEach((s, i) => {
    const len = s.to - s.from;
    const last = i === segments.length - 1;
    inputs.push("-i", s.file);
    const fadeIn = i === 0 ? "1" : `min(1,t/${JOIN_FADE_S})`;
    filters.push(
      `[${i}:a]atrim=${s.from.toFixed(3)}:${s.to.toFixed(3)},asetpts=PTS-STARTPTS,aformat=sample_rates=44100:channel_layouts=mono,` +
        `volume='${fadeIn}*min(1,max(0,(${len.toFixed(3)}-t)/${JOIN_FADE_S}))':eval=frame,apad=pad_dur=${last ? 0 : JOIN_GAP_S}[s${i}]`,
    );
    starts.push(t);
    t += len + (last ? 0 : JOIN_GAP_S);
  });
  filters.push(segments.map((_, i) => `[s${i}]`).join("") + `concat=n=${segments.length}:v=0:a=1[out]`);
  ffmpeg([...inputs, "-filter_complex", filters.join(";"), "-map", "[out]", "-b:a", "128k", out]);
  return { starts, duration: t };
}
