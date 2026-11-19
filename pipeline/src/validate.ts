import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { cardFile, formatCheck, type CardCheck } from "./lib/cards.js";
import { PRODUCTS_DIR, TOPICS_DIR } from "./lib/paths.js";
import { checkProduct, listProductIds } from "./lib/products.js";
import { checkTopic, listTopicIds } from "./lib/topics.js";

const HELP = `Usage: pnpm validate [id...] [--topics | --products] [--strict]

Validates topic cards (topics/) and product cards (products/).
Without IDs it checks all cards; with IDs – the cards with that name in both folders.

Options:
  --topics      topic cards only
  --products    product cards only
  --strict      warnings also exit with code 1
  -h, --help    this help

Error = the card is invalid (the pipeline will not use it).
Warning = the card is valid, but a video made from it will not pass the checklist yet.`;

function main(argv: string[]): number {
  const args = argv[0] === "--" ? argv.slice(1) : argv;
  let values, positionals;
  try {
    ({ values, positionals } = parseArgs({
      args,
      strict: true,
      allowPositionals: true,
      options: {
        topics: { type: "boolean" },
        products: { type: "boolean" },
        strict: { type: "boolean" },
        help: { type: "boolean", short: "h" },
      },
    }));
  } catch (err) {
    console.error(`Invalid arguments: ${(err as Error).message}\n\n${HELP}`);
    return 1;
  }
  if (values.help) {
    console.log(HELP);
    return 0;
  }

  const both = !values.topics && !values.products;
  const doTopics = both || !!values.topics;
  const doProducts = both || !!values.products;
  const checks: CardCheck<unknown>[] = [];

  if (positionals.length === 0) {
    if (doTopics) checks.push(...listTopicIds().map((id) => checkTopic(id)));
    if (doProducts) checks.push(...listProductIds().map((id) => checkProduct(id)));
  } else {
    for (const id of positionals) {
      const inTopics = doTopics && existsSync(cardFile(TOPICS_DIR, id));
      const inProducts = doProducts && existsSync(cardFile(PRODUCTS_DIR, id));
      if (inTopics) checks.push(checkTopic(id));
      if (inProducts) checks.push(checkProduct(id));
      if (!inTopics && !inProducts) {
        checks.push({ id, file: cardFile(doTopics ? TOPICS_DIR : PRODUCTS_DIR, id), errors: ["no such card"], warnings: [] });
      }
    }
  }

  if (checks.length === 0) {
    console.log("No cards in topics/ or products/ – nothing to check.");
    return 0;
  }

  for (const c of checks) console.log(formatCheck(c));

  const withErrors = checks.filter((c) => c.errors.length > 0).length;
  const withWarnings = checks.filter((c) => c.errors.length === 0 && c.warnings.length > 0).length;
  const ok = checks.length - withErrors - withWarnings;
  console.log(`\nCards: ${checks.length} · OK: ${ok} · with warnings: ${withWarnings} · with errors: ${withErrors}`);

  if (withErrors > 0) return 1;
  if (values.strict && withWarnings > 0) return 1;
  return 0;
}

process.exitCode = main(process.argv.slice(2));
