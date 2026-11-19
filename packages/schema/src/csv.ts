/** CSV used by the pipeline data files (publications.csv, voice-ledger.csv). */

/** Simple CSV parser (quotes, commas and newlines inside fields). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") row.push(field), (field = "");
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field), rows.push(row), (row = []), (field = "");
    } else field += c;
  }
  if (field || row.length) row.push(field), rows.push(row);
  return rows.filter((r) => r.some((f) => f.trim()));
}

/**
 * Rows as records keyed by the header. Throws when a required column is missing.
 * A UTF-8 BOM (Excel) is ignored.
 */
export function csvRecords(text: string, required: readonly string[] = []): Record<string, string>[] {
  const [head, ...rows] = parseCsv(text.replace(/^﻿/, ""));
  if (!head) return [];
  for (const c of required) if (!head.includes(c)) throw new Error(`missing column ${c}`);
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}
