import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { CONTENT_DIR, FLOWS_DIR } from "./lib/paths.js";
import type { FlowPlan, FlowStep } from "./schema/flow.js";
import {
  clipFile,
  describeStep,
  filmDir,
  IMAGE_EXTS,
  importDownload,
  isDone,
  listCandidates,
  loadPlan,
  packStep,
  pickDownload,
  snapshot,
  VIDEO_EXTS,
  writeList,
} from "./steps/flow.js";

const HELP = `Usage: pnpm flow <plan name | plan file> [--step <id>] [--status] [--downloads <folder>] [--no-open]

Walks you through generating a video's clips by hand in a video generator, step by step (plan: flows/<name>.json):
  1. copies the prompt to the clipboard and opens the folder with files to upload (start frame, references),
  2. waits until you download the clip (your Downloads folder or out/<video>/clips/),
  3. names it, re-encodes it and extracts the frames later steps need,
  4. Enter = next step, r = redo this step, q = quit (you can come back later).
After the last clip it renders a draft if the plan has "render".

  --step <id>   start from this step (e.g. redo clip 04), then continue in order
  --status      only list the steps and what is done
  --downloads   browser download folder (default ${path.join(os.homedir(), "Downloads")})
  --no-open     do not open the folder in the file explorer`;

function resolvePlanFile(arg: string): string | undefined {
  if (existsSync(arg)) return path.resolve(arg);
  const file = path.join(FLOWS_DIR, arg.endsWith(".json") ? arg : `${arg}.json`);
  return existsSync(file) ? file : undefined;
}

/** Copies text to the clipboard (Windows, macOS, Linux with xclip). */
function copyToClipboard(text: string): boolean {
  try {
    if (process.platform === "win32") {
      // Base64 so that non-ASCII characters survive the console code page.
      const b64 = Buffer.from(text, "utf8").toString("base64");
      execFileSync("powershell", ["-NoProfile", "-Command", `Set-Clipboard -Value ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64}')))`]);
    } else if (process.platform === "darwin") {
      execFileSync("pbcopy", { input: text });
    } else {
      execFileSync("xclip", ["-selection", "clipboard"], { input: text });
    }
    return true;
  } catch {
    return false;
  }
}

function openFolder(folder: string): void {
  const cmd = process.platform === "win32" ? "explorer.exe" : process.platform === "darwin" ? "open" : "xdg-open";
  spawn(cmd, [folder], { detached: true, stdio: "ignore" }).on("error", () => {}).unref();
}

