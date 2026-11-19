import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { composePropsSchema } from "@shorts/schema";
import { buildFilms } from "@/data/join";
import { loadCatalog } from "@/data/load";
import { CPS_LIMIT, filmPage, qaGroup, type FilmPage } from "@/data/selectors/film";
import { frameAt, parseT } from "@/data/selectors/frame";

const dir = path.resolve(import.meta.dirname, "../../fixtures/content");
const catalog = loadCatalog(dir);
const films = buildFilms(catalog);
const pages = films.map((f) => filmPage(catalog, films, f.id)!);
const rendered = pages.filter((p): p is FilmPage & { timeline: NonNullable<FilmPage["timeline"]> } => !!p.timeline);

/** The compose-<narrator>.json the render reads, straight from disk – the preview must agree with it. */
function composeFile(p: FilmPage) {
  const raw = catalog.films.find((r) => r.folder === p.folder && films.find((f) => f.id === p.id)!.narrator === r.narrator)!;
  const file = path.join(dir, "out", p.folder, `compose-${raw.narrator}.json`);
  return composePropsSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
}

describe("film page data", () => {
  it("has a page for every video and none for an unknown id", () => {
    expect(pages).toHaveLength(films.length);
    expect(filmPage(catalog, films, "no-such-video")).toBeUndefined();
  });

  it("one edit list row per script scene, one timeline scene per compose scene", () => {
    for (const p of pages) {
      const raw = catalog.films.find((r) => r.folder === p.folder)!;
      expect(p.edl).toHaveLength(raw.script.scenes.length);
    }
    for (const p of rendered) {
      const c = composeFile(p);
      expect(p.timeline.scenes.map((s) => [s.from, s.durationInFrames, s.headline])).toEqual(c.scenes.map((s) => [s.from, s.durationInFrames, s.headline]));
      expect(p.timeline.chunks.flatMap((ch) => ch.words)).toEqual(c.words);
      expect(p.timeline.frames).toBe(c.durationInFrames);
    }
  });

  it("narration sits inside its scene", () => {
    for (const p of rendered)
      for (const s of p.timeline.scenes) {
        if (!s.narration) continue;
        expect(s.narration.from).toBeGreaterThanOrEqual(s.from);
        expect(s.narration.to).toBeLessThanOrEqual(s.from + s.durationInFrames);
      }
  });

  it("characters per second ignore performance tags", () => {
    for (const p of pages)
      for (const r of p.edl) {
        const chars = r.voiceover.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim().length;
        expect(Math.abs(r.cps - chars / r.seconds)).toBeLessThanOrEqual(0.051);
      }
    expect(CPS_LIMIT).toBe(16);
  });

  it("every claim finds its fact on the card", () => {
    const claims = pages.flatMap((p) => p.edl.flatMap((r) => r.claims));
    expect(claims.length).toBeGreaterThan(0);
    for (const c of claims) expect(c.fact, c.source).toBeDefined();
  });

  it("every QA message lands in one of the five groups of the pipeline", () => {
    const texts = films.flatMap((f) => f.qa?.checks.map((c) => c.text) ?? []);
    expect(texts.length).toBeGreaterThan(0);
    for (const x of texts) expect(qaGroup(x), x).not.toBe("other");
    expect(qaGroup("something new")).toBe("other");
  });

  it("narration rows add up to the slate number", () => {
    for (const p of pages) expect(p.voice.rows.reduce((s, r) => s + r.chars, 0)).toBe(p.voice.chars);
  });

  it("marks the slowed clip", () => {
    expect(rendered.some((p) => p.timeline.scenes.some((s) => s.playbackRate < 1))).toBe(true);
  });

  it("links to the neighbours in video order", () => {
    expect(pages[0]!.prev).toBeUndefined();
    expect(pages[1]!.prev?.id).toBe(pages[0]!.id);
    expect(pages.at(-1)!.next).toBeUndefined();
  });
});

describe("frame preview", () => {
  it("shows each scene's headline over the whole scene", () => {
    for (const p of rendered) {
      const c = composeFile(p);
      for (const s of c.scenes)
        for (const f of [s.from, s.from + s.durationInFrames - 1]) {
          const at = frameAt(p.timeline, f);
          expect(at.scene.headline).toBe(s.headline);
        }
    }
  });

  it("each word is on screen and on the accent box when it starts", () => {
    for (const p of rendered) {
      const c = composeFile(p);
      for (const w of c.words) {
        const at = frameAt(p.timeline, w.from);
        expect(at.caption, `${p.id} ${w.text}`).toBeDefined();
        const i = at.caption!.chunk.words.findIndex((x) => x.from === w.from && x.text === w.text);
        expect(i).toBeGreaterThanOrEqual(0);
        expect(at.caption!.active[i]).toBe(true);
      }
    }
  });

  it("cards appear when the render springs them in", () => {
    for (const p of rendered)
      for (const s of p.timeline.scenes) {
        if (s.overlay?.type !== "label") continue;
        expect(frameAt(p.timeline, s.from).overlay).toBeUndefined();
        expect(frameAt(p.timeline, s.from + 15).overlay).toEqual(s.overlay);
      }
  });

  it("reads the playhead from ?t=", () => {
    expect(parseT("?t=256", 825)).toBe(256);
    expect(parseT("?t=5000", 825)).toBe(824);
    expect(parseT("?t=-3", 825)).toBeUndefined();
    expect(parseT("?t=1.5", 825)).toBeUndefined();
    expect(parseT("", 825)).toBeUndefined();
  });
});
