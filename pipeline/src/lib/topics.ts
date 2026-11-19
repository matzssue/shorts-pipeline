import { topicSchema, type Topic } from "@shorts/schema";
import { cardFile, daysBetween, listCardIds, parseCard, readCardJson, type CardCheck } from "./cards.js";
import { TOPICS_DIR } from "./paths.js";

export type TopicCheck = CardCheck<Topic>;

const FACT_MAX_AGE_DAYS = 180;
const PLACEHOLDER_HOSTS = ["example.com", "example.org"];

export const listTopicIds = (dir = TOPICS_DIR): string[] => listCardIds(dir);

/** Validates topic card data (already parsed JSON). */
export function checkTopicData(id: string, data: unknown, opts: { today?: Date } = {}): Omit<TopicCheck, "file"> {
  const today = opts.today ?? new Date();
  const warnings: string[] = [];

  const { card: t, errors } = parseCard(topicSchema, data);
  if (!t) return { id, errors, warnings };
  if (t.id !== id) errors.push(`id: "${t.id}" does not match the file name "${id}.json"`);

  t.facts.forEach((f, i) => {
    if (PLACEHOLDER_HOSTS.includes(new URL(f.source_url).hostname)) {
      warnings.push(`facts.${i}.source_url: placeholder address – give a real source`);
    }
    const age = daysBetween(f.checked_at, today);
    if (age > FACT_MAX_AGE_DAYS) {
      warnings.push(`facts.${i}.checked_at: fact checked ${age} days ago – verify the source`);
    }
  });

  return { id, card: t, errors, warnings };
}

export function checkTopic(id: string, opts: { dir?: string; today?: Date } = {}): TopicCheck {
  const file = cardFile(opts.dir ?? TOPICS_DIR, id);
  const { data, error } = readCardJson(file);
  if (error) return { id, file, errors: [error], warnings: [] };
  return { file, ...checkTopicData(id, data, { today: opts.today }) };
}
