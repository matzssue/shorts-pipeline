import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { CONTENT_DIR, PIPELINE_DIR } from "./paths.js";

const narratorSchema = z
  .strictObject({
    id: z.string().regex(/^[a-z0-9-]+$/, "kebab-case"),
    name: z.string().min(1),
    /** ElevenLabs voice ID. Not a secret, but account-specific – prefer `voiceIdEnv`. */
    voiceId: z.string().min(1).optional(),
    /** Name of the env variable that holds the voice ID. */
    voiceIdEnv: z.string().regex(/^[A-Z][A-Z0-9_]*$/).optional(),
    model: z.string().min(1),
    /** Forced pronunciation language; without it the voice keeps more of its own accent. */
    languageCode: z.string().min(2).optional(),
    /** 0–1: lower = more expressive. */
    stability: z.number().min(0).max(1).optional(),
  })
  .refine((n) => n.voiceId || n.voiceIdEnv, "set voiceId or voiceIdEnv");

const channelSchema = z.strictObject({
  /** Short ID used in `--channel` and in env names, e.g. `a` → `YT_REFRESH_TOKEN_A`. */
  id: z.string().regex(/^[a-z0-9]+$/, "lowercase letters and digits"),
  name: z.string().min(1),
  /** Default YouTube category for uploads (22 = People & Blogs). */
  youtubeCategoryId: z.string().regex(/^\d+$/).default("22"),
});

export const configSchema = z.strictObject({
  channels: z.array(channelSchema).min(1),
  narrators: z.array(narratorSchema).min(1),
  /** Series titles shown on the intro card, by series number. */
  series: z.record(z.string().regex(/^\d+$/), z.string().min(1)).default({}),
  /** Label above the source overlay in the video (in the video's language). */
  sourceLabel: z.string().min(1).default("Source"),
  /** Language of the videos (BCP-47), e.g. "pl" – sent to YouTube as the video and audio language. */
  language: z.string().min(2).default("en"),
  /** Sentence every description must contain to disclose AI use; empty = no check. */
  disclosure: z.string().default(""),
});

export type Config = z.infer<typeof configSchema>;
export type ChannelConfig = Config["channels"][number];
export type NarratorConfig = Config["narrators"][number];

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
