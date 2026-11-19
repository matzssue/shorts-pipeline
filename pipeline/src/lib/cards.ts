import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { z } from "zod";
import { rel } from "./paths.js";

/** Result of checking a card (product or topic). */
export interface CardCheck<T> {
  id: string;
  file: string;
  card?: T;
  /** Errors: the card is invalid and the pipeline will not use it. */
  errors: string[];
  /** Warnings: the card is valid, but a video made from it will not pass the checklist yet. */
  warnings: string[];
}

export function cardFile(dir: string, id: string): string {
  return path.join(dir, `${id}.json`);
}

export function listCardIds(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -".json".length))
    .sort();
}

/** Reads JSON (tolerates a BOM). Returns the data or an error message. */
export function readCardJson(file: string): { data?: unknown; error?: string } {
  if (!existsSync(file)) return { error: `file not found: ${file}` };
  try {
    return { data: JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, "")) };
  } catch (err) {
    return { error: `invalid JSON: ${(err as Error).message}` };
  }
}

/** Validates data with a schema; errors as "path: message". */
export function parseCard<S extends z.ZodType>(
  schema: S,
  data: unknown,
): { card?: z.infer<S>; errors: string[] } {
  const parsed = schema.safeParse(data);
  if (parsed.success) return { card: parsed.data, errors: [] };
  return {
    errors: parsed.error.issues.map((issue) => {
      const where = issue.path.length > 0 ? issue.path.join(".") : "(card)";
      return `${where}: ${issue.message}`;
    }),
  };
}

export function daysBetween(fromIsoDate: string, today: Date): number {
  return Math.floor((today.getTime() - Date.parse(fromIsoDate)) / 86_400_000);
}

export function formatCheck(check: CardCheck<unknown>): string {
  const status = check.errors.length > 0 ? "ERROR" : check.warnings.length > 0 ? "WARN" : "OK";
  const lines = [`[${status}] ${check.id} (${rel(check.file)})`];
  for (const e of check.errors) lines.push(`  ✗ ${e}`);
  for (const w of check.warnings) lines.push(`  ! ${w}`);
  return lines.join("\n");
}
