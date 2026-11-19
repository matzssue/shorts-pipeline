import { z } from "zod";

/** Result of the automated QA of one rendered video. */

export const QA_LEVELS = ["ok", "warning", "error"] as const;

export const qaCheckSchema = z.strictObject({
  level: z.enum(QA_LEVELS),
  text: z.string().min(1),
});

export const qaResultSchema = z.strictObject({
  checks: z.array(qaCheckSchema),
  /** Checks left to a person (watching the video, listening to the voice). */
  manual: z.array(z.string()),
  passed: z.boolean(),
});

export type QaLevel = (typeof QA_LEVELS)[number];
export type QaCheck = z.infer<typeof qaCheckSchema>;
export type QaResult = z.infer<typeof qaResultSchema>;
