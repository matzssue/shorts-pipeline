import { loadFont } from "@remotion/google-fonts/SpaceGrotesk";

/** One typeface for the whole video, with Latin Extended (Polish characters). */
export const { fontFamily } = loadFont("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });

export interface Palette {
  /** Background of text cards and headline boxes. */
  base: string;
  /** Highlight: current caption word, stripes, accents. */
  accent: string;
  /** Text on top of `accent`. */
  onAccent: string;
}

/** Palettes per series (series 1 → first one, cycling). */
export const PALETTES: readonly Palette[] = [
  { base: "#0F2E2B", accent: "#FF7A59", onAccent: "#0F2E2B" },
  { base: "#2A1B3D", accent: "#C6F432", onAccent: "#2A1B3D" },
  { base: "#10243E", accent: "#FFD23F", onAccent: "#10243E" },
];

export const paletteFor = (series: number): Palette => PALETTES[(Math.max(1, series) - 1) % PALETTES.length]!;

export const WHITE = "#FFFFFF";
export const INK = "#141414";
export const CORRECT = "#2EB872";

/**
 * Safe area on 1080×1920: below the top bar, above the bottom ~20% (caption, buttons)
 * and left of the right-hand button column.
 */
export const SAFE = { top: 170, bottom: 1500, left: 70, right: 930 } as const;
