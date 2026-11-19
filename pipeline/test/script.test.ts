import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { checkScriptData, renderPrompts, videoDir, type ScriptContext } from "../src/lib/scripts.js";

const card = { id: "cable-labels", facts: [{ id: "tag_fits_cable" }] };
const ctx: ScriptContext = { input: { kind: "topic", id: "cable-labels" }, format: "F5", card };

function scene(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: "video",
    duration_s: 10,
    visual: "A drawer full of chargers.",
    prompt: "A drawer with tangled chargers, vertical 9:16.",
    voiceover: "Put a tag on each cable.",
    on_screen_text: "Tag it",
    claims: [{ text: "A bread tag fits a cable.", source: "tag_fits_cable" }],
    ...over,
  };
}

function validScript(): Record<string, any> {
  return {
    input: { kind: "topic", id: "cable-labels" },
    format: "F5",
    angle: "First video.",
    hooks: ["Which charger is which?"],
    scenes: [scene(), scene(), scene({ kind: "text", prompt: "", claims: [] })],
    caption: "Caption",
    hashtags: ["#tips"],
    notes: "",
  };
}

describe("checkScriptData", () => {
  it("valid script: no errors or warnings", () => {
    const r = checkScriptData(validScript(), ctx);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.warnings, []);
  });

  it("a claim without a source in the card is an error", () => {
    const s = validScript();
    s.scenes[0].claims[0].source = "no_such_fact";
    const r = checkScriptData(s, ctx);
    assert.ok(r.errors.some((e) => e.includes("scenes.0.claims.0.source")));
  });

  it("length outside the format range is an error", () => {
    const s = validScript();
    s.scenes = [scene({ duration_s: 5 }), scene({ duration_s: 5 })];
    const r = checkScriptData(s, ctx);
    assert.ok(r.errors.some((e) => e.includes("20–45 s")));
  });

  it("a video scene without a prompt is an error; another topic and format are errors", () => {
    const s = validScript();
    s.scenes[0].prompt = " ";
    s.input.id = "other-topic";
    s.format = "F3";
    const r = checkScriptData(s, ctx);
    assert.ok(r.errors.some((e) => e.startsWith("scenes.0.prompt")));
    assert.ok(r.errors.some((e) => e.startsWith("input:")));
    assert.ok(r.errors.some((e) => e.startsWith("format:")));
  });

  it("warns: too little motion, narration too fast, clip too long", () => {
    const s = validScript();
    s.scenes = [
      scene({ duration_s: 12, voiceover: "x".repeat(300) }),
      scene({ kind: "image", duration_s: 14 }),
      scene({ kind: "text", duration_s: 10, prompt: "", claims: [] }),
    ];
    const r = checkScriptData(s, ctx);
    assert.deepEqual(r.errors, []);
    assert.ok(r.warnings.some((w) => w.includes("most of the video")));
    assert.ok(r.warnings.some((w) => w.includes("chars/s")));
    assert.ok(r.warnings.some((w) => w.includes("costs more")));
  });

  it("warns about typical AI phrases (Polish list) and too many exclamation marks", () => {
    const s = validScript();
    s.scenes[0].voiceover = "W dzisiejszych czasach warto wiedzieć to!";
    s.scenes[1].voiceover = "Odkryj sekret!";
    const r = checkScriptData(s, ctx);
    assert.ok(r.warnings.some((w) => w.startsWith("scenes.0: sounds like AI") && w.includes("warto wiedzieć")));
    assert.ok(r.warnings.some((w) => w.startsWith("scenes.1: sounds like AI")));
    assert.ok(r.warnings.some((w) => w.includes("2 exclamation marks")));
  });

  it("product card: the source is a field path", () => {
    const pctx: ScriptContext = {
      input: { kind: "product", id: "cable-labels" },
      format: "F1",
      card: { facts: { capacity_l: 2 } },
    };
    const s = validScript();
    s.input.kind = "product";
    s.format = "F1";
    s.scenes[0].claims[0].source = "facts.capacity_l";
    s.scenes[1].claims[0].source = "facts.weight_g";
    const r = checkScriptData(s, pctx);
    assert.deepEqual(r.errors, ['scenes.1.claims.0.source: "facts.weight_g" does not exist in the card']);
  });
});

describe("videoDir and renderPrompts", () => {
  it("takes the newest existing folder or proposes today's", () => {
    const out = mkdtempSync(path.join(tmpdir(), "out-"));
    const today = new Date("2026-11-08T12:00:00Z");
    assert.deepEqual(videoDir("abc", "F5", { outDir: out, today }), {
      dir: path.join(out, "2026-11-08-abc-F5"),
      exists: false,
    });
    mkdirSync(path.join(out, "2026-11-01-abc-F5"));
    mkdirSync(path.join(out, "2026-11-05-abc-F5"));
    mkdirSync(path.join(out, "2026-11-06-xabc-F5"));
    assert.equal(videoDir("abc", "F5", { outDir: out, today }).dir, path.join(out, "2026-11-05-abc-F5"));
  });

  it("prompts: only video/image scenes, with the file name and credits", () => {
    const r = checkScriptData(validScript(), ctx);
    const md = renderPrompts(r.card!);
    assert.ok(md.includes("scenes/01.mp4"));
    assert.ok(md.includes("scenes/02.mp4"));
    assert.ok(!md.includes("scenes/03"));
    assert.ok(md.includes("about 60 generator credits"));
  });
});
