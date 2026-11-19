import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  composePropsSchema,
  parseCsv,
  qaResultSchema,
  VOICE_LEDGER_COLUMNS,
  voiceLedgerRowSchema,
  type ComposeProps,
  type QaResult,
  type VoiceLedgerRow,
} from "@shorts/schema";
import { DATA_DIR } from "./paths.js";

/**
 * Machine-readable outputs for the dashboard. Each file is validated against its schema before writing,
 * so a broken file never lands on disk.
 */

export const VOICE_LEDGER_FILE = path.join(DATA_DIR, "voice-ledger.csv");

const json = (data: unknown) => JSON.stringify(data, null, 2) + "\n";

/** `<video dir>/qa-<narrator>.json` – the same result as `qa-<narrator>.md`. */
export function writeQaJson(dir: string, narrator: string, result: QaResult): string {
  const file = path.join(dir, `qa-${narrator}.json`);
  writeFileSync(file, json(qaResultSchema.parse(result)), "utf8");
  return file;
}

/** `<video dir>/compose-<narrator>.json` – the timeline the video is rendered from. */
export function writeComposeJson(dir: string, narrator: string, props: ComposeProps): string {
  const file = path.join(dir, `compose-${narrator}.json`);
  writeFileSync(file, json(composePropsSchema.parse(props)), "utf8");
  return file;
}

const csvRow = (r: VoiceLedgerRow) => VOICE_LEDGER_COLUMNS.map((c) => String(r[c] ?? "")).join(",");

/** Appends rows to `data/voice-ledger.csv`; writes the header when the file is new. */
export function appendVoiceLedger(rows: VoiceLedgerRow[], file = VOICE_LEDGER_FILE): void {
  if (!rows.length) return;
  const valid = rows.map((r) => voiceLedgerRowSchema.parse(r));
  mkdirSync(path.dirname(file), { recursive: true });
  const header = existsSync(file) ? "" : VOICE_LEDGER_COLUMNS.join(",") + "\n";
  appendFileSync(file, header + valid.map(csvRow).join("\n") + "\n", "utf8");
}

export function readVoiceLedger(file = VOICE_LEDGER_FILE): VoiceLedgerRow[] {
  if (!existsSync(file)) return [];
  const [head, ...rows] = parseCsv(readFileSync(file, "utf8").replace(/^﻿/, ""));
  if (!head) return [];
  return rows.map((r, i) => {
    const get = (c: string) => r[head.indexOf(c)] ?? "";
    const parsed = voiceLedgerRowSchema.safeParse({
      date: get("date"),
      film: get("film"),
      narrator: get("narrator"),
      model: get("model"),
      kind: get("kind"),
      chars: Number(get("chars")),
      ...(get("scene") === "" ? {} : { scene: Number(get("scene")) }),
    });
    if (!parsed.success) throw new Error(`${path.basename(file)} row ${i + 2}: ${parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")}`);
    return parsed.data;
  });
}

/** Today in local time, YYYY-MM-DD. */
export function today(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
