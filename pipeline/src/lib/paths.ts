import { fileURLToPath } from "node:url";
import path from "node:path";

/** The pipeline package directory (src/lib/ -> ../..). */
export const PIPELINE_DIR = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

/**
 * Where your content lives: config, cards, assets, `.env`, outputs and data.
 * Defaults to the package directory; set `CONTENT_DIR` to keep content in a separate (private) repo.
 */
export const CONTENT_DIR = path.resolve(process.env.CONTENT_DIR ?? PIPELINE_DIR);

export const PRODUCTS_DIR = path.join(CONTENT_DIR, "products");
export const TOPICS_DIR = path.join(CONTENT_DIR, "topics");
export const ASSETS_DIR = path.join(CONTENT_DIR, "assets");
/** Shot plans for `pnpm flow`. */
export const FLOWS_DIR = path.join(CONTENT_DIR, "flows");

/** Rendered videos and intermediate files (not tracked by git). */
export const OUT_DIR = path.join(CONTENT_DIR, "out");

/** publications.csv and stats snapshots (not tracked by git). */
export const DATA_DIR = path.join(CONTENT_DIR, "data");

export const ENV_FILE = path.join(CONTENT_DIR, ".env");

/** Path for log messages: relative to the content directory. */
export const rel = (file: string): string => path.relative(CONTENT_DIR, file);
