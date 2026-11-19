import { existsSync } from "node:fs";
import path from "node:path";
import { productSchema, type Product } from "../schema/product.js";
import { cardFile, daysBetween, listCardIds, parseCard, readCardJson, type CardCheck } from "./cards.js";
import { CONTENT_DIR, PRODUCTS_DIR } from "./paths.js";

export type ProductCheck = CardCheck<Product>;

const PRICE_MAX_AGE_DAYS = 14;
const DATE_RE = /\d{4}-\d{2}-\d{2}/;

export const listProductIds = (dir = PRODUCTS_DIR): string[] => listCardIds(dir);

/** Validates product card data (already parsed JSON). */
export function checkProductData(
  id: string,
  data: unknown,
  opts: { today?: Date; baseDir?: string } = {},
): Omit<ProductCheck, "file"> {
  const today = opts.today ?? new Date();
  const baseDir = opts.baseDir ?? CONTENT_DIR;
  const warnings: string[] = [];

  const { card: p, errors } = parseCard(productSchema, data);
  if (!p) return { id, errors, warnings };
  if (p.id !== id) errors.push(`id: "${p.id}" does not match the file name "${id}.json"`);

  // Ready for production: a product video needs at least one real shot of the product.
  if (p.product_shots.length === 0) {
    warnings.push("product_shots: no real shot of the product – the video will not pass the checklist");
  }
  p.product_shots.forEach((shot, i) => {
    if (!DATE_RE.test(shot.permission)) {
      warnings.push(`product_shots.${i}.permission: no permission with a YYYY-MM-DD date`);
    }
    if (!existsSync(path.resolve(baseDir, shot.file))) {
      warnings.push(`product_shots.${i}.file: file not found ${shot.file}`);
    }
  });

  if (p.allowed_claims.length === 0) {
    warnings.push("allowed_claims: empty – the script will have no claim about the product");
  }

  if (p.affiliate.platform !== "none") {
    if (p.affiliate.ai_content_allowed === "no") {
      warnings.push('affiliate.ai_content_allowed: "no" – the affiliate program forbids AI content, do not use');
    } else if (p.affiliate.ai_content_allowed === "unknown") {
      warnings.push('affiliate.ai_content_allowed: "unknown" – check the affiliate program terms');
    }
    if (p.affiliate.terms_checked_at === null) {
      warnings.push("affiliate.terms_checked_at: program terms not checked");
    }
  }

  const priceAgeDays = daysBetween(p.price_checked_at, today);
  if (priceAgeDays > PRICE_MAX_AGE_DAYS) {
    warnings.push(`price_checked_at: price checked ${priceAgeDays} days ago – verify before the video`);
  }

  return { id, card: p, errors, warnings };
}

export function checkProduct(id: string, opts: { dir?: string; today?: Date } = {}): ProductCheck {
  const file = cardFile(opts.dir ?? PRODUCTS_DIR, id);
  const { data, error } = readCardJson(file);
  if (error) return { id, file, errors: [error], warnings: [] };
  return { file, ...checkProductData(id, data, { today: opts.today }) };
}
