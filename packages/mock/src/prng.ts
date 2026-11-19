/**
 * Deterministic randomness. mulberry32 + FNV-1a sub-seeds: the numbers of one entity depend only on
 * the global seed and the entity's name, so adding a video does not change the numbers of the others.
 */

export const SEED = 20260105;

/** FNV-1a 32-bit hash of a string. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  /** [0, 1) */
  next(): number;
  /** Float in [min, max). */
  float(min: number, max: number): number;
  /** Integer in [min, max]. */
  int(min: number, max: number): number;
  /** Standard normal (Box–Muller). */
  normal(): number;
  /** Log-normal with the given median and sigma of the underlying normal. */
  logNormal(median: number, sigma: number): number;
}

/** A random stream for one named entity, e.g. `rng("views:mock-yt-0003")`. */
export function rng(name: string, seed = SEED): Rng {
  const next = mulberry32(seed ^ hashString(name));
  const r: Rng = {
    next,
    float: (min, max) => min + (max - min) * next(),
    int: (min, max) => min + Math.floor((max - min + 1) * next()),
    normal: () => {
      const u = 1 - next();
      const v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    logNormal: (median, sigma) => median * Math.exp(sigma * r.normal()),
  };
  return r;
}
