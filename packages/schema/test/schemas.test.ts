import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { z } from "zod";
import {
  composePropsSchema,
  configSchema,
  flowPlanSchema,
  productSchema,
  publicationSchema,
  qaResultSchema,
  scriptSchema,
  statsSnapshotSchema,
  topicSchema,
  voiceTimingsSchema,
} from "../src/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (file: string): unknown => JSON.parse(readFileSync(path.join(ROOT, file), "utf8"));

/** Deep copy with one change, for "broken file" cases. */
const broken = (file: string, edit: (data: any) => void): unknown => {
  const data = read(file) as any;
  edit(data);
  return data;
};

interface Case {
  name: string;
  schema: z.ZodType;
  file: string;
  /** The example as a list of records (publications.csv rows). */
  list?: boolean;
  bad: (data: any) => void;
}

const CASES: Case[] = [
  { name: "config", schema: configSchema, file: "pipeline/examples/shorts.config.example.json", bad: (d) => (d.channels[0].id = "Channel A") },
  { name: "topic", schema: topicSchema, file: "pipeline/examples/topic.example.json", bad: (d) => (d.formats = ["F1"]) },
  { name: "product", schema: productSchema, file: "pipeline/examples/product.example.json", bad: (d) => delete d.id },
  { name: "script", schema: scriptSchema, file: "pipeline/examples/script.example.json", bad: (d) => (d.format = "F9") },
  { name: "flow", schema: flowPlanSchema, file: "pipeline/examples/flow.example.json", bad: (d) => (d.unknownKey = true) },
  { name: "publication", schema: publicationSchema, file: "packages/schema/examples/publication.example.json", list: true, bad: (d) => (d[0].date = "12.11.2026") },
  { name: "stats snapshot", schema: statsSnapshotSchema, file: "packages/schema/examples/stats.example.json", bad: (d) => (d.youtube[0].views = -1) },
  { name: "voice timings", schema: voiceTimingsSchema, file: "packages/schema/examples/voice.example.json", bad: (d) => (d.scenes[0].voice = { start: "0" }) },
  { name: "QA result", schema: qaResultSchema, file: "packages/schema/examples/qa.example.json", bad: (d) => (d.checks[0].level = "fatal") },
  { name: "compose props", schema: composePropsSchema, file: "packages/schema/examples/compose.example.json", bad: (d) => (d.scenes[0].from = 1.5) },
];

describe("schemas against example files", () => {
  for (const c of CASES) {
    const parse = (data: unknown) => (c.list ? (data as unknown[]).map((row) => c.schema.safeParse(row)) : [c.schema.safeParse(data)]);

    it(`${c.name}: example is valid`, () => {
      for (const r of parse(read(c.file))) assert.equal(r.success, true, r.success ? "" : JSON.stringify(r.error.issues));
    });

    it(`${c.name}: broken file is rejected`, () => {
      assert.ok(parse(broken(c.file, c.bad)).some((r) => !r.success));
    });
  }
});

describe("details", () => {
  it("publication link may be empty until the post is live, but not a non-URL", () => {
    const row = { date: "2026-11-13", platform: "tiktok", channel: "b", file: "x.mp4", link: "", status: "planned" };
    assert.equal(publicationSchema.safeParse(row).success, true);
    assert.equal(publicationSchema.safeParse({ ...row, link: "not a url" }).success, false);
  });

  it("compose props keep extra keys (Remotion needs a record)", () => {
    const data = { ...(read("packages/schema/examples/compose.example.json") as object), extra: 1 };
    const r = composePropsSchema.safeParse(data);
    assert.equal(r.success && (r.data as Record<string, unknown>).extra, 1);
  });
});
