import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  composePropsSchema,
  configSchema,
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
} from "@shorts/schema";
import { buildContent, writeContent } from "../src/generate.js";
import { MEDIAN_VIEWS_14D } from "../src/model.js";
import { SEASON } from "../src/plan.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const FIXTURES = path.join(ROOT, "fixtures", "content");

const tmp = () => mkdtempSync(path.join(tmpdir(), "mock-"));

function hashTree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = path.join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out[path.relative(dir, p).replaceAll("\\", "/")] = createHash("sha256").update(readFileSync(p)).digest("hex");
    }
  };
  walk(dir);
  return out;
}

/** Simple CSV reader for the generated files (no quoted fields there). */
function readCsv(file: string, columns: readonly string[]): Record<string, string>[] {
  const [head, ...rows] = readFileSync(file, "utf8").trim().split("\n");
  assert.equal(head, columns.join(","));
  return rows.map((r) => Object.fromEntries(r.split(",").map((v, i) => [columns[i]!, v])));
}

const content = buildContent();
const last = content.snapshots.at(-1)!;

describe("determinism", () => {
  it("two runs write identical files", () => {
    const a = tmp();
    const b = tmp();
    writeContent(a);
    writeContent(b);
    assert.deepEqual(hashTree(a), hashTree(b));
  });

  it("fixtures/content is up to date (run `pnpm mock` after changing the generator)", () => {
    const fresh = tmp();
    writeContent(fresh);
    assert.deepEqual(hashTree(FIXTURES), hashTree(fresh));
  });
});

