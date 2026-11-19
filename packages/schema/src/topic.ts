import { z } from "zod";
import { TOPIC_FORMATS } from "./formats.js";
import { PRODUCT_ID_RE } from "./product.js";

/**
 * Topic card – the source of facts for videos without a product (F5, F3).
 * Example: pipeline/examples/topic.example.json. Files: topics/<id>.json.
 * Every claim in a script must point to a `facts[].id`.
 */

/** Categories we do not give advice in. */
export const RISK_CATEGORIES = ["none", "health", "finance", "legal"] as const;

const nonEmpty = z.string().trim().min(1, { error: "must not be empty" });
const isoDate = z.iso.date({ error: "date as YYYY-MM-DD" });

export const topicFactSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9_]+$/, { error: "fact id: lowercase letters, digits, underscores" }),
  text: nonEmpty,
  source_url: z.url({ error: "invalid source URL" }),
  source_name: nonEmpty,
  checked_at: isoDate,
});

export const topicSchema = z
  .strictObject({
    id: z.string().regex(PRODUCT_ID_RE, { error: "ID in kebab-case (lowercase letters, digits, hyphens)" }),
    title: nonEmpty,
    niche: nonEmpty,
    formats: z
      .array(z.enum(TOPIC_FORMATS, { error: `one of: ${TOPIC_FORMATS.join(", ")}` }))
      .min(1, { error: "give at least one format" }),
    problem: nonEmpty,
    facts: z.array(topicFactSchema).min(1, { error: "at least 1 fact with a source" }),
    forbidden_claims: z.array(nonEmpty),
    risk_category: z.enum(RISK_CATEGORIES, { error: `one of: ${RISK_CATEGORIES.join(", ")}` }),
    /** A product that fits the topic, for later – a note only. */
    related_product_idea: z.string(),
    notes: z.string(),
  })
  .superRefine((t, ctx) => {
    const seen = new Set<string>();
    t.facts.forEach((f, i) => {
      if (seen.has(f.id)) ctx.addIssue({ code: "custom", path: ["facts", i, "id"], message: `duplicate fact id "${f.id}"` });
      seen.add(f.id);
    });
    if (t.risk_category !== "none") {
      ctx.addIssue({
        code: "custom",
        path: ["risk_category"],
        message: `"${t.risk_category}" – no health, finance or legal advice`,
      });
    }
  });

export type Topic = z.infer<typeof topicSchema>;
