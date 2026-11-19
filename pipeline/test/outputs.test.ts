import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { appendVoiceLedger, readVoiceLedger, today, writeQaJson } from "../src/lib/outputs.js";

const tmp = () => mkdtempSync(path.join(tmpdir(), "outputs-"));

describe("writeQaJson", () => {
  it("writes the QA result next to the Markdown report", () => {
    const dir = tmp();
    const res = { checks: [{ level: "warning" as const, text: "scene 2: narration 3.9 s > 3.5 s" }], manual: ["Watch it"], passed: true };
    const file = writeQaJson(dir, "narrator-a", res);
    assert.equal(path.basename(file), "qa-narrator-a.json");
    assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), res);
  });

  it("refuses an invalid result and writes nothing", () => {
    const dir = tmp();
    const bad = { checks: [{ level: "fatal", text: "x" }], manual: [], passed: false } as never;
    assert.throws(() => writeQaJson(dir, "narrator-a", bad));
    assert.equal(existsSync(path.join(dir, "qa-narrator-a.json")), false);
  });
});

describe("voice ledger", () => {
  const full = { date: "2026-11-12", film: "2026-11-12-example-cable-labels-F5", narrator: "narrator-a", model: "eleven_v3", kind: "full" as const, chars: 412 };
  const take = { ...full, kind: "take" as const, scene: 3, chars: 120 };
  const cache = { ...full, kind: "cache" as const, chars: 0 };

  it("writes the header once and appends rows", () => {
    const file = path.join(tmp(), "data", "voice-ledger.csv");
    appendVoiceLedger([full], file);
    appendVoiceLedger([take, cache], file);
    const lines = readFileSync(file, "utf8").trim().split("\n");
    assert.equal(lines[0], "date,film,narrator,model,kind,scene,chars");
    assert.equal(lines.length, 4);
    assert.equal(lines[1], "2026-11-12,2026-11-12-example-cable-labels-F5,narrator-a,eleven_v3,full,,412");
    assert.deepEqual(readVoiceLedger(file), [full, take, cache]);
  });

  it("refuses a row that does not match the schema", () => {
    const file = path.join(tmp(), "voice-ledger.csv");
    assert.throws(() => appendVoiceLedger([{ ...full, film: "Not A Film" }], file));
    assert.equal(existsSync(file), false);
  });

  it("missing ledger = no rows", () => {
    assert.deepEqual(readVoiceLedger(path.join(tmp(), "none.csv")), []);
  });

  it("today is YYYY-MM-DD in local time", () => {
    assert.equal(today(new Date(2026, 0, 5, 23, 30)), "2026-01-05");
  });
});
