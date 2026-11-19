import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SEED } from "../../packages/mock/src/prng.ts";
import { MOCK_SEED } from "@/lib/messages.en";

/*
 * The [auto] points of the review checklist: rules about the look that a test can hold, so a later
 * change cannot quietly bring back gradients, rounded cards, a stock font or a stray colour.
 */

const SRC = path.resolve(import.meta.dirname, "../src");
const files = (dir: string, ext: RegExp): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p, ext) : ext.test(e.name) ? [p] : [];
  });
const rel = (p: string) => path.relative(SRC, p).replaceAll("\\", "/");
const css = files(SRC, /\.css$/);
const code = files(SRC, /\.(tsx?|css|svg)$/);

/** Innermost CSS rules as [selector, body] (the layer and media wrappers drop out). */
const rules = (text: string) =>
  [...text.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1]!.trim(), m[2]!] as const);

/**
 * Where colour, gradients, radii and soft shadows may live: the video frame and everything drawn as
 * part of it (preview, thumbnails, palette swatches), and the stripe pattern of text cards and retakes.
 */
const FRAME = /\.(frame|pv|pv-[\w-]+|th|g-[\w-]+)\b/;
const STRIPES = /\.(k-text|takes)\b/;

describe("look guard (checklist [auto])", () => {
  it("no colour outside the tokens, except the frame", () => {
    const bad: string[] = [];
    for (const f of css) {
      const isTokens = rel(f) === "app/globals.css";
      for (const [sel, body] of rules(fs.readFileSync(f, "utf8"))) {
        if (isTokens && /^(:root|\[data-theme|@theme|html|:root:not)/.test(sel)) continue;
        if (FRAME.test(sel)) continue;
        if (/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/i.test(body)) bad.push(`${rel(f)}: ${sel}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("gradients only in the frame and the stripe pattern", () => {
    const bad: string[] = [];
    for (const f of css)
      for (const [sel, body] of rules(fs.readFileSync(f, "utf8")))
        if (/(linear|radial|conic)-gradient/.test(body) && !FRAME.test(sel) && !STRIPES.test(sel)) bad.push(`${rel(f)}: ${sel}`);
    expect(bad).toEqual([]);
  });

  it("radius above 2px and blurred shadows only in the frame", () => {
    const bad: string[] = [];
    for (const f of css)
      for (const [sel, body] of rules(fs.readFileSync(f, "utf8"))) {
        if (FRAME.test(sel)) continue;
        for (const m of body.matchAll(/border-radius:\s*([^;]+)/g)) // 50% draws a round data mark (a dot), not a rounded box
          if (m[1]!.split(/\s+/).some((v) => v !== "50%" && parseFloat(v) > 2)) bad.push(`${rel(f)}: ${sel} radius`);
        for (const m of body.matchAll(/box-shadow:\s*([^;]+)/g))
          for (const part of m[1]!.split(/,(?![^(]*\))/)) {
            const lengths = part.replace(/\([^)]*\)/g, "").match(/-?[\d.]+(px|rem|em|cqw)?/g) ?? [];
            if (lengths.length >= 3 && parseFloat(lengths[2]!) > 0) bad.push(`${rel(f)}: ${sel} blurred shadow`);
          }
      }
    expect(bad).toEqual([]);
  });

  it("no stock fonts or UI kits, and the video typeface only in the frame", () => {
    for (const f of code) {
      const text = fs.readFileSync(f, "utf8");
      expect(text, rel(f)).not.toMatch(/\b(Inter|Geist|Roboto|lucide|shadcn)\b/);
      if (/Space_Grotesk/.test(text)) expect(rel(f), "imports Space Grotesk").toBe("components/films/Frame.tsx");
    }
  });

  it("no emoji and no `transition: all`", () => {
    for (const f of code) {
      const text = fs.readFileSync(f, "utf8");
      expect(text, rel(f)).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(text, rel(f)).not.toMatch(/transition:\s*all/);
    }
  });

  it("the colophon names the seed the generator uses", () => {
    expect(MOCK_SEED).toBe(SEED);
  });
});
