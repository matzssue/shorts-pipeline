import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ffmpeg } from "../lib/ffmpeg.js";
import { ASSETS_DIR, OUT_DIR } from "../lib/paths.js";
import { flowPlanSchema, type FlowPlan, type FlowStep } from "../schema/flow.js";

/** Flow step: a package per shot for a video generator used by hand, and import of the downloaded clips. */

export const VIDEO_EXTS = [".mp4", ".mov", ".webm"];
export const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp"];
/** Files still downloading (Chrome, Edge, Firefox). */
const PARTIAL_EXTS = [".crdownload", ".part", ".tmp", ".download"];

export function loadPlan(file: string): FlowPlan {
  const parsed = flowPlanSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "(plan)"}: ${i.message}`);
    throw new Error(`Invalid plan ${file}:\n${lines.join("\n")}`);
  }
  return parsed.data;
}

export const filmDir = (plan: FlowPlan) => path.join(OUT_DIR, plan.film);

/** Prompt ready to paste: characters substituted and the fixed suffix appended. */
export function buildPrompt(plan: FlowPlan, step: FlowStep): string {
  let text = step.prompt;
  for (const [key, value] of Object.entries(plan.characters)) text = text.replace(new RegExp(`\\b${key}\\b`, "g"), value);
  // A sentence that starts with a substitution gets a capital letter.
  text = text.replace(/(^|[.!?]\s+)([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());
  if (step.kind === "video" && step.suffix && plan.suffix) text = `${text.trim()} ${plan.suffix.trim()}`;
  return text.trim();
}

/** Source file of a reference; for image: looks for the downloaded image in frames/. */
export function refSource(ref: string, dir: string): string {
  const [type, rest] = [ref.slice(0, ref.indexOf(":")), ref.slice(ref.indexOf(":") + 1)];
  if (type === "asset") {
    const [character, file] = rest.split("/") as [string, string];
    return path.join(ASSETS_DIR, "character", character, "photos", "cutout", file);
  }
  if (type === "frame") {
    const [id, at] = rest.split("@") as [string, string];
    return path.join(dir, "frames", `${id}-${at}.jpg`);
  }
  if (type === "image") return imageFile(dir, rest) ?? path.join(dir, "frames", `${rest}.png`);
  return path.join(dir, rest);
}

export function imageFile(dir: string, id: string): string | undefined {
  return IMAGE_EXTS.map((e) => path.join(dir, "frames", `${id}${e}`)).find((f) => existsSync(f));
}

export const clipFile = (dir: string, id: string) => path.join(dir, "clips", `${id}.mp4`);

export function isDone(dir: string, step: FlowStep): boolean {
  return step.kind === "image" ? !!imageFile(dir, step.id) : existsSync(clipFile(dir, step.id));
}

/** Frames that later steps take from clip `id` (e.g. ["end", "2"]). */
export function framesNeeded(plan: FlowPlan, id: string): string[] {
  const out = new Set<string>();
  for (const s of plan.steps) {
    for (const r of [...s.refs, ...(s.start ? [s.start] : [])]) {
      const m = /^frame:([\w-]+)@(.+)$/.exec(r);
      if (m && m[1] === id) out.add(m[2]!);
    }
  }
  return [...out];
}

const pad = (n: number) => String(n).padStart(2, "0");
export const stepFolder = (plan: FlowPlan, step: FlowStep) => `${pad(plan.steps.indexOf(step) + 1)}-${step.id}`;

export interface PackedStep {
  folder: string;
  prompt: string;
  /** References that do not exist yet (e.g. a frame from a clip that is not downloaded). */
  missing: string[];
}

/** Folder out/<video>/flow/<no>-<id>/: prompt.txt, start-*.jpg, ref<n>-*.jpg. Replaces the previous version. */
export function packStep(plan: FlowPlan, step: FlowStep): PackedStep {
  const dir = filmDir(plan);
  const folder = path.join(dir, "flow", stepFolder(plan, step));
  rmSync(folder, { recursive: true, force: true });
  mkdirSync(folder, { recursive: true });
  const prompt = buildPrompt(plan, step);
  writeFileSync(path.join(folder, "prompt.txt"), prompt + "\n");
  const missing: string[] = [];
  const copy = (ref: string, prefix: string) => {
    const src = refSource(ref, dir);
    if (!existsSync(src)) return missing.push(ref);
    copyFileSync(src, path.join(folder, `${prefix}-${path.basename(src)}`));
  };
  if (step.start) copy(step.start, "start");
  step.refs.forEach((r, i) => copy(r, `ref${i + 1}`));
  return { folder, prompt, missing };
}

const MODE = { ingredients: "Ingredients (reference images)", frames: "Frames (start frame)" } as const;

export function describeStep(plan: FlowPlan, step: FlowStep): string {
  const n = plan.steps.indexOf(step) + 1;
  const what = step.kind === "image" ? "Image" : `Video · ${MODE[step.mode]}${step.seconds ? ` · ${step.seconds} s` : ""}`;
  return `${n}/${plan.steps.length} · ${step.id} · ${what}\n   ${step.note}`;
}

/** Checklist for the whole video: flow/00-list.txt. */
export function writeList(plan: FlowPlan): string {
  const dir = filmDir(plan);
  const lines = [
    `Clips to generate – ${plan.film}`,
    "Recording order. Each step has a folder with prompt.txt and files to upload (start-* = start frame, ref* = references).",
    "",
    ...plan.steps.map((s) => `${isDone(dir, s) ? "[x]" : "[ ]"} ${describeStep(plan, s)}`),
  ];
  const file = path.join(dir, "flow", "00-list.txt");
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, lines.join("\n") + "\n");
  return file;
}

export interface DownloadCandidate {
  file: string;
  mtimeMs: number;
  size: number;
}

/** Folder state at the start of waiting: path → size and date. */
export type Snapshot = Map<string, string>;
const stamp = (f: DownloadCandidate) => `${f.size}:${f.mtimeMs}`;

export function snapshot(files: DownloadCandidate[]): Snapshot {
  return new Map(files.map((f) => [path.resolve(f.file), stamp(f)]));
}

/**
 * A new download = a file that was not there when waiting started, or that changed since.
 * File dates on Windows are unreliable (a copy keeps its date; a new file named like a deleted one gets the old creation date).
 * Skips files still downloading and already imported ones; of several, takes the newest.
 */
export function pickDownload(files: DownloadCandidate[], before: Snapshot, exts: string[], ignore: Set<string> = new Set()): DownloadCandidate | undefined {
  return files
    .filter((f) => f.size > 0 && before.get(path.resolve(f.file)) !== stamp(f) && !ignore.has(path.resolve(f.file)))
    .filter((f) => exts.includes(path.extname(f.file).toLowerCase()) && !PARTIAL_EXTS.some((p) => f.file.toLowerCase().endsWith(p)))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
}

export function listCandidates(dirs: string[]): DownloadCandidate[] {
  const out: DownloadCandidate[] = [];
  for (const d of dirs) {
    if (!existsSync(d)) continue;
    for (const name of readdirSync(d)) {
      const file = path.join(d, name);
      try {
        const st = statSync(file);
        if (st.isFile()) out.push({ file, mtimeMs: st.mtimeMs, size: st.size });
      } catch {
        // the file disappeared while listing
      }
    }
  }
  return out;
}

/** Move out of Downloads (rename only works on the same drive – otherwise copy and delete). */
function moveFile(src: string, dst: string): void {
  try {
    renameSync(src, dst);
  } catch {
    copyFileSync(src, dst);
    rmSync(src, { force: true });
  }
}

export interface ImportResult {
  saved: string;
  archived?: string;
  frames: string[];
}

/**
 * Imports a downloaded file into a step: the previous version goes to clips/old/ (or frames/old/),
 * the clip is re-encoded to clips-h264/ (Remotion reports "No frame found" on some generator files),
 * frames for later steps and for preview go to frames/.
 */
export function importDownload(plan: FlowPlan, step: FlowStep, src: string): ImportResult {
  const dir = filmDir(plan);
  const ts = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
  if (step.kind === "image") {
    const framesDir = path.join(dir, "frames");
    mkdirSync(path.join(framesDir, "old"), { recursive: true });
    const old = imageFile(dir, step.id);
    let archived: string | undefined;
    if (old) moveFile(old, (archived = path.join(framesDir, "old", `${step.id}-${ts}${path.extname(old)}`)));
    const saved = path.join(framesDir, `${step.id}${path.extname(src).toLowerCase()}`);
    moveFile(src, saved);
    return { saved, archived, frames: [] };
  }
  const clips = path.join(dir, "clips");
  mkdirSync(path.join(clips, "old"), { recursive: true });
  mkdirSync(path.join(dir, "clips-h264"), { recursive: true });
  mkdirSync(path.join(dir, "frames"), { recursive: true });
  const saved = clipFile(dir, step.id);
  let archived: string | undefined;
  // A clip saved straight under its target name stays where it is, no archiving.
  const inPlace = path.resolve(src) === path.resolve(saved);
  if (existsSync(saved) && !inPlace) moveFile(saved, (archived = path.join(clips, "old", `${step.id}-${ts}.mp4`)));
  if (inPlace) {
    // nothing to move
  } else if (path.extname(src).toLowerCase() === ".mp4") moveFile(src, saved);
  else {
    ffmpeg(["-i", src, "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", saved]);
    rmSync(src, { force: true });
  }
  ffmpeg(["-i", saved, "-an", "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-r", "30", "-g", "15", path.join(dir, "clips-h264", `${step.id}.mp4`)]);
  const frames: string[] = [];
  for (const at of new Set(["0.5", "end", ...framesNeeded(plan, step.id)])) {
    const out = path.join(dir, "frames", `${step.id}-${at}.jpg`);
    const seek = at === "end" ? ["-sseof", "-0.1"] : ["-ss", at];
    ffmpeg([...seek, "-i", saved, "-frames:v", "1", "-q:v", "2", out]);
    frames.push(out);
  }
  return { saved, archived, frames };
}
