import { FORMAT_DURATION_S, type Format } from "@shorts/schema/formats";
import { FPS, HEIGHT, MAX_VOICE_CHARS_PER_S, paletteFor, WIDTH } from "@shorts/schema/video";
import { chunkWords, type CaptionChunk } from "@shorts/timeline";
import type { ComposeOverlay, QaCheck } from "@shorts/schema";
import type { Film } from "../join";
import type { Catalog } from "../load";
import { starts, type Starts } from "./starts";

/*
 * Everything the page of one video shows, cut from the catalog on the server. The timeline part is
 * the video's own compose-*.json (scenes, words in frames) plus the caption lines the render draws.
 */

export const CPS_LIMIT = MAX_VOICE_CHARS_PER_S;

export interface TlScene {
  index: number;
  kind: "video" | "image" | "text";
  from: number;
  durationInFrames: number;
  playbackRate: number;
  headline: string;
  overlay?: ComposeOverlay;
  /** Narration inside the scene, in video frames: [from, to). Absent when the scene is silent. */
  narration?: { from: number; to: number };
}

export interface Timeline {
  fps: number;
  frames: number;
  width: number;
  height: number;
  palette: { base: string; accent: string; onAccent: string };
  sourceLabel: string;
  seriesTitle: string;
  scenes: TlScene[];
  words: { text: string; from: number; to: number }[];
  /** Caption lines exactly as the render builds them (`chunkWords`), for `captionAt`. */
  chunks: CaptionChunk[];
}

export interface EdlRow {
  index: number;
  kind: "video" | "image" | "text";
  /** Frames, when the video is rendered. */
  from?: number;
  to?: number;
  seconds: number;
  voiceover: string;
  /** Narration characters per second of the scene. */
  cps: number;
  onScreen: string;
  overlay?: string;
  claims: { text: string; source: string; fact?: { text: string; sourceName: string; checkedAt: string; url?: string } }[];
}

export type QaGroupKey = "video" | "narration" | "content" | "format" | "description" | "other";
export const QA_GROUPS: readonly QaGroupKey[] = ["video", "narration", "content", "format", "description", "other"];

/** Sorts a QA message into the group it comes from in the pipeline's `runQa` (the order of the code). */
export function qaGroup(text: string): QaGroupKey {
  if (/^(no final|length |frame |video older)/.test(text)) return "video";
  if (/^(no narration|narration |captions|\d+ exclamation)/.test(text)) return "narration";
  if (/^(forbidden|no forbidden|sounds like AI|no typical AI|claims without|\d+ claims)/.test(text)) return "content";
  if (/^(first frame|motion|video only|source shown|no source card|last scene)/.test(text)) return "format";
  if (/^(description|link in the description)/.test(text)) return "description";
  return "other";
}

export interface Release {
  platform: string;
  date: string;
  status: string;
  link: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  avgViewPercent?: number;
  avgViewSeconds?: number;
}

export interface FilmPage {
  id: string;
  number: number;
  title: string;
  folder: string;
  made: string;
  stage: Film["stage"];
  format: string;
  formatRange: readonly [number, number];
  series: number;
  seriesTitle: string;
  channel?: string;
  channelName?: string;
  narratorName?: string;
  model?: string;
  kind: "topic" | "product";
  cardId: string;
  angle: string;
  durationS?: number;
  timeline?: Timeline;
  edl: EdlRow[];
  qa?: { passed: boolean; groups: { key: QaGroupKey; checks: QaCheck[] }[]; manual: string[] };
  releases: Release[];
  starts: { youtube: Starts; instagram: Starts; filmId: string };
  voice: { chars: number; full: number; takes: number; cached: number; rows: { date: string; kind: string; scene?: number; chars: number; model: string }[] };
  caption: string;
  hashtags: string[];
  /** Seconds a YouTube viewer watches on average – a marker on the timeline. */
  avgViewSeconds?: number;
  prev?: { id: string; title: string };
  next?: { id: string; title: string };
}

/** The narration line of a script scene for one narrator (`voiceover_by` overrides `voiceover`). */
const sceneText = (sc: { voiceover: string; voiceover_by?: Record<string, string> }, narrator?: string) =>
  (narrator && sc.voiceover_by?.[narrator]) ?? sc.voiceover;

function overlayText(o?: ComposeOverlay | { type: string; [k: string]: unknown }): string | undefined {
  if (!o) return undefined;
  if (o.type === "label") return `${String(o.heading)} ${String(o.value)}`;
  if (o.type === "quiz") return (o.options as string[]).join(" / ");
  if (o.type === "source") return String(o.text);
  return undefined;
}

