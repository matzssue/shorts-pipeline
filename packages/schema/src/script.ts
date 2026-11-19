import { z } from "zod";
import { FORMATS } from "./formats.ts";

/** A claim in the narration or on screen: must point to a source in the card. */
const claimSchema = z.strictObject({
  text: z.string().min(1),
  /** Topic card: `facts[].id`. Product card: a field path, e.g. `facts.capacity_l`. */
  source: z.string().min(1),
});

/**
 * Overlay drawn by the edit on top of a scene (not by the video generator).
 * `value` may contain `{yesterday}` – the day before the publish date (compose --publish).
 */
export const overlaySchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("label"),
    heading: z.string().min(1),
    value: z.string().min(1),
  }),
  z.strictObject({
    type: z.literal("quiz"),
    options: z.tuple([z.string().min(1), z.string().min(1)]),
    /** Countdown in seconds (guessing time). */
    countdown: z.number().int().min(1).max(5).optional(),
    /** Index of the correct answer – highlighted. */
    answer: z.number().int().min(0).max(1).optional(),
  }),
  z.strictObject({ type: z.literal("source"), text: z.string().min(1) }),
]);

const sceneSchema = z.strictObject({
  /** video – AI clip; image – AI image with a camera move; text – text card (drawn by the edit). */
  kind: z.enum(["video", "image", "text"]),
  duration_s: z.number().positive().max(15),
  /** What the viewer sees – for a person. */
  visual: z.string().min(1),
  /** Prompt for the generator; empty for `text`. */
  prompt: z.string(),
  voiceover: z.string(),
  /** Narrator-specific narration, key = narrator ID from the config; missing = `voiceover`. */
  voiceover_by: z.record(z.string(), z.string()).optional(),
  /**
   * Text for the TTS to pronounce (e.g. a phonetic spelling for an accent) when it differs from the captions.
   * Same word count as `voiceover_by` (without [..] tags) – word timings map 1:1 onto the captions.
   */
  spoken_by: z.record(z.string(), z.string()).optional(),
  on_screen_text: z.string(),
  overlay: overlaySchema.optional(),
  claims: z.array(claimSchema),
});

export const scriptSchema = z.strictObject({
  input: z.strictObject({
    kind: z.enum(["topic", "product"]),
    id: z.string().min(1),
  }),
  format: z.enum(FORMATS),
  /** Series number – picks the palette and the title from the config (`series`). */
  series: z.number().int().positive().optional(),
  /** The angle of the video – how it differs from earlier ones on the same topic. */
  angle: z.string().min(1),
  /** Hook variants; the first one is used in scene 1. */
  hooks: z.array(z.string().min(1)).min(1).max(3),
  scenes: z.array(sceneSchema).min(2),
  caption: z.string(),
  hashtags: z.array(z.string().regex(/^#\S+$/, "a hashtag starts with # and has no spaces")),
  notes: z.string(),
});

export type Script = z.infer<typeof scriptSchema>;
export type Scene = Script["scenes"][number];
export type Overlay = z.infer<typeof overlaySchema>;
