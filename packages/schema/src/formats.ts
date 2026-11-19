/**
 * Video formats:
 * F1 problem → solution, F2 "3 things for X", F3 character series, F4 seasonal guide, F5 niche tip (no product).
 */
export const FORMATS = ["F1", "F2", "F3", "F4", "F5"] as const;
export type Format = (typeof FORMATS)[number];

/** Formats allowed for each input. */
export const PRODUCT_FORMATS = ["F1", "F2", "F3", "F4"] as const satisfies readonly Format[];
export const TOPIC_FORMATS = ["F3", "F5"] as const satisfies readonly Format[];

/** Video length in seconds [min, max]. */
export const FORMAT_DURATION_S: Record<Format, readonly [number, number]> = {
  F1: [20, 35],
  F2: [30, 45],
  F3: [40, 60],
  F4: [30, 45],
  F5: [20, 45],
};
