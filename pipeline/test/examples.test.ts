import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { configSchema } from "../src/lib/config.js";
import { PIPELINE_DIR } from "../src/lib/paths.js";
import { checkProductData } from "../src/lib/products.js";
import { checkScriptData } from "../src/lib/scripts.js";
import { checkTopicData } from "../src/lib/topics.js";
import { flowPlanSchema } from "../src/schema/flow.js";

const read = (name: string) => JSON.parse(readFileSync(path.join(PIPELINE_DIR, "examples", name), "utf8"));
const TODAY = new Date("2026-11-10T12:00:00Z");

describe("examples/", () => {
  it("config is valid", () => {
    assert.equal(configSchema.safeParse(read("shorts.config.example.json")).success, true);
  });

  it("topic, script and flow plan are valid; the script fits the topic", () => {
    const topic = read("topic.example.json");
    const t = checkTopicData(topic.id, topic, { today: TODAY });
    assert.deepEqual(t.errors, []);
    const script = read("script.example.json");
    const s = checkScriptData(script, { input: script.input, format: script.format, card: t.card });
    assert.deepEqual(s.errors, []);
    assert.deepEqual(s.warnings, []);
    assert.equal(flowPlanSchema.safeParse(read("flow.example.json")).success, true);
  });

  it("product card is valid (warnings only: it is a template)", () => {
    const product = read("product.example.json");
    assert.deepEqual(checkProductData(product.id, product, { today: TODAY }).errors, []);
  });
});
