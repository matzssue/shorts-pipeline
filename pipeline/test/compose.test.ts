import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildComposeProps, formatDate, MIN_PLAYBACK_RATE } from "../src/compose/props.js";
import type { Script } from "@shorts/schema";
import type { VoiceTimings } from "../src/steps/voice.js";

const base = { visual: "v", on_screen_text: "Headline", claims: [] };
const script: Script = {
  input: { kind: "topic", id: "t" },
  format: "F5",
  angle: "a",
  hooks: ["h"],
  scenes: [
    { ...base, kind: "video", duration_s: 4, prompt: "p", voiceover: "One two.", overlay: { type: "label", heading: "Packed on:", value: "{yesterday}" } },
    { ...base, kind: "text", duration_s: 3, prompt: "", voiceover: "Three.", overlay: { type: "quiz", options: ["Option A", "Option B"], countdown: 3 } },
  ],
  caption: "",
  hashtags: ["#x"],
  notes: "",
};

const voice: VoiceTimings = {
  narrator: "narrator-a",
  provider: "fake",
  voiceId: "v",
  model: "m",
  hash: "h",
  text: "One two. Three.",
  duration_s: 6,
  words: [
    { text: "One", start: 0, end: 0.5 },
    { text: "two.", start: 0.6, end: 5 },
    { text: "Three.", start: 5.4, end: 6 },
  ],
  scenes: [
    { index: 0, duration_s: 4, voice: { start: 0, end: 5 } },
    { index: 1, duration_s: 3, voice: { start: 5.4, end: 6 } },
  ],
};

describe("buildComposeProps", () => {
  const input = {
    script,
    voice,
    audioSrc: "voice/narrator-a.mp3",
    clipDurations: { "scenes/01.mp4": 4 },
    publishDate: new Date("2026-11-10T12:00:00Z"),
    series: 1,
    seriesTitle: "Quick tip",
  };

  it("a scene lasts at least as long as its narration; a card stays longer for the countdown", () => {
    const { props } = buildComposeProps(input);
    const [s1, s2] = props.scenes;
    // audio cut in the middle of the pause: (5 + 5.4) / 2 = 5.2 s, plus 0.6 s of silence at the start
    assert.equal(s1!.durationInFrames, 18 + 156);
    assert.deepEqual(s1!.audio, { startFrom: 0, endAt: 156, delay: 18 });
    assert.equal(s2!.from, 174);
    assert.equal(s2!.durationInFrames, 90); // planned 3 s > narration 0.8 s + tail
    assert.equal(s2!.audio.delay, 0);
    // 4 s clip for a 5.8 s scene – slowed below the threshold, with a warning
    assert.ok(Math.abs(s1!.playbackRate - 3.95 / 5.8) < 1e-9);
    assert.ok(s1!.playbackRate < MIN_PLAYBACK_RATE);
    assert.equal(props.durationInFrames, 264);
    assert.equal(props.sourceLabel, "Source");
  });

  it("words shifted onto the video timeline, {yesterday} = the day before publishing", () => {
    const { props } = buildComposeProps(input);
    assert.deepEqual(props.words[0], { text: "One", from: 18, to: 33 });
    assert.deepEqual(props.words.at(-1), { text: "Three.", from: 174 + 6, to: 174 + 24 });
    assert.deepEqual(props.scenes[0]!.overlay, { type: "label", heading: "Packed on:", value: "09.11.2026" });
    assert.equal(formatDate(new Date("2027-01-05T00:00:00Z")), "05.01.2027");
  });

  it("clip too short: warning; clip missing: error", () => {
    const { warnings } = buildComposeProps({ ...input, clipDurations: { "scenes/01.mp4": 2 } });
    assert.ok(warnings.some((w) => w.includes("generate a longer one")));
    assert.throws(() => buildComposeProps({ ...input, clipDurations: {} }), /missing clip scenes\/01.mp4/);
  });
});
