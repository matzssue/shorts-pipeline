import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { PIPELINE_DIR } from "./paths.js";

let cached: string | undefined;

/**
 * The ffmpeg binary shipped with Remotion (`@remotion/compositor-*`) – no system install needed.
 * Note: this build has no `afade` filter (fades are done with `volume`).
 */
export function ffmpegPath(): string {
  if (cached) return cached;
  const store = path.join(PIPELINE_DIR, "node_modules", ".pnpm");
  const exe = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  for (const dir of existsSync(store) ? readdirSync(store) : []) {
    if (!dir.startsWith("@remotion+compositor-")) continue;
    const pkg = dir.slice(1, dir.lastIndexOf("@")).replace("+", "/");
    const file = path.join(store, dir, "node_modules", "@" + pkg, exe);
    if (existsSync(file)) return (cached = file);
  }
  throw new Error("ffmpeg from @remotion/compositor not found – run pnpm install");
}

export function ffmpeg(args: string[]): void {
  execFileSync(ffmpegPath(), ["-loglevel", "error", "-y", ...args]);
}
