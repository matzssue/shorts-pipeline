import { z } from "zod";

/**
 * Product card – the only source of facts about a product. The script may not invent features or numbers.
 * Example: pipeline/examples/product.example.json. Files: products/<id>.json.
 */

export const PRODUCT_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const isoDate = z.iso.date({ error: "date as YYYY-MM-DD" });
const nonEmpty = z.string().trim().min(1, { error: "must not be empty" });
const optionalUrl = z.union([z.literal(""), z.url({ error: "invalid URL" })]);
const pricePln = z.number().positive({ error: "price must be > 0" });

export const AFFILIATE_PLATFORMS = ["tiktok_shop", "youtube_allegro", "none"] as const;
export const AI_CONTENT_ALLOWED = ["yes", "no", "unknown"] as const;

/** Extra category-specific facts: text, number or a list of texts. */
const factValue = z.union([z.string(), z.number(), z.array(z.string())]);

export const productSchema = z.strictObject({
  id: z.string().regex(PRODUCT_ID_RE, { error: "ID in kebab-case (lowercase letters, digits, hyphens)" }),
  name: nonEmpty,
  category: nonEmpty,
  price_pln: pricePln,
  price_checked_at: isoDate,
  /** EU Omnibus rule: lowest price in the 30 days before a discount; null when there is no discount. */
  lowest_price_30d_pln: pricePln.nullable(),
  sources: z
    .strictObject({
      tiktok_shop_url: optionalUrl,
      allegro_url: optionalUrl,
      seller_name: z.string(),
    })
    .refine((s) => s.tiktok_shop_url !== "" || s.allegro_url !== "", {
      error: "give at least one link: tiktok_shop_url or allegro_url",
    }),
  facts: z
    .object({
      dimensions_cm: z.string().optional(),
      material: z.string().optional(),
      colors: z.array(z.string()).optional(),
      in_box: z.array(z.string()).optional(),
      key_features: z.array(z.string()).optional(),
    })
    .catchall(factValue),
  allowed_claims: z.array(nonEmpty),
  forbidden_claims: z.array(nonEmpty),
  affiliate: z.strictObject({
    platform: z.enum(AFFILIATE_PLATFORMS, { error: `one of: ${AFFILIATE_PLATFORMS.join(", ")}` }),
    commission_pct: z.number().min(0).max(100).nullable(),
    ai_content_allowed: z.enum(AI_CONTENT_ALLOWED, { error: `one of: ${AI_CONTENT_ALLOWED.join(", ")}` }),
    terms_checked_at: isoDate.nullable(),
  }),
  product_shots: z.array(
    z.strictObject({
      /** Path relative to the content directory, e.g. assets/product-shots/<id>/01.mp4 */
      file: nonEmpty,
      source: nonEmpty,
      permission: z.string(),
    }),
  ),
  notes: z.string(),
});

export type Product = z.infer<typeof productSchema>;
