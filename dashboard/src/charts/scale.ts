/**
 * Scales and ticks for the server-rendered charts. Positions are percentages (0–100), so a chart
 * drawn once at build time stretches to any width without JavaScript.
 */

export interface Linear {
  (v: number): number;
  readonly domain: readonly [number, number];
  readonly range: readonly [number, number];
  invert(p: number): number;
}

/** Maps `domain` onto `range` (default 0–100). A zero-width domain maps everything to the range start. */
export function linear(domain: readonly [number, number], range: readonly [number, number] = [0, 100]): Linear {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  const f = ((v: number) => (span === 0 ? r0 : r0 + ((v - d0) / span) * (r1 - r0))) as Linear;
  Object.defineProperties(f, {
    domain: { value: [d0, d1] },
    range: { value: [r0, r1] },
    invert: { value: (p: number) => (r1 === r0 ? d0 : d0 + ((p - r0) / (r1 - r0)) * span) },
  });
  return f;
}

/** A step of 1, 2 or 5 × 10ⁿ that splits `span` into about `count` parts. */
export function niceStep(span: number, count: number): number {
  if (!(span > 0) || !(count > 0)) return 1;
  const raw = span / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return m * pow;
}

const decimals = (step: number) => Math.max(0, -Math.floor(Math.log10(step)));
const round = (v: number, d: number) => Number(v.toFixed(d));

/**
 * Ticks on nice steps that cover [min, max], ends included: (0, 4 462, 3) → 0, 2 000, 4 000, 6 000.
 * An empty range still gets an axis: (0, 0) → 0, 1.
 */
export function ticks(min: number, max: number, count = 3): number[] {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const step = niceStep(hi - lo, count);
  const d = decimals(step);
  const start = Math.floor(round(lo / step, 6)) * step;
  let end = Math.ceil(round(hi / step, 6)) * step;
  if (end === start) end = start + step;
  const out: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) out.push(round(v, d));
  return out;
}

/** Percent string for inline styles, trimmed to three decimals. */
export const pct = (v: number): string => `${Number(v.toFixed(3))}%`;