export function filmPage(c: Catalog, films: Film[], id: string): FilmPage | undefined {
  const i = films.findIndex((f) => f.id === id);
  const f = films[i];
  if (!f) return undefined;
  const raw = c.films.find((r) => r.folder === f.folder && (r.narrator ?? "") === (f.narrator ?? ""))!;
  const script = raw.script;
  const topic = c.topics.find((t) => t.id === f.cardId);
  const product = c.products.find((p) => p.id === f.cardId);
  const narrator = c.config.narrators.find((n) => n.id === f.narrator);
  const comp = f.compose;

  let timeline: Timeline | undefined;
  if (comp) {
    timeline = {
      fps: FPS,
      frames: comp.durationInFrames,
      width: WIDTH,
      height: HEIGHT,
      palette: paletteFor(comp.series),
      sourceLabel: comp.sourceLabel,
      seriesTitle: comp.seriesTitle,
      scenes: comp.scenes.map((s, index) => {
        const len = s.audio.endAt - s.audio.startFrom;
        const from = s.from + s.audio.delay;
        return {
          index,
          kind: s.kind,
          from: s.from,
          durationInFrames: s.durationInFrames,
          playbackRate: s.playbackRate,
          headline: s.headline,
          overlay: s.overlay,
          narration: len > 0 ? { from, to: Math.min(from + len, s.from + s.durationInFrames) } : undefined,
        };
      }),
      words: comp.words.map((w) => ({ text: w.text, from: w.from, to: w.to })),
      chunks: chunkWords(comp.words, FPS),
    };
  }

  const fact = (source: string): EdlRow["claims"][number]["fact"] => {
    if (topic) {
      const t = topic.facts.find((x) => x.id === source);
      return t && { text: t.text, sourceName: t.source_name, checkedAt: t.checked_at, url: t.source_url };
    }
    if (product) {
      const value = source.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), product);
      if (value === undefined) return undefined;
      return {
        text: Array.isArray(value) ? value.join(", ") : String(value),
        sourceName: product.sources.seller_name || "product card",
        checkedAt: product.price_checked_at,
      };
    }
    return undefined;
  };

  const edl: EdlRow[] = script.scenes.map((sc, index) => {
    const s = timeline?.scenes[index];
    const vo = sceneText(sc, f.narrator);
    const seconds = s ? s.durationInFrames / FPS : sc.duration_s;
    return {
      index,
      kind: sc.kind,
      from: s?.from,
      to: s ? s.from + s.durationInFrames : undefined,
      seconds,
      voiceover: vo,
      cps: seconds ? Math.round((vo.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim().length / seconds) * 10) / 10 : 0,
      onScreen: sc.on_screen_text,
      overlay: overlayText(sc.overlay),
      claims: sc.claims.map((cl) => ({ text: cl.text, source: cl.source, fact: fact(cl.source) })),
    };
  });

  const ledger = c.ledger.filter((r) => r.film === f.folder && (!f.narrator || r.narrator === f.narrator));
  const live = films.filter((x) => x.stage === "published");
  const latestFor = (p: string) => (p === "youtube" ? f.latest.youtube : p === "instagram" ? f.latest.instagram : undefined);

  return {
    id: f.id,
    number: f.number,
    title: f.title,
    folder: f.folder,
    made: f.made,
    stage: f.stage,
    format: f.format,
    formatRange: FORMAT_DURATION_S[f.format as Format] ?? [0, 0],
    series: f.series,
    seriesTitle: f.seriesTitle,
    channel: f.channel,
    channelName: c.config.channels.find((ch) => ch.id === f.channel)?.name,
    narratorName: f.narratorName,
    model: narrator?.model,
    kind: f.kind,
    cardId: f.cardId,
    angle: script.angle,
    durationS: f.durationS,
    timeline,
    edl,
    qa: f.qa && {
      passed: f.qa.passed,
      groups: QA_GROUPS.map((key) => ({ key, checks: f.qa!.checks.filter((x) => qaGroup(x.text) === key) })).filter((g) => g.checks.length),
      manual: f.qa.manual,
    },
    releases: f.publications
      .map((p) => {
        const row = p.link ? latestFor(p.platform) : undefined;
        return {
          platform: p.platform,
          date: p.date,
          status: p.status,
          link: p.link,
          views: row?.views,
          likes: row?.likes,
          comments: row?.comments,
          shares: row?.shares,
          avgViewPercent: row && "avgViewPercent" in row ? row.avgViewPercent : undefined,
          avgViewSeconds: row && "avgViewSeconds" in row ? row.avgViewSeconds : undefined,
        };
      })
      .sort((a, b) => a.platform.localeCompare(b.platform)),
    starts: { youtube: starts(live, "youtube"), instagram: starts(live, "instagram"), filmId: f.id },
    voice: {
      ...f.voice,
      rows: ledger.map((r) => ({ date: r.date, kind: r.kind, scene: r.scene, chars: r.chars, model: r.model })),
    },
    caption: script.caption,
    hashtags: script.hashtags,
    avgViewSeconds: f.latest.youtube?.avgViewSeconds,
    prev: films[i - 1] && { id: films[i - 1]!.id, title: films[i - 1]!.title },
    next: films[i + 1] && { id: films[i + 1]!.id, title: films[i + 1]!.title },
  };
}
