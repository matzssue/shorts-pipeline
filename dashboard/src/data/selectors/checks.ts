import type { QaLevel } from "@shorts/schema";
import { daysBetween, type Film } from "../join";
import type { QaGroupKey } from "./film";

/*
 * The Checks view: QA results of every checked video as a matrix (videos × checks), the checks that
 * flag most often, flags per video week by week, and the videos held back by an error.
 * QA writes plain messages, so each message is mapped back to the check in `runQa` that wrote it.
 */

export interface QaColumn {
  key: string;
  name: string;
  group: QaGroupKey;
  /** Runs on every video (13 of them); the others appear only when they flag something. */
  always: boolean;
  test: RegExp;
}

/** The checks of the pipeline's `runQa`, in the order of the code. */
export const QA_COLUMNS: readonly QaColumn[] = [
  { key: "render", name: "Final video", group: "video", always: false, test: /^no final/ },
  { key: "length", name: "Length", group: "video", always: true, test: /^length / },
  { key: "frame", name: "Frame size", group: "video", always: true, test: /^frame / },
  { key: "fresh", name: "Up to date", group: "video", always: false, test: /^video older/ },
  { key: "narration", name: "Narration", group: "narration", always: true, test: /^(no narration|narration )/ },
  { key: "captions", name: "Captions", group: "narration", always: true, test: /^captions/ },
  { key: "forbidden", name: "Forbidden words", group: "content", always: true, test: /^(forbidden|no forbidden)/ },
  { key: "aiPhrases", name: "AI phrases", group: "content", always: true, test: /^(sounds like AI|no typical AI)/ },
  { key: "claims", name: "Claims", group: "content", always: true, test: /^(claims without|\d+ claims)/ },
  { key: "firstFrame", name: "First frame", group: "format", always: true, test: /^first frame/ },
  { key: "motion", name: "Motion", group: "format", always: true, test: /^(motion|video only)/ },
  { key: "sourceCard", name: "Source card", group: "format", always: true, test: /^(source shown|no source card)/ },
  { key: "question", name: "Question", group: "format", always: true, test: /^last scene/ },
  { key: "exclamations", name: "Exclamations", group: "narration", always: false, test: /^\d+ exclamation/ },
  { key: "disclosure", name: "AI disclosure", group: "description", always: true, test: /^description (discloses|without)/ },
  { key: "sourceNamed", name: "Source named", group: "description", always: true, test: /^description (names|does not name)/ },
  { key: "link", name: "No link", group: "description", always: false, test: /^link in the description/ },
];

export const qaColumn = (text: string): QaColumn | undefined => QA_COLUMNS.find((c) => c.test.test(text));

const RANK: Record<QaLevel, number> = { ok: 0, warning: 1, error: 2 };
const GROUP_ORDER: readonly QaGroupKey[] = ["video", "narration", "content", "format", "description", "other"];

export interface MatrixCell {
  level: QaLevel;
  texts: string[];
}

export interface MatrixRow {
  id: string;
  number: number;
  title: string;
  passed: boolean;
  /** Undefined: the check did not run for this video. */
  cells: Record<string, MatrixCell | undefined>;
  warnings: number;
  errors: number;
}

export interface ChecksPage {
  columns: QaColumn[];
  rows: MatrixRow[];
  /** Messages no column knows (a new check in the pipeline) – listed, not lost. */
  unknown: { id: string; text: string }[];
  ranking: { key: string; name: string; warnings: number; errors: number }[];
  weeks: { week: number; from: string; videos: number; flags: number }[];
  held: { id: string; number: number; title: string; errors: string[]; warnings: string[] }[];
  totals: { checked: number; clean: number; withWarnings: number; failed: number; notChecked: number };
}

export function checksPage(films: Film[]): ChecksPage {
  const checked = films.filter((f) => f.qa);
  const unknown: ChecksPage["unknown"] = [];
  const rows: MatrixRow[] = checked.map((f) => {
    const cells: MatrixRow["cells"] = {};
    for (const c of f.qa!.checks) {
      const col = qaColumn(c.text);
      if (!col) {
        unknown.push({ id: f.id, text: c.text });
        continue;
      }
      const cur = cells[col.key];
      cells[col.key] = cur ? { level: RANK[c.level] > RANK[cur.level] ? c.level : cur.level, texts: [...cur.texts, c.text] } : { level: c.level, texts: [c.text] };
    }
    const levels = f.qa!.checks.map((c) => c.level);
    return {
      id: f.id,
      number: f.number,
      title: f.title,
      passed: f.qa!.passed,
      cells,
      warnings: levels.filter((l) => l === "warning").length,
      errors: levels.filter((l) => l === "error").length,
    };
  });

  const columns = QA_COLUMNS.filter((c) => c.always || rows.some((r) => r.cells[c.key])).sort(
    (a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || QA_COLUMNS.indexOf(a) - QA_COLUMNS.indexOf(b),
  );

  const ranking = columns
    .map((c) => ({
      key: c.key,
      name: c.name,
      warnings: rows.filter((r) => r.cells[c.key]?.level === "warning").length,
      errors: rows.filter((r) => r.cells[c.key]?.level === "error").length,
    }))
    .filter((x) => x.warnings + x.errors > 0)
    .sort((a, b) => b.warnings + b.errors - (a.warnings + a.errors) || b.errors - a.errors);

  // Weeks counted from the first video of the season, so the strip lines up with Films.
  const start = films.map((f) => f.made).sort()[0];
  const byWeek = new Map<number, { videos: number; flags: number }>();
  for (const f of checked) {
    const week = Math.floor(daysBetween(start!, f.made) / 7) + 1;
    const w = byWeek.get(week) ?? { videos: 0, flags: 0 };
    w.videos += 1;
    w.flags += f.qa!.checks.filter((c) => c.level !== "ok").length;
    byWeek.set(week, w);
  }
  const last = Math.max(0, ...byWeek.keys());
  const weeks = Array.from({ length: last }, (_, i) => {
    const w = byWeek.get(i + 1) ?? { videos: 0, flags: 0 };
    const d = new Date(`${start}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i * 7);
    return { week: i + 1, from: d.toISOString().slice(0, 10), ...w };
  });

  const held = checked
    .filter((f) => !f.qa!.passed)
    .map((f) => ({
      id: f.id,
      number: f.number,
      title: f.title,
      errors: f.qa!.checks.filter((c) => c.level === "error").map((c) => c.text),
      warnings: f.qa!.checks.filter((c) => c.level === "warning").map((c) => c.text),
    }));

  return {
    columns,
    rows,
    unknown,
    ranking,
    weeks,
    held,
    totals: {
      checked: rows.length,
      clean: rows.filter((r) => r.passed && !r.warnings).length,
      withWarnings: rows.filter((r) => r.passed && r.warnings).length,
      failed: rows.filter((r) => !r.passed).length,
      notChecked: films.length - rows.length,
    },
  };
}