/** Keyboard lines in a queue, so "q" also works while waiting for a file. */
function keyboard() {
  const rl = createInterface({ input: process.stdin });
  const lines: string[] = [];
  let wake: (() => void) | undefined;
  rl.on("line", (l) => {
    lines.push(l.trim().toLowerCase());
    wake?.();
  });
  return {
    take: () => lines.shift(),
    next: () => new Promise<string>((resolve) => {
      const l = lines.shift();
      if (l !== undefined) return resolve(l);
      wake = () => {
        wake = undefined;
        resolve(lines.shift() ?? "");
      };
    }),
    close: () => rl.close(),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Waits for a new file; returns its path or a keyboard command. */
async function waitForDownload(plan: FlowPlan, step: FlowStep, dirs: string[], kb: ReturnType<typeof keyboard>): Promise<{ file?: string; key?: string }> {
  const exts = step.kind === "image" ? IMAGE_EXTS : VIDEO_EXTS;
  // Target files of other steps in clips/ are not "downloads". This step's file is: you may save the clip straight as clips/<id>.mp4.
  const ignore = new Set(plan.steps.filter((s) => s.id !== step.id).map((s) => path.resolve(clipFile(filmDir(plan), s.id))));
  const before = snapshot(listCandidates(dirs));
  let last: { file: string; size: number } | undefined;
  for (;;) {
    const key = kb.take();
    if (key === "q" || key === "s") return { key };
    const found = pickDownload(listCandidates(dirs), before, exts, ignore);
    // The file must have the same size in two reads in a row – the download is finished.
    if (found && last && last.file === found.file && last.size === found.size) return { file: found.file };
    last = found && { file: found.file, size: found.size };
    await sleep(1000);
  }
}

async function main(argv: string[]): Promise<number> {
  const args = argv[0] === "--" ? argv.slice(1) : argv;
  let parsed;
  try {
    parsed = parseArgs({
      args,
      strict: true,
      allowPositionals: true,
      options: {
        step: { type: "string" },
        status: { type: "boolean" },
        downloads: { type: "string" },
        "no-open": { type: "boolean" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (err) {
    console.error(`Invalid arguments: ${(err as Error).message}\n\n${HELP}`);
    return 1;
  }
  const { values, positionals } = parsed;
  if (values.help || !positionals[0]) {
    console.log(HELP);
    return values.help ? 0 : 1;
  }
  const planFile = resolvePlanFile(positionals[0]);
  if (!planFile) {
    console.error(`No plan: ${positionals[0]} (looking for flows/<name>.json)`);
    return 1;
  }
  let plan: FlowPlan;
  try {
    plan = loadPlan(planFile);
  } catch (err) {
    console.error((err as Error).message);
    return 1;
  }
  const dir = filmDir(plan);
  const list = writeList(plan);
  if (values.status) {
    console.log(`List: ${list}\n`);
    for (const s of plan.steps) console.log(`${isDone(dir, s) ? "[x]" : "[ ]"} ${describeStep(plan, s)}`);
    return 0;
  }
  if (values.step && !plan.steps.some((s) => s.id === values.step)) {
    console.error(`No step ${values.step}. Steps: ${plan.steps.map((s) => s.id).join(", ")}`);
    return 1;
  }

  const downloads = values.downloads ?? path.join(os.homedir(), "Downloads");
  const watchDirs = [downloads, path.join(dir, "clips")];
  console.log(`Video: ${plan.film}\nWatching for files in: ${watchDirs.join("  and  ")}\nWhile waiting: s + Enter = skip step, q + Enter = quit.\n`);
  if (!existsSync(downloads)) console.log(`! No folder ${downloads} – pass --downloads or save clips to ${watchDirs[1]}\n`);

  const kb = keyboard();
  const startIndex = values.step ? plan.steps.findIndex((s) => s.id === values.step) : 0;
  const forced = new Set(values.step ? [values.step] : []);
  try {
    for (let i = startIndex; i < plan.steps.length; i++) {
      const step = plan.steps[i]!;
      if (isDone(dir, step) && !forced.has(step.id)) continue;
      for (;;) {
        const packed = packStep(plan, step);
        console.log(`\n── ${describeStep(plan, step)}`);
        if (packed.missing.length) console.log(`   ! Missing: ${packed.missing.join(", ")} – do the earlier steps first.`);
        const files = readdirSync(packed.folder).filter((f) => f !== "prompt.txt");
        console.log(`   Folder: ${packed.folder}${files.length ? `\n   Upload: ${files.join(", ")}` : ""}`);
        console.log(copyToClipboard(packed.prompt) ? "   The prompt is on the clipboard – paste it into the generator." : `   Prompt:\n${packed.prompt}`);
        if (!values["no-open"]) openFolder(packed.folder);
        console.log(`   Waiting for the downloaded ${step.kind === "image" ? "image" : "clip"}…`);

        const got = await waitForDownload(plan, step, watchDirs, kb);
        if (got.key === "q") return 0;
        if (got.key === "s") break;
        const res = importDownload(plan, step, got.file!);
        console.log(`   Saved: ${path.relative(dir, res.saved)}${res.archived ? ` (previous version: ${path.relative(dir, res.archived)})` : ""}`);
        if (res.frames.length) console.log(`   Frames: ${res.frames.map((f) => path.basename(f)).join(", ")}`);
        writeList(plan);
        console.log("   Enter = next · r = redo this step · q = quit");
        const key = await kb.next();
        if (key === "q") return 0;
        if (key !== "r") break;
      }
      forced.delete(step.id);
    }
  } finally {
    kb.close();
  }

  const missing = plan.steps.filter((s) => !isDone(dir, s));
  if (missing.length) {
    console.log(`\nSteps left: ${missing.map((s) => s.id).join(", ")}. Run again when you are ready.`);
    return 0;
  }
  console.log("\nAll clips are in place.");
  if (plan.render) {
    console.log(`Rendering a draft: ${plan.render} draft`);
    const r = spawnSync("pnpm", ["exec", "tsx", plan.render, "draft"], { cwd: CONTENT_DIR, stdio: "inherit", shell: true });
    return r.status ?? 1;
  }
  return 0;
}

process.exitCode = await main(process.argv.slice(2));
