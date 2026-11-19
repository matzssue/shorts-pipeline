import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeContent } from "./generate.js";

/** `pnpm mock [dir]` – writes the mock content directory (default: fixtures/content at the repo root). */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const target = path.resolve(process.argv[2] ?? path.join(ROOT, "fixtures", "content"));

const files = writeContent(target);
console.log(`Mock content: ${files.length} files in ${path.relative(process.cwd(), target) || "."}`);
