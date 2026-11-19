import { HEIGHT, WIDTH } from "../compose/types.js";
import { loadConfig } from "../lib/config.js";
import { FORMAT_DURATION_S, type Format } from "../lib/formats.js";
import type { Mp4Info } from "../lib/mp4.js";
import type { Narrator } from "../lib/narrators.js";
import { findAiPhrases, videoSeconds } from "../lib/scripts.js";
import type { Script } from "../schema/script.js";
import type { Topic } from "../schema/topic.js";
import { buildVoiceText, sceneVoiceover, voiceHash, type VoiceTimings } from "./voice.js";

/**
 * QA step: automatic checks of the finished video + a checklist for a person to tick off.
 * Publishing stays manual – QA does not replace listening to the video.
 */

export type QaLevel = "ok" | "warning" | "error";

export interface QaCheck {
  level: QaLevel;
  text: string;
}

/**
 * Words never used in the narration, captions or description: medical authority, guarantees, superlatives,
 * hard sell. The videos are in Polish, so the list is too.
 */
export const FORBIDDEN_WORDS: readonly string[] = [
  "lekarz",
  "doktor",
  "klinicznie",
  "klinicznie potwierdzon",
  "gwarantowan",
  "100% skuteczn",
  "najtańsz",
  "leczy",
  "wyleczy",
  "link w bio",
  "kod rabatowy",
];

export interface QaInput {
  script: Script;
  topic: Topic;
  format: Format;
  narrator: Narrator;
  voice?: VoiceTimings;
  video?: Mp4Info;
  /** Modification times (ms) – a video older than the script or the narration is stale. */
  mtimes: { script: number; voice?: number; video?: number };
  /** Sentence the description must contain to disclose AI use; default from the config. */
  disclosure?: string;
}

export interface QaResult {
  checks: QaCheck[];
  manual: string[];
  passed: boolean;
}

const ok = (text: string): QaCheck => ({ level: "ok", text });
const warn = (text: string): QaCheck => ({ level: "warning", text });
const fail = (text: string): QaCheck => ({ level: "error", text });

export function findForbidden(text: string): string[] {
  const t = text.toLowerCase();
  return FORBIDDEN_WORDS.filter((w) => t.includes(w));
}

