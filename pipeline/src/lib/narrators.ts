import { loadConfig } from "./config.js";

/** A narrator voice, resolved from the config (`shorts.config.json`). */
export interface Narrator {
  id: string;
  name: string;
  /** Empty when the env variable is not set – the TTS provider reports it. */
  voiceId: string;
  /** Env variable the voice ID comes from (for error messages). */
  voiceIdEnv?: string;
  model: string;
  /** Forced pronunciation language; without it the voice keeps more of its own accent. */
  languageCode?: string;
  /** 0–1: lower = more expressive. */
  stability?: number;
}

export type NarratorId = string;

export function narratorIds(): NarratorId[] {
  return loadConfig().narrators.map((n) => n.id);
}

export function isNarratorId(id: string): boolean {
  return narratorIds().includes(id);
}

export function getNarrator(id: NarratorId): Narrator {
  const n = loadConfig().narrators.find((x) => x.id === id);
  if (!n) throw new Error(`Unknown narrator "${id}" – allowed: ${narratorIds().join(", ")}`);
  const { voiceId, voiceIdEnv, ...rest } = n;
  return { ...rest, voiceId: voiceId ?? (voiceIdEnv ? process.env[voiceIdEnv] : undefined) ?? "", voiceIdEnv };
}

/**
 * Parses `--narrator <id|all>`: the narrator IDs, or undefined when the value is not valid.
 * A missing option gives an empty list.
 */
export function parseNarratorArg(value: string | undefined, allowAll = true): NarratorId[] | undefined {
  if (value === undefined) return [];
  const v = value.trim().toLowerCase();
  if (allowAll && v === "all") return narratorIds();
  return isNarratorId(v) ? [v] : undefined;
}

/** Help text for the `--narrator` option, e.g. `narrator-a|narrator-b|all`. */
export function narratorChoices(allowAll = true): string {
  return [...narratorIds(), ...(allowAll ? ["all"] : [])].join("|");
}
