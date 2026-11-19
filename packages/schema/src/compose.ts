import { z } from "zod";

/** Input of the Remotion composition: scenes and caption words in frames. */

const frame = z.number().int().nonnegative();

export const composeOverlaySchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("label"), heading: z.string(), value: z.string() }),
  z.strictObject({
    type: z.literal("quiz"),
    options: z.tuple([z.string(), z.string()]),
    countdown: z.number().int().positive().optional(),
    answer: z.number().int().min(0).max(1).optional(),
  }),
  z.strictObject({ type: z.literal("source"), text: z.string() }),
]);

export const composeSceneSchema = z.strictObject({
  kind: z.enum(["video", "image", "text"]),
  /** Path relative to the video folder (staticFile); none for a text card. */
  src: z.string().optional(),
  from: frame,
  durationInFrames: z.number().int().positive(),
  /** Slow-down when the clip is shorter than the scene (1 = normal). */
  playbackRate: z.number().positive(),
  headline: z.string(),
  overlay: composeOverlaySchema.optional(),
  /** This scene's part of the narration: [startFrom, endAt) in audio frames, starting `delay` frames after the scene. */
  audio: z.strictObject({ startFrom: frame, endAt: frame, delay: frame }),
});

export const composeWordSchema = z.strictObject({
  text: z.string().min(1),
  from: frame,
  to: frame,
});

/** Loose object: Remotion requires composition props to be a string-keyed record. */
export const composePropsSchema = z.looseObject({
  /** Series number – picks the palette and the intro card title. */
  series: z.number().int().positive(),
  seriesTitle: z.string(),
  /** Label above the source overlay, e.g. "Source". */
  sourceLabel: z.string(),
  audioSrc: z.string(),
  scenes: z.array(composeSceneSchema),
  words: z.array(composeWordSchema),
  durationInFrames: z.number().int().positive(),
});

export type ComposeOverlay = z.infer<typeof composeOverlaySchema>;
export type ComposeScene = z.infer<typeof composeSceneSchema>;
export type ComposeWord = z.infer<typeof composeWordSchema>;
export type ComposeProps = z.infer<typeof composePropsSchema>;
