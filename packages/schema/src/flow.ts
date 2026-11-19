import { z } from "zod";

/**
 * Shot plan for a video generator used by hand (clips are generated manually, step by step).
 * File: flows/<name>.json. The order of `steps` is the recording order.
 *
 * References (`refs`, `start`):
 * - `asset:<character>/<file>` – a character photo from assets/character/<character>/photos/cutout/
 * - `frame:<step id>@<second|end>` – a frame from a downloaded clip (extracted after import)
 * - `image:<step id>` – an image downloaded in an image step
 * - `file:<path>` – a file in the video folder (out/<video>/)
 */

const nonEmpty = z.string().trim().min(1, { error: "must not be empty" });
export const FLOW_REF_RE = /^(asset:[a-z0-9_-]+\/[\w.-]+|frame:[\w-]+@(end|\d+(\.\d+)?)|image:[\w-]+|file:[\w./-]+)$/;
const ref = z.string().regex(FLOW_REF_RE, { error: "reference: asset:character/file, frame:id@sec|end, image:id or file:path" });

export const flowStepSchema = z.strictObject({
  /** File name in clips/ (video) or frames/ (image), e.g. "04", "02-03", "08a". */
  id: z.string().regex(/^[\w-]+$/, { error: "id: letters, digits, hyphens" }),
  kind: z.enum(["video", "image"]).default("video"),
  /** Generator mode: "ingredients" = reference images, "frames" = start frame for the clip. */
  mode: z.enum(["ingredients", "frames"]).default("ingredients"),
  seconds: z.number().positive().optional(),
  /** Short note on what the clip should show (for the checklist). */
  note: nonEmpty,
  prompt: nonEmpty,
  refs: z.array(ref).default([]),
  /** Start frame (mode "frames" only). */
  start: ref.optional(),
  /** false = do not append `suffix` (e.g. continuation prompts with their own ending). */
  suffix: z.boolean().default(true),
});

export const flowPlanSchema = z
  .strictObject({
    /** Video folder in out/, e.g. "2026-01-01-example-B". */
    film: z.string().regex(/^[\w-]+$/),
    /** Fixed text appended to every video prompt. */
    suffix: z.string().default(""),
    /** Substitutions in prompts, e.g. { "HERO": "a small grey robot with…" }. */
    characters: z.record(z.string().regex(/^[A-Z_]+$/), nonEmpty).default({}),
    /** Optional: an edit script run with the argument "draft" after the last clip (path relative to the content directory). */
    render: z.string().optional(),
    steps: z.array(flowStepSchema).min(1),
  })
  .superRefine((plan, ctx) => {
    const seen = new Set<string>();
    plan.steps.forEach((s, i) => {
      if (seen.has(s.id)) ctx.addIssue({ code: "custom", path: ["steps", i, "id"], message: `duplicate id ${s.id}` });
      if (s.mode === "frames" && !s.start) ctx.addIssue({ code: "custom", path: ["steps", i, "start"], message: "frames mode needs a start frame" });
      if (s.mode !== "frames" && s.start) ctx.addIssue({ code: "custom", path: ["steps", i, "start"], message: "a start frame is only for frames mode" });
      // A frame from a clip or an image must come from an earlier step.
      for (const r of [...s.refs, ...(s.start ? [s.start] : [])]) {
        const dep = /^(frame|image):([\w-]+)/.exec(r)?.[2];
        if (dep && !seen.has(dep)) ctx.addIssue({ code: "custom", path: ["steps", i], message: `${r}: step ${dep} must come earlier` });
      }
      seen.add(s.id);
    });
  });

export type FlowStep = z.infer<typeof flowStepSchema>;
export type FlowPlan = z.infer<typeof flowPlanSchema>;
