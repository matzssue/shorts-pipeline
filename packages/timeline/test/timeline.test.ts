import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { captionAt, chunkWords, sceneAt, timecode } from "../src/index.js";

const w = (text: string, from: number, to: number) => ({ text, from, to });

describe("chunkWords", () => {
  it("splits after three words", () => {
    const words = [w("one", 0, 5), w("two", 6, 10), w("three", 11, 15), w("four", 16, 20)];
    assert.deepEqual(
      chunkWords(words, 30).map((c) => c.words.map((x) => x.text)),
      [["one", "two", "three"], ["four"]],
    );
  });

  it("splits after a full stop and after a longer pause", () => {
    const words = [w("Stop.", 0, 5), w("Wait", 6, 10), w("now", 30, 35)];
    assert.deepEqual(
      chunkWords(words, 30).map((c) => [c.from, c.to]),
      [[0, 5], [6, 10], [30, 35]],
    );
  });

  it("returns nothing for no words", () => {
    assert.deepEqual(chunkWords([], 30), []);
  });
});

describe("timecode", () => {
  it("formats m:ss:ff", () => {
    assert.equal(timecode(0, 30), "0:00:00");
    assert.equal(timecode(935, 30), "0:31:05");
    assert.equal(timecode(30 * 61 + 29, 30), "1:01:29");
  });

  it("rejects fractions and negatives", () => {
    assert.throws(() => timecode(1.5, 30));
    assert.throws(() => timecode(-1, 30));
    assert.throws(() => timecode(10, 0));
  });
});

describe("sceneAt", () => {
  const scenes = [
    { from: 0, durationInFrames: 90 },
    { from: 90, durationInFrames: 120 },
  ];

  it("finds the scene, including both edges", () => {
    assert.equal(sceneAt(scenes, 0), 0);
    assert.equal(sceneAt(scenes, 89), 0);
    assert.equal(sceneAt(scenes, 90), 1);
    assert.equal(sceneAt(scenes, 209), 1);
  });

  it("returns -1 outside the video", () => {
    assert.equal(sceneAt(scenes, 210), -1);
    assert.equal(sceneAt(scenes, -1), -1);
  });
});

describe("captionAt", () => {
  const words = [w("one", 0, 5), w("two", 6, 10), w("three", 11, 15), w("four", 40, 45)];
  const chunks = chunkWords(words, 30);

  it("shows the line being spoken and marks the current word", () => {
    const c = captionAt(chunks, 7, 30)!;
    assert.equal(c.index, 0);
    assert.deepEqual(c.active, [false, true, false]);
  });

  it("keeps a word lit for two frames after it ends", () => {
    assert.deepEqual(captionAt(chunks, 11, 30)!.active, [false, true, true]);
    assert.deepEqual(captionAt(chunks, 12, 30)!.active, [false, false, true]);
    assert.deepEqual(captionAt(chunks, 17, 30)!.active, [false, false, false]);
  });

  it("a line stays at most 0.6 s after its last word, even before the next one starts", () => {
    assert.equal(captionAt(chunks, 15 + 18, 30)!.index, 0);
    assert.equal(captionAt(chunks, 15 + 19, 30), undefined);
    assert.equal(captionAt(chunks, 40, 30)!.index, 1);
  });

  it("the last line goes half a second after its last word; nothing shows before the first", () => {
    assert.equal(captionAt(chunks, 45 + 14, 30)!.index, 1);
    assert.equal(captionAt(chunks, 45 + 15, 30), undefined);
    assert.equal(captionAt(chunkWords([w("late", 10, 20)], 30), 5, 30), undefined);
  });
});
