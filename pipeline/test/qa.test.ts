import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Narrator } from "../src/lib/narrators.js";
import type { Script } from "../src/schema/script.js";
import type { Topic } from "../src/schema/topic.js";
import { findForbidden, renderQaMd, runQa, type QaInput } from "../src/steps/qa.js";
import { buildVoiceText, voiceHash, type VoiceTimings } from "../src/steps/voice.js";

const DISCLOSURE = "Checked by a person, made with AI.";
const narrator: Narrator = { id: "narrator-a", name: "Narrator A", voiceId: "v", model: "m" };
const base = { visual: "v", claims: [] };
const script: Script = {
  input: { kind: "topic", id: "t" },
  format: "F5",
  angle: "a",
  hooks: ["h"],
  scenes: [
    { ...base, kind: "video", duration_s: 15, prompt: "p", voiceover: "Tags on every cable.", on_screen_text: "Which charger is it?" },
    {
      ...base,
      kind: "video",
      duration_s: 10,
      prompt: "p",
      voiceover: "How do you sort yours?",
      on_screen_text: "",
      overlay: { type: "source", text: "Example Institute" },
      claims: [{ text: "x", source: "f1" }],
    },
  ],
  caption: `Caption. ${DISCLOSURE} Source: Example Institute.`,
  hashtags: ["#hometips"],
  notes: "",
};
const topic = {
  id: "t",
  facts: [{ id: "f1", text: "x", source_url: "https://example.org", source_name: "Example Institute", checked_at: "2026-11-08" }],
  forbidden_claims: ["That it always works."],
} as unknown as Topic;

function voice(): VoiceTimings {
  const text = buildVoiceText(script, "narrator-a").text;
  return {
    narrator: "narrator-a",
    provider: "fake",
    voiceId: "v",
    model: "m",
    hash: voiceHash(text, narrator),
    text,
    duration_s: 5,
    words: ["Tags", "on", "every", "cable.", "How", "do", "you", "sort", "yours?"].map((w, i) => ({ text: w, start: i, end: i + 0.5 })),
    scenes: [],
  };
}

function input(over: Partial<QaInput> = {}): QaInput {
  return {
    script,
    topic,
    format: "F5",
    narrator,
    voice: voice(),
    video: { duration: 30, width: 1080, height: 1920 },
    mtimes: { script: 1, voice: 2, video: 3 },
    disclosure: DISCLOSURE,
    ...over,
  };
}

describe("qa step", () => {
  it("a correct video passes with no warnings; the manual list includes the card's forbidden claims", () => {
    const r = runQa(input());
    assert.equal(r.passed, true);
    assert.deepEqual(r.checks.filter((c) => c.level !== "ok"), []);
    assert.ok(r.manual.includes("Topic card – we do not say: That it always works."));
  });

  it("errors: too long, wrong resolution, video older than the narration, narration for another text", () => {
    const v = voice();
    v.hash = "other";
    const r = runQa(input({ voice: v, video: { duration: 46.2, width: 720, height: 1280 }, mtimes: { script: 1, voice: 5, video: 3 } }));
    assert.equal(r.passed, false);
    const errors = r.checks.filter((c) => c.level === "error").map((c) => c.text);
    assert.ok(errors.some((e) => e.includes("46.2 s outside")));
    assert.ok(errors.some((e) => e.includes("720×1280")));
    assert.ok(errors.some((e) => e.includes("video older")));
    assert.ok(errors.some((e) => e.includes("different text")));
  });

  it("missing video and narration are errors; forbidden words are case-insensitive", () => {
    const r = runQa(input({ voice: undefined, video: undefined }));
    assert.equal(r.passed, false);
    assert.deepEqual(findForbidden("Lekarz poleca, efekt GWARANTOWANY"), ["lekarz", "gwarantowan"]);
  });

  it("a description without the disclosure or a source gives warnings", () => {
    const r = runQa(input({ script: { ...script, caption: "Just a caption." } }));
    const warnings = r.checks.filter((c) => c.level === "warning").map((c) => c.text);
    assert.ok(warnings.some((w) => w.includes(DISCLOSURE)));
    assert.ok(warnings.some((w) => w.includes("does not name a source")));
  });

  it("md report: result, checks, description to paste and sources", () => {
    const md = renderQaMd(input(), runQa(input()), new Date("2026-11-09T10:00:00Z"));
    assert.ok(md.includes("**Automatic result:** passes"));
    assert.ok(md.includes("- [ ] AI label when publishing"));
    assert.ok(md.includes("#hometips"));
    assert.ok(md.includes("Example Institute – https://example.org"));
  });
});
