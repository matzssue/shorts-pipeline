import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { configSchema, type Config } from "@shorts/schema";
import { CONTENT_DIR, PIPELINE_DIR } from "./paths.js";

export type { ChannelConfig, Config, NarratorConfig } from "@shorts/schema";

export const CONFIG_FILE = path.join(CONTENT_DIR, "shorts.config.json");
export const EXAMPLE_CONFIG_FILE = path.join(PIPELINE_DIR, "examples", "shorts.config.example.json");

let cached: Config | undefined;

/** Reads `shorts.config.json` from the content directory, or the bundled example when there is none. */
export function loadConfig(): Config {
  if (cached) return cached;
  const file = existsSync(CONFIG_FILE) ? CONFIG_FILE : EXAMPLE_CONFIG_FILE;
  const raw = JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, "")) as unknown;
  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new Error(`Invalid config ${file}:\n  - ${issues.join("\n  - ")}`);
  }
  const ids = (xs: { id: string }[]) => new Set(xs.map((x) => x.id)).size === xs.length;
  if (!ids(parsed.data.channels) || !ids(parsed.data.narrators)) throw new Error(`Invalid config ${file}: duplicate channel or narrator id`);
  cached = parsed.data;
  return cached;
}

/** For tests: use the given config instead of reading a file. */
export function setConfig(config: Config | undefined): void {
  cached = config;
}