export function runQa(input: QaInput): QaResult {
  const { script, topic, format, narrator, voice, video, mtimes } = input;
  const disclosure = input.disclosure ?? loadConfig().disclosure;
  const n = narrator.id;
  const checks: QaCheck[] = [];
  const display = script.scenes.map((sc) => sceneVoiceover(sc, n));
  const shown = script.scenes.map((sc) => sc.on_screen_text);
  const allText = [...display, ...shown, script.caption].join(" \n");

  // Video
  const [min, max] = FORMAT_DURATION_S[format];
  if (!video) {
    checks.push(fail(`no final-${n}.mp4 – pnpm compose … --narrator ${n}`));
  } else {
    const d = video.duration ?? 0;
    checks.push(d >= min && d <= max ? ok(`length ${d.toFixed(1)} s (format ${format}: ${min}–${max} s)`) : fail(`length ${d.toFixed(1)} s outside ${format}: ${min}–${max} s`));
    checks.push(
      video.width === WIDTH && video.height === HEIGHT
        ? ok(`frame ${WIDTH}×${HEIGHT}`)
        : fail(`frame ${video.width ?? "?"}×${video.height ?? "?"} instead of ${WIDTH}×${HEIGHT}`),
    );
    if (mtimes.video !== undefined && (mtimes.video < mtimes.script || (mtimes.voice !== undefined && mtimes.video < mtimes.voice))) {
      checks.push(fail("video older than script.json or the narration – render again (pnpm compose)"));
    }
  }

  // Narration and captions
  if (!voice) {
    checks.push(fail(`no narration for ${n} – pnpm make … --narrator ${n}`));
  } else {
    const hash = voiceHash(buildVoiceText(script, n).text, narrator);
    checks.push(voice.hash === hash ? ok("narration matches the script") : fail("narration recorded for a different text than script.json – record again or use voice-fix"));
    const expected = display.reduce((s, t) => s + (t.match(/\S+/g)?.length ?? 0), 0);
    checks.push(voice.words.length === expected ? ok(`captions: ${expected} narration words`) : fail(`captions: ${voice.words.length} words, but the narration has ${expected}`));
  }

  // Content
  const forbidden = findForbidden(allText);
  checks.push(forbidden.length ? fail(`forbidden words: "${forbidden.join('", "')}"`) : ok("no forbidden words"));
  const ai = findAiPhrases(allText);
  checks.push(ai.length ? warn(`sounds like AI: "${ai.join('", "')}"`) : ok("no typical AI phrases"));
  const factIds = new Set(topic.facts.map((f) => f.id));
  const claims = script.scenes.flatMap((sc) => sc.claims);
  const bad = claims.filter((c) => !factIds.has(c.source));
  checks.push(bad.length ? fail(`claims without a source in the card: ${bad.map((c) => c.source).join(", ")}`) : ok(`${claims.length} claims, each with a source in the topic card`));

  // Video format rules
  const first = script.scenes[0]?.on_screen_text.trim() ?? "";
  const firstWords = first.split(/\s+/).filter(Boolean).length;
  checks.push(
    first === "" ? warn("first frame without text – the topic must be readable without sound") : firstWords > 8 ? warn(`first frame text has ${firstWords} words (6–8 recommended)`) : ok(`first frame: "${first}"`),
  );
  const total = script.scenes.reduce((s, sc) => s + sc.duration_s, 0);
  const share = total ? videoSeconds(script.scenes) / total : 0;
  checks.push(share >= 0.5 ? ok(`motion: video for ${Math.round(share * 100)}% of the time`) : warn(`video only ${Math.round(share * 100)}% of the time – most of the video should be motion`));
  const hasSource = script.scenes.some((sc) => sc.overlay?.type === "source");
  checks.push(hasSource ? ok("source shown on screen") : warn('no source card (overlay "source")'));
  const last = display.filter(Boolean).at(-1) ?? "";
  // A short reaction line may follow the question, so the question can be anywhere in the last scene.
  checks.push(last.includes("?") ? ok("last scene asks the viewer a question") : warn("last scene without a question to the viewer"));
  const excl = display.join(" ").match(/!/g)?.length ?? 0;
  if (excl > 1) checks.push(warn(`${excl} exclamation marks in the narration captions (rule: max 1; a character voice – check by ear)`));

  // Description
  if (disclosure) {
    checks.push(script.caption.includes(disclosure) ? ok("description discloses the human and AI parts") : warn(`description without: "${disclosure}"`));
  }
  const sourceNames = [...new Set(topic.facts.map((f) => f.source_name))];
  checks.push(sourceNames.some((s) => script.caption.includes(s)) ? ok("description names a source") : warn("description does not name a source from the card"));
  if (/https?:\/\//i.test(script.caption)) checks.push(warn("link in the description – no links in videos without a product"));

  const manual = [
    "Listen: the narration is clear the first time, facts and on-screen text are pronounced clearly.",
    "Captions are in sync with the voice; readable, nothing under the platform buttons.",
    "Clips: no faces, no readable text or logos, no AI artefacts (floating objects, odd hands).",
    "Overlays: the {yesterday} date matches the publish day (compose --publish).",
    "No sped-up effects and no before/after without proof.",
    "No AI doctors or experts; no health, finance or legal advice.",
    "No face or voice of a real person without consent.",
    "Music (if any) has a commercial licence.",
    "AI label when publishing: TikTok – AI-generated content; YouTube Studio – altered or synthetic content = Yes.",
    "This is not a re-upload of the same video (also after small changes).",
    ...topic.forbidden_claims.map((c) => `Topic card – we do not say: ${c}`),
  ];

  return { checks, manual, passed: !checks.some((c) => c.level === "error") };
}

const ICON: Record<QaLevel, string> = { ok: "OK", warning: "WARN", error: "ERROR" };

export function renderQaMd(input: QaInput, res: QaResult, date: Date): string {
  const { script, topic, narrator } = input;
  const lines = [
    `# QA – ${topic.id} (${input.format}) · ${narrator.name}`,
    "",
    `**Date:** ${date.toISOString().slice(0, 10)} · **Automatic result:** ${res.passed ? "passes" : "DOES NOT pass"}`,
    "",
    "## Automatic checks",
    "",
    ...res.checks.map((c) => `- **${ICON[c.level]}** ${c.text}`),
    "",
    "## For a person to tick off before publishing",
    "",
    ...res.manual.map((m) => `- [ ] ${m}`),
    "",
    "## Publishing",
    "",
    "**Description:**",
    "",
    "```",
    `${script.caption}\n\n${script.hashtags.join(" ")}`,
    "```",
    "",
    "Sources from the topic card:",
    "",
    ...[...new Map(topic.facts.map((f) => [f.source_url, f.source_name])).entries()].map(([url, name]) => `- ${name} – ${url}`),
    "",
  ];
  return lines.join("\n");
}
