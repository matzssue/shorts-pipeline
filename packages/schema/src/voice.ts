import { z } from "zod";

/** `voice/<narrator>.json` – the narration recording with word and scene timings. */

const second = z.number().nonnegative();

export const wordTimingSchema = z.strictObject({
  text: z.string().min(1),
  start: second,
  end: second,
});

export const sceneTimingSchema = z.strictObject({
  index: z.number().int().nonnegative(),
  /** Planned scene length from the script. */
  duration_s: z.number().positive(),
  /** This scene's narration in the recording; null – scene without narration. */
  voice: z.strictObject({ start: second, end: second }).nullable(),
});

export const voiceTimingsSchema = z.strictObject({
  narrator: z.string().min(1),
  provider: z.string().min(1),
  voiceId: z.string(),
  model: z.string().min(1),
  /** Hash of the text and voice settings – the same hash = recording from cache. */
  hash: z.string().min(1),
  text: z.string(),
  /** Text spoken in each scene of this recording (for re-recording one scene). */
  parts: z.array(z.string()).optional(),
  /** Where each scene comes from: the full recording or a take path in `voice/takes/`. */
  sources: z.array(z.string()).optional(),
  duration_s: second,
  billed_chars: z.number().int().nonnegative().optional(),
  words: z.array(wordTimingSchema),
  scenes: z.array(sceneTimingSchema),
});

/** One row of `data/voice-ledger.csv`: characters used by one narration request. */

export const VOICE_LEDGER_COLUMNS = ["date", "film", "narrator", "model", "kind", "scene", "chars"] as const;
/** full – whole recording; take – one scene re-recorded by voice-fix; cache – same text, no request, no cost. */
export const VOICE_LEDGER_KINDS = ["full", "take", "cache"] as const;

export const voiceLedgerRowSchema = z.strictObject({
  date: z.iso.date(),
  /** Video folder: `<topic or product id>/<format>`. */
  film: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*\/F[1-9]$/, "<id>/<format>"),
  narrator: z.string().min(1),
  model: z.string().min(1),
  kind: z.enum(VOICE_LEDGER_KINDS),
  /** 1-based scene number for a take; none for a full recording. */
  scene: z.number().int().positive().optional(),
  chars: z.number().int().nonnegative(),
});

export type VoiceLedgerRow = z.infer<typeof voiceLedgerRowSchema>;
export type WordTiming = z.infer<typeof wordTimingSchema>;
export type SceneTiming = z.infer<typeof sceneTimingSchema>;
export type VoiceTimings = z.infer<typeof voiceTimingsSchema>;
