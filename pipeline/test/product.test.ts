import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { checkProduct, checkProductData, listProductIds } from "../src/lib/products.js";

const TODAY = new Date("2026-11-08T12:00:00Z");

/** A valid card that is ready for production (every checklist condition met). */
function validCard(): Record<string, any> {
  return {
    id: "drawer-organizer",
    name: "Drawer organizer, 6 compartments",
    category: "home-organisation",
    price_pln: 49.99,
    price_checked_at: "2026-11-08",
    lowest_price_30d_pln: null,
    sources: { tiktok_shop_url: "https://www.tiktok.com/shop/pdp/123", allegro_url: "", seller_name: "Shop X" },
    facts: { dimensions_cm: "40 x 30 x 5", material: "PP", colors: ["white"], in_box: ["organizer"], key_features: [], capacity_l: 2 },
    allowed_claims: ["Fits a standard kitchen drawer (40 x 30 cm)."],
    forbidden_claims: ["Anything about effects that are not on the product card."],
    affiliate: { platform: "tiktok_shop", commission_pct: 12, ai_content_allowed: "yes", terms_checked_at: "2026-11-08" },
    product_shots: [{ file: "shot.mp4", source: "seller", permission: "written permission, date: 2026-11-08" }],
    notes: "",
  };
}

function shotsDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "shots-"));
  writeFileSync(path.join(dir, "shot.mp4"), "");
  return dir;
}

describe("checkProductData", () => {
  it("valid and ready card: no errors or warnings", () => {
    const r = checkProductData("drawer-organizer", validCard(), { today: TODAY, baseDir: shotsDir() });
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.warnings, []);
    assert.equal(r.card?.price_pln, 49.99);
  });

  it("the id must match the file name", () => {
    const r = checkProductData("other-name", validCard(), { today: TODAY, baseDir: shotsDir() });
    assert.match(r.errors.join("\n"), /does not match the file name/);
  });

  it("schema errors: missing fields, bad price, bad date, unknown field, bad enum", () => {
    const card = validCard();
    delete card.name;
    card.price_pln = -1;
    card.price_checked_at = "8.11.2026";
    card.typo_field = 1;
    card.affiliate.platform = "tiktok_shop | youtube_allegro | none";
    const r = checkProductData("drawer-organizer", card, { today: TODAY });
    const all = r.errors.join("\n");
    for (const field of ["name", "price_pln", "price_checked_at", "affiliate.platform", "(card)"]) {
      assert.ok(all.includes(field), `no error for ${field}:\n${all}`);
    }
    assert.equal(r.card, undefined);
  });

  it("needs at least one product link", () => {
    const card = validCard();
    card.sources.tiktok_shop_url = "";
    const r = checkProductData("drawer-organizer", card, { today: TODAY });
    assert.match(r.errors.join("\n"), /at least one link/);
  });

  it("readiness warnings: no shots, unknown AI rules, old price, empty claims", () => {
    const card = validCard();
    card.product_shots = [];
    card.allowed_claims = [];
    card.affiliate.ai_content_allowed = "unknown";
    card.affiliate.terms_checked_at = null;
    card.price_checked_at = "2026-10-01";
    const r = checkProductData("drawer-organizer", card, { today: TODAY });
    assert.deepEqual(r.errors, []);
    const all = r.warnings.join("\n");
    for (const s of ["real shot", "allowed_claims", "\"unknown\"", "not checked", "38 days"]) {
      assert.ok(all.includes(s), `no warning "${s}":\n${all}`);
    }
  });

  it("a shot without a file and without a permission date gives warnings", () => {
    const card = validCard();
    card.product_shots[0].permission = "written permission, date: ";
    const r = checkProductData("drawer-organizer", card, { today: TODAY, baseDir: tmpdir() + "/missing" });
    assert.equal(r.warnings.length, 2);
  });

  it("platform none: no affiliate program warnings", () => {
    const card = validCard();
    card.affiliate = { platform: "none", commission_pct: null, ai_content_allowed: "unknown", terms_checked_at: null };
    const r = checkProductData("drawer-organizer", card, { today: TODAY, baseDir: shotsDir() });
    assert.deepEqual(r.warnings, []);
  });
});

describe("checkProduct (files)", () => {
  it("invalid JSON and a missing file are errors; a BOM is accepted", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "products-"));
    writeFileSync(path.join(dir, "bad.json"), "{ not json");
    writeFileSync(path.join(dir, "drawer-organizer.json"), "﻿" + JSON.stringify(validCard()));
    assert.match(checkProduct("bad", { dir }).errors[0] ?? "", /invalid JSON/);
    assert.match(checkProduct("missing", { dir }).errors[0] ?? "", /file not found/);
    assert.deepEqual(checkProduct("drawer-organizer", { dir, today: TODAY }).errors, []);
    assert.deepEqual(listProductIds(dir), ["bad", "drawer-organizer"]);
  });
});
