import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { ASSETS_DIR } from "../src/lib/paths.js";
import { flowPlanSchema } from "../src/schema/flow.js";
import { buildPrompt, framesNeeded, pickDownload, refSource, snapshot, stepFolder, VIDEO_EXTS } from "../src/steps/flow.js";

const plan = flowPlanSchema.parse({
  film: "test-film",
  suffix: "Vertical 9:16.",
  characters: { HERO: "the small robot from the reference" },
  steps: [
    { id: "01", note: "a", prompt: "HERO rolls in. Then HERO, waves.", refs: ["asset:hero/front.jpg"] },
    { id: "02", mode: "frames", note: "b", prompt: "Continue.", start: "frame:01@end", suffix: false },
    { id: "03a", kind: "image", note: "c", prompt: "Photo of HERO.", refs: ["frame:01@2.5"] },
    { id: "03", mode: "frames", note: "d", prompt: "It blinks.", start: "image:03a" },
  ],
});

describe("flow plan", () => {
  it("needs a start frame in frames mode and dependencies in order", () => {
    const bad = flowPlanSchema.safeParse({
      film: "f",
      steps: [
        { id: "01", mode: "frames", note: "a", prompt: "p" },
        { id: "02", note: "b", prompt: "p", refs: ["frame:03@end"] },
        { id: "03", note: "c", prompt: "p" },
      ],
    });
    assert.equal(bad.success, false);
    const messages = bad.error!.issues.map((i) => i.message).join("\n");
    assert.match(messages, /needs a start frame/);
    assert.match(messages, /step 03 must come earlier/);
  });

  it("rejects a bad reference and a duplicate id", () => {
    const bad = flowPlanSchema.safeParse({
      film: "f",
      steps: [
        { id: "01", note: "a", prompt: "p", refs: ["hero.jpg"] },
        { id: "01", note: "b", prompt: "p" },
      ],
    });
    assert.equal(bad.success, false);
    assert.match(bad.error!.issues.map((i) => i.message).join("\n"), /reference:[\s\S]*duplicate id 01/);
  });
});

describe("buildPrompt", () => {
  it("substitutes characters, fixes capital letters and appends the suffix only to video steps with suffix", () => {
    assert.equal(buildPrompt(plan, plan.steps[0]!), "The small robot from the reference rolls in. Then the small robot from the reference, waves. Vertical 9:16.");
    assert.equal(buildPrompt(plan, plan.steps[1]!), "Continue.");
    assert.equal(buildPrompt(plan, plan.steps[2]!), "Photo of the small robot from the reference.");
  });
});

describe("references and frames", () => {
  it("points to the source files", () => {
    assert.equal(refSource("asset:hero/front.jpg", "/film"), path.join(ASSETS_DIR, "character", "hero", "photos", "cutout", "front.jpg"));
    assert.equal(refSource("frame:01@end", "/film"), path.join("/film", "frames", "01-end.jpg"));
    assert.equal(refSource("frame:01@2.5", "/film"), path.join("/film", "frames", "01-2.5.jpg"));
    assert.equal(refSource("file:frames/x.jpg", "/film"), path.join("/film", "frames", "x.jpg"));
  });

  it("collects the frames needed from a clip", () => {
    assert.deepEqual(framesNeeded(plan, "01").sort(), ["2.5", "end"]);
    assert.deepEqual(framesNeeded(plan, "02"), []);
  });

  it("numbers the step folders", () => {
    assert.equal(stepFolder(plan, plan.steps[2]!), "03-03a");
  });
});

describe("pickDownload", () => {
  const before = snapshot([
    { file: "/d/old.mp4", mtimeMs: 100, size: 10 },
    { file: "/d/overwritten.mp4", mtimeMs: 100, size: 10 },
  ]);
  const now = [
    { file: "/d/old.mp4", mtimeMs: 100, size: 10 },
    { file: "/d/overwritten.mp4", mtimeMs: 100, size: 99 },
    { file: "/d/new.mp4", mtimeMs: 50, size: 10 },
    { file: "/d/newer.mp4.crdownload", mtimeMs: 400, size: 10 },
    { file: "/d/image.png", mtimeMs: 500, size: 10 },
    { file: "/d/empty.mp4", mtimeMs: 600, size: 0 },
  ];
  it("takes a new or changed video file, even with an old date", () => {
    assert.equal(pickDownload(now, before, VIDEO_EXTS)?.file, "/d/overwritten.mp4");
    assert.equal(pickDownload(now.filter((f) => f.file !== "/d/overwritten.mp4"), before, VIDEO_EXTS)?.file, "/d/new.mp4");
  });
  it("skips old, partial, empty and ignored files", () => {
    const ignore = new Set([path.resolve("/d/overwritten.mp4"), path.resolve("/d/new.mp4")]);
    assert.equal(pickDownload(now, before, VIDEO_EXTS, ignore), undefined);
  });
});
