import assert from "node:assert/strict";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { checkScriptData, type ScriptContext } from "../src/lib/scripts.js";
import type { Narrator } from "../src/lib/narrators.js";
import type { TtsProvider } from "../src/providers/tts.js";
import type { Script } from "@shorts/schema";
import { buildVoiceText, runVoice, sceneOverruns, sceneTimings, voiceFiles, wordTimings } from "../src/steps/voice.js";

const card = { id: "t", facts: [{ id: "f" }] };
const ctx: ScriptContext = { input: { kind: "topic", id: "t" }, format: "F5", card };

function script(): Script {
  const base = { kind: "video" as const, visual: "v", prompt: "p", on_screen_text: "", claims: [] };
  return {
    input: { kind: "topic", id: "t" },
    format: "F5",
    angle: "a",
    hooks: ["h"],
    scenes: [
      { ...base, duration_s: 10, voiceover: "Ala owns it.", voiceover_by: { "narrator-a": "Ala has a cat." } },
      { ...base, duration_s: 5, voiceover: "" },
      { ...base, duration_s: 10, voiceover: "Cat has it." },
    ],
    caption: "",
    hashtags: ["#x"],
    notes: "",
  };
}

/** Fake TTS: every character takes 0.1 s. */
function fakeTts(): TtsProvider & { calls: number } {
  return {
    name: "fake",
    calls: 0,
    async synthesize(text) {
      this.calls++;
      return {
        audio: Buffer.from("mp3"),
        chars: [...text].map((char, i) => ({ char, start: i / 10, end: (i + 1) / 10 })),
        billedChars: text.length,
      };
    },
  };
}

const narrator: Narrator = { id: "narrator-a", name: "Narrator A", voiceId: "v1", model: "m" };

describe("voice step", () => {
  it("narrator text: voiceover_by or voiceover, skips scenes without narration", () => {
    const vt = buildVoiceText(script(), "narrator-a");
    assert.equal(vt.text, "Ala has a cat. Cat has it.");
    assert.deepEqual(vt.scenes, [
      { from: 0, to: 14 },
      { from: 14, to: 14 },
      { from: 15, to: 26 },
    ]);
    assert.equal(buildVoiceText(script(), "narrator-b").text, "Ala owns it. Cat has it.");
  });

  it("word and scene timings from character timings", () => {
    const s = script();
    const vt = buildVoiceText(s, "narrator-b");
    const chars = [...vt.text].map((char, i) => ({ char, start: i, end: i + 1 }));
    assert.deepEqual(wordTimings(vt.text, chars).slice(0, 2), [
      { text: "Ala", start: 0, end: 3 },
      { text: "owns", start: 4, end: 8 },
    ]);
    const t = sceneTimings(s, vt, chars);
    assert.deepEqual(t[0]!.voice, { start: 0, end: 12 });
    assert.equal(t[1]!.voice, null);
    assert.deepEqual(t[2]!.voice, { start: 13, end: 24 });
    assert.deepEqual(sceneOverruns(t), ["scene 1: narration 12.0 s > 10 s", "scene 3: narration 11.0 s > 10 s"]);
  });

  it("writes mp3 and json, the second time uses the cache", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "voice-"));
    const tts = fakeTts();
    const first = await runVoice(dir, script(), narrator, tts);
    assert.equal(first.cached, false);
    assert.ok(existsSync(voiceFiles(dir, "narrator-a").audio));
    assert.equal(first.timings.words.length, 7);
    const second = await runVoice(dir, script(), narrator, tts);
    assert.equal(second.cached, true);
    assert.equal(tts.calls, 1);
    await runVoice(dir, script(), { ...narrator, voiceId: "v2" }, tts);
    assert.equal(tts.calls, 2);
  });

  it("spoken_by: the TTS gets the pronunciation, the captions the real text; [..] tags are skipped", async () => {
    const s = script();
    s.scenes[0]!.spoken_by = { "narrator-a": "[speaking very slowly] Ala haz a kat." };
    assert.equal(buildVoiceText(s, "narrator-a").text, "[speaking very slowly] Ala haz a kat. Cat has it.");
    const dir = mkdtempSync(path.join(tmpdir(), "voice-"));
    const { timings } = await runVoice(dir, s, narrator, fakeTts());
    assert.deepEqual(
      timings.words.map((w) => w.text),
      ["Ala", "has", "a", "cat.", "Cat", "has", "it."],
    );
    assert.equal(timings.words[0]!.start, 2.3); // after the tag (23 characters × 0.1 s)
  });

  it("spoken_by with a different word count is a script error", () => {
    const s = script() as unknown as Record<string, any>;
    s.scenes[0].spoken_by = { "narrator-a": "Ala haz a black kat." };
    const r = checkScriptData(s, ctx);
    assert.ok(r.errors.some((e) => e.startsWith("scenes.0.spoken_by.narrator-a: 5 words, but the captions have 4")));
  });

  it("script: an unknown narrator is an error, fast narrator text a warning", () => {
    const s = script() as unknown as Record<string, any>;
    s.scenes[0].voiceover_by = { yoda: "Cat Ala has.", "narrator-b": "x".repeat(300) };
    s.scenes.forEach((sc: Record<string, unknown>) => ((sc as { claims: unknown[] }).claims = []));
    const r = checkScriptData(s, ctx);
    assert.ok(r.errors.some((e) => e.startsWith("scenes.0.voiceover_by.yoda: unknown narrator")));
    assert.ok(r.warnings.some((w) => w.startsWith("scenes.0.voiceover_by.narrator-b: 30 chars/s")));
  });
});
