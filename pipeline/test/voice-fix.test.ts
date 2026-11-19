import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { silenceCut, speechEnd } from "../src/lib/audio.js";
import type { Script } from "@shorts/schema";
import { joinParts, sceneSegment, takeContext } from "../src/steps/voice-fix.js";

/** Loudness profile every 10 ms: `loud` in the given second ranges, silence elsewhere. */
function profile(seconds: number, loud: [number, number][]): number[] {
  return Array.from({ length: Math.round(seconds * 100) }, (_, k) =>
    loud.some(([a, b]) => k / 100 >= a && k / 100 < b) ? 3000 : 5,
  );
}

describe("cutting in silence", () => {
  it("cuts in the middle of the pause, not by the shifted character timings", () => {
    // speech 0–1 s and 1.4–2 s; the TTS reports end 1.05 and start 1.35 (shifted)
    const r = profile(2.5, [[0, 1], [1.4, 2]]);
    assert.ok(Math.abs(silenceCut(r, 1.05, 1.35) - 1.2) < 0.02);
  });

  it("end of speech: the first 150 ms of silence after the last word", () => {
    const r = profile(3, [[0, 2]]);
    assert.ok(Math.abs(speechEnd(r, 1.95) - 2.05) < 0.02);
  });

  it("scene segment: from the silence before to the silence after; the first scene from 0", () => {
    const r = profile(3, [[0.1, 1], [1.4, 2]]);
    const spans = [{ start: 0.1, end: 1 }, { start: 1.4, end: 2 }];
    const first = sceneSegment(r, spans, 0, true);
    assert.equal(first.from, 0);
    assert.ok(Math.abs(first.to - 1.2) < 0.02);
    const second = sceneSegment(r, spans, 1, false);
    assert.ok(Math.abs(second.from - 1.2) < 0.02);
    assert.ok(Math.abs(second.to - 2.05) < 0.02);
  });
});

describe("takes", () => {
  const base = { kind: "text" as const, duration_s: 3, visual: "v", prompt: "", on_screen_text: "", claims: [] };
  const script = {
    scenes: [
      { ...base, voiceover: "One." },
      { ...base, voiceover: "" },
      { ...base, voiceover: "Three." },
      { ...base, voiceover: "Four." },
    ],
  } as unknown as Script;

  it("context: the scene and its neighbours with narration", () => {
    assert.deepEqual(takeContext(script, "narrator-a", 0), [0]);
    assert.deepEqual(takeContext(script, "narrator-a", 2), [2, 3]);
    assert.deepEqual(takeContext(script, "narrator-a", 3), [2, 3]);
  });

  it("joins scene texts with a space and keeps the ranges", () => {
    assert.deepEqual(joinParts(["Ala is.", "Here."]), {
      text: "Ala is. Here.",
      ranges: [
        { from: 0, to: 7 },
        { from: 8, to: 13 },
      ],
    });
  });
});
