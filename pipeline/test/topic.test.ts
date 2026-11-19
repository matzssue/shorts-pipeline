import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseMakeArgs, UsageError } from "../src/cli.js";
import { checkTopicData } from "../src/lib/topics.js";
import { PIPELINE_DIR } from "../src/lib/paths.js";

const TODAY = new Date("2026-11-08T12:00:00Z");

function validTopic(): Record<string, any> {
  return {
    id: "cable-labels",
    title: "Label your chargers with bread tags",
    niche: "home-organisation",
    formats: ["F5"],
    problem: "All the chargers in the drawer look the same.",
    facts: [
      {
        id: "tag_fits_cable",
        text: "A bread bag clip fits around a standard charging cable.",
        source_url: "https://www.source.test/article",
        source_name: "Source",
        checked_at: "2026-11-01",
      },
    ],
    forbidden_claims: [],
    risk_category: "none",
    related_product_idea: "",
    notes: "",
  };
}

describe("checkTopicData", () => {
  it("valid card: no errors or warnings", () => {
    const r = checkTopicData("cable-labels", validTopic(), { today: TODAY });
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.warnings, []);
  });

  it("the example in examples/ is valid, with a warning about the placeholder source", () => {
    const tpl = JSON.parse(readFileSync(path.join(PIPELINE_DIR, "examples", "topic.example.json"), "utf8"));
    const r = checkTopicData(tpl.id, tpl, { today: TODAY });
    assert.deepEqual(r.errors, []);
    assert.match(r.warnings.join("\n"), /placeholder address/);
  });

  it("errors: no facts, wrong format, duplicate fact id, invalid URL", () => {
    const t = validTopic();
    t.formats = ["F1"];
    t.facts.push({ ...t.facts[0] });
    t.facts[1].source_url = "not-a-url";
    const r = checkTopicData("cable-labels", t, { today: TODAY });
    const all = r.errors.join("\n");
    assert.match(all, /formats\.0/);
    assert.match(all, /facts\.1\.source_url/);

    const t2 = validTopic();
    t2.facts = [];
    assert.match(checkTopicData("cable-labels", t2).errors.join("\n"), /at least 1 fact/);

    const t3 = validTopic();
    t3.facts.push({ ...t3.facts[0] });
    assert.match(checkTopicData("cable-labels", t3, { today: TODAY }).errors.join("\n"), /duplicate fact id/);
  });

  it("health, finance and legal topics are rejected", () => {
    for (const risk of ["health", "finance", "legal"]) {
      const t = validTopic();
      t.risk_category = risk;
      assert.match(checkTopicData("cable-labels", t, { today: TODAY }).errors.join("\n"), /risk_category/);
    }
  });

  it("an old fact gives a warning", () => {
    const t = validTopic();
    t.facts[0].checked_at = "2026-01-01";
    assert.match(checkTopicData("cable-labels", t, { today: TODAY }).warnings.join("\n"), /days ago/);
  });
});

describe("parseMakeArgs", () => {
  it("--topic with F5 and --product with F1", () => {
    assert.deepEqual(parseMakeArgs(["--topic", "abc", "--format", "f5"]), {
      input: { kind: "topic", id: "abc" },
      format: "F5",
      narrators: [],
    });
    assert.deepEqual(parseMakeArgs(["-p", "abc", "-f", "F1"]), { input: { kind: "product", id: "abc" }, format: "F1", narrators: [] });
    assert.equal(parseMakeArgs(["--help"]), "help");
  });

  it("--narrator: one narrator from the config, all, or an error", () => {
    const one = parseMakeArgs(["-t", "abc", "-f", "F5", "-n", "Narrator-A"]);
    assert.deepEqual(one !== "help" && one.narrators, ["narrator-a"]);
    const all = parseMakeArgs(["-t", "abc", "-f", "F5", "--narrator", "all"]);
    assert.deepEqual(all !== "help" && all.narrators, ["narrator-a", "narrator-b"]);
    assert.throws(() => parseMakeArgs(["-t", "abc", "-f", "F5", "-n", "nobody"]), /allowed: narrator-a, narrator-b, all/);
  });

  it("rejects: both inputs, no input, F5 with a product, F1 with a topic, invalid ID", () => {
    const cases: [string[], RegExp][] = [
      [["-t", "a", "-p", "b", "-f", "F3"], /not both/],
      [["-f", "F5"], /missing --topic or --product/],
      [["-p", "a", "-f", "F5"], /does not fit --product/],
      [["-t", "a", "-f", "F1"], /does not fit --topic/],
      [["-t", "Bad_ID", "-f", "F5"], /kebab-case/],
      [["-t", "a", "-f", "F9"], /allowed/],
    ];
    for (const [args, re] of cases) {
      assert.throws(() => parseMakeArgs(args), (e: unknown) => e instanceof UsageError && re.test(e.message), args.join(" "));
    }
  });
});