describe("every file passes its schema", () => {
  const dir = tmp();
  const files = writeContent(dir);
  const read = (rel: string) => JSON.parse(readFileSync(path.join(dir, rel), "utf8"));
  const check = (pattern: RegExp, schema: { safeParse: (d: unknown) => { success: boolean } }) => {
    const matching = files.filter((f) => pattern.test(f));
    assert.ok(matching.length > 0, `no files for ${pattern}`);
    for (const f of matching) assert.equal(schema.safeParse(read(f)).success, true, f);
  };

  it("config, cards", () => {
    check(/^shorts\.config\.json$/, configSchema);
    check(/^topics\//, topicSchema);
    check(/^products\//, productSchema);
  });

  it("scripts, narration, timelines, QA", () => {
    check(/\/script\.json$/, scriptSchema);
    check(/\/voice\/[^/]+\.json$/, voiceTimingsSchema);
    check(/\/compose-[^/]+\.json$/, composePropsSchema);
    check(/\/qa-[^/]+\.json$/, qaResultSchema);
  });

  it("publications, stats, voice ledger", () => {
    check(/^data\/stats\//, statsSnapshotSchema);
    for (const row of readCsv(path.join(dir, "data/publications.csv"), PUBLICATION_COLUMNS)) assert.equal(publicationSchema.safeParse(row).success, true);
    for (const row of readCsv(path.join(dir, "data/voice-ledger.csv"), VOICE_LEDGER_COLUMNS)) {
      const parsed = { ...row, chars: Number(row.chars), ...(row.scene ? { scene: Number(row.scene) } : { scene: undefined }) };
      if (parsed.scene === undefined) delete (parsed as { scene?: number }).scene;
      assert.equal(voiceLedgerRowSchema.safeParse(parsed).success, true, JSON.stringify(row));
    }
  });

  it("every publication points to an existing video folder", () => {
    for (const p of content.publications) assert.ok(existsSync(path.join(dir, path.dirname(p.file))), p.file);
  });
});

describe("scenarios", () => {
  it("1. a video from the last two days has no Analytics data yet", () => {
    const recent = last.youtube.filter((r) => r.pub.date >= "2026-02-13");
    assert.ok(recent.length > 0);
    assert.ok(recent.every((r) => r.avgViewPercent === undefined && r.subscribersGained === undefined));
  });

  it("2. a video published on one platform only", () => {
    const byFile = new Map<string, Set<string>>();
    for (const p of content.publications) byFile.set(p.file, (byFile.get(p.file) ?? new Set()).add(p.platform));
    assert.ok([...byFile.values()].some((s) => s.size === 1));
  });

  it("3. a video failing QA: narration recorded for a different text", () => {
    const failed = content.films.filter((f) => f.qa && !f.qa.passed);
    assert.equal(failed.length, 1);
    assert.ok(failed[0]!.qa!.checks.some((c) => c.level === "error" && c.text.includes("different text")));
  });

  it("4. a video waiting for the narration and one waiting for clips", () => {
    assert.ok(content.films.some((f) => !f.voice));
    assert.ok(content.films.some((f) => f.voice && !f.compose));
  });

  it("5. a video that passed QA but is not published", () => {
    assert.ok(content.films.some((f) => f.qa?.passed && !f.plan.publish));
  });

  it("6. one hit, several times above the median", () => {
    const views = last.youtube.map((r) => r.views!).sort((a, b) => a - b);
    const median = views[Math.floor(views.length / 2)]!;
    assert.ok(views.at(-1)! >= 3 * median, `top ${views.at(-1)} vs median ${median}`);
    assert.ok(median > MEDIAN_VIEWS_14D / 4 && median < MEDIAN_VIEWS_14D * 4);
  });

  it("7. re-recorded takes, and a cache hit with 0 characters", () => {
    assert.ok(content.ledger.filter((r) => r.kind === "take").length >= 2);
    assert.ok(content.ledger.some((r) => r.kind === "cache" && r.chars === 0));
    assert.ok(content.films.some((f) => f.voice?.sources?.some((s) => s.startsWith("voice/takes/"))));
  });

  it("8. a very long title", () => {
    assert.ok(content.films.some((f) => f.title.length > 100));
  });

  it("9. a scene with a slowed-down clip", () => {
    assert.ok(content.films.some((f) => f.compose?.scenes.some((s) => s.playbackRate < 0.75)));
  });

  it("10. a snapshot noting the missing Instagram insights permission", () => {
    const s = content.snapshots.find((x) => x.notes.some((n) => n.includes("permission")));
    assert.ok(s);
    assert.ok(s.instagram.length > 0 && s.instagram.every((r) => r.views === undefined));
  });

  it("11. TikTok rows in publications without stats", () => {
    const tiktok = content.publications.filter((p) => p.platform === "tiktok");
    assert.ok(tiktok.length > 0);
    const linked = new Set(content.snapshots.flatMap((s) => [...s.youtube, ...s.instagram].map((r) => r.pub.link)));
    assert.ok(tiktok.every((p) => !linked.has(p.link)));
  });

  it("12. videos that pass QA with warnings, in several checks", () => {
    const warned = content.films.filter((f) => f.qa?.passed && f.qa.checks.some((c) => c.level === "warning"));
    assert.ok(warned.length >= 5, `${warned.length} videos with warnings`);
    const kinds = new Set(warned.flatMap((f) => f.qa!.checks.filter((c) => c.level === "warning").map((c) => c.text.split(" ")[0])));
    assert.ok(kinds.size >= 4, [...kinds].join(", "));
  });

  it("the season has one snapshot per day, numbers never go down", () => {
    assert.equal(content.snapshots[0]!.measuredAt.slice(0, 10), "2026-01-06");
    assert.equal(last.measuredAt.slice(0, 10), SEASON.end);
    for (let i = 1; i < content.snapshots.length; i++) {
      const prev = new Map(content.snapshots[i - 1]!.youtube.map((r) => [r.id, r.views!]));
      for (const r of content.snapshots[i]!.youtube) assert.ok(r.views! >= (prev.get(r.id) ?? 0), `${r.id} on ${content.snapshots[i]!.measuredAt}`);
    }
  });
});

describe("no real data", () => {
  const dir = tmp();
  writeContent(dir);
  const texts = Object.keys(hashTree(dir)).map((rel) => [rel, readFileSync(path.join(dir, rel), "utf8")] as const);

  it("every URL points to example.com", () => {
    for (const [rel, text] of texts) {
      for (const url of text.match(/https?:\/\/[^\s",)]+/g) ?? []) assert.equal(new URL(url).hostname, "example.com", `${rel}: ${url}`);
    }
  });

  it("no platform domains and no real-looking video IDs", () => {
    const banned = /youtube\.com|youtu\.be|instagram\.com|tiktok\.com|facebook\.com|(?:shorts\/|v=)[\w-]{11}(?![\w-])/i;
    for (const [rel, text] of texts) assert.equal(banned.test(text), false, rel);
  });
});
