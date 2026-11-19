import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  composePropsSchema,
  configSchema,
  csvRecords,
  productSchema,
  PUBLICATION_COLUMNS,
  publicationSchema,
  qaResultSchema,
  scriptSchema,
  statsSnapshotSchema,
  topicSchema,
  VOICE_LEDGER_COLUMNS,
  voiceLedgerRowSchema,
  voiceTimingsSchema,
  type ComposeProps,
  type Config,
  type Product,
  type Publication,
  type QaResult,
  type Script,
  type StatsSnapshot,
  type Topic,
  type VoiceLedgerRow,
  type VoiceTimings,
} from "@shorts/schema";
import type { z } from "zod";

/**
 * Reads a content directory (the same layout the pipeline writes) and validates every file with
 * @shorts/schema. A broken file stops the build with its path and the failing field.
 */

export class DataError extends Error {
  constructor(
    readonly file: string,
    readonly field: string,
    message: string,
  ) {
    super(`${file}: ${field ? `${field}: ` : ""}${message}`);
    this.name = "DataError";
  }
}

/** One video folder in out/, for one narrator. */
export interface RawFilm {
  /** `<date>-<card id>-<format>` */
  folder: string;
  made: string;
  cardId: string;
  narrator?: string;
  script: Script;
  voice?: VoiceTimings;
  compose?: ComposeProps;
  qa?: QaResult;
}

export interface Catalog {
  dir: string;
  config: Config;
  topics: Topic[];
  products: Product[];
  films: RawFilm[];
  publications: Publication[];
  /** Sorted by measuredAt. */
  snapshots: StatsSnapshot[];
  ledger: VoiceLedgerRow[];
}

export const FOLDER_RE = /^(\d{4}-\d{2}-\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)-(F\d)$/;

/**
 * The content directory: DASHBOARD_CONTENT_DIR, else the committed mock fixtures.
 * The public build (base path set) always uses the fixtures – real data never reaches GitHub Pages.
 */
export function contentDir(env: Record<string, string | undefined> = process.env, cwd = process.cwd()): string {
  const custom = env.DASHBOARD_CONTENT_DIR;
  if (custom && env.DASHBOARD_BASE_PATH) throw new Error("DASHBOARD_CONTENT_DIR is not allowed in the public build (DASHBOARD_BASE_PATH is set)");
  return path.resolve(cwd, custom ?? "../fixtures/content");
}

function parse<S extends z.ZodType>(schema: S, data: unknown, file: string): z.infer<S> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const issue = r.error.issues[0]!;
    throw new DataError(file, issue.path.join("."), issue.message);
  }
  return r.data;
}

function readJson(dir: string, rel: string): unknown {
  try {
    return JSON.parse(readFileSync(path.join(dir, rel), "utf8").replace(/^﻿/, ""));
  } catch (e) {
    throw new DataError(rel, "", e instanceof SyntaxError ? `invalid JSON (${e.message})` : (e as Error).message);
  }
}

const list = (dir: string, rel: string) => (existsSync(path.join(dir, rel)) ? readdirSync(path.join(dir, rel)).sort() : []);

function readCsv<S extends z.ZodType>(dir: string, rel: string, columns: readonly string[], schema: S, coerce: (r: Record<string, string>) => unknown): z.infer<S>[] {
  if (!existsSync(path.join(dir, rel))) return [];
  let records: Record<string, string>[];
  try {
    records = csvRecords(readFileSync(path.join(dir, rel), "utf8"), columns);
  } catch (e) {
    throw new DataError(rel, "", (e as Error).message);
  }
  return records.map((r, i) => parse(schema, coerce(r), `${rel} row ${i + 2}`));
}

function readFilms(dir: string): RawFilm[] {
  const films: RawFilm[] = [];
  for (const folder of list(dir, "out")) {
    const m = FOLDER_RE.exec(folder);
    if (!m) continue;
    const base = `out/${folder}`;
    if (!existsSync(path.join(dir, base, "script.json"))) continue;
    const script = parse(scriptSchema, readJson(dir, `${base}/script.json`), `${base}/script.json`);
    const narrators = new Set<string>();
    for (const f of list(dir, `${base}/voice`)) if (f.endsWith(".json")) narrators.add(f.slice(0, -5));
    for (const f of list(dir, base)) {
      const n = /^(?:compose|qa)-(.+)\.json$/.exec(f)?.[1];
      if (n) narrators.add(n);
    }
    const common = { folder, made: m[1]!, cardId: m[2]!, script };
    if (narrators.size === 0) films.push(common);
    for (const n of [...narrators].sort()) {
      const opt = <S extends z.ZodType>(rel: string, schema: S) => (existsSync(path.join(dir, rel)) ? parse(schema, readJson(dir, rel), rel) : undefined);
      films.push({
        ...common,
        narrator: n,
        voice: opt(`${base}/voice/${n}.json`, voiceTimingsSchema),
        compose: opt(`${base}/compose-${n}.json`, composePropsSchema),
        qa: opt(`${base}/qa-${n}.json`, qaResultSchema),
      });
    }
  }
  return films;
}

export function loadCatalog(dir = contentDir()): Catalog {
  if (!existsSync(dir)) throw new DataError(dir, "", "content directory not found");
  const cards = <S extends z.ZodType>(sub: string, schema: S) => list(dir, sub).filter((f) => f.endsWith(".json")).map((f) => parse(schema, readJson(dir, `${sub}/${f}`), `${sub}/${f}`));
  const snapshots = list(dir, "data/stats")
    .filter((f) => f.endsWith(".json"))
    .map((f) => parse(statsSnapshotSchema, readJson(dir, `data/stats/${f}`), `data/stats/${f}`))
    .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  return {
    dir,
    config: parse(configSchema, readJson(dir, "shorts.config.json"), "shorts.config.json"),
    topics: cards("topics", topicSchema),
    products: cards("products", productSchema),
    films: readFilms(dir),
    publications: readCsv(dir, "data/publications.csv", PUBLICATION_COLUMNS, publicationSchema, (r) => ({ ...r, platform: r.platform?.toLowerCase(), channel: r.channel?.toLowerCase() })),
    snapshots,
    ledger: readCsv(dir, "data/voice-ledger.csv", VOICE_LEDGER_COLUMNS, voiceLedgerRowSchema, ({ scene, chars, ...r }) => ({ ...r, chars: Number(chars), ...(scene ? { scene: Number(scene) } : {}) })),
  };
}
