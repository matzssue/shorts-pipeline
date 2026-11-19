import { loadFont } from "@remotion/google-fonts/SpaceGrotesk";

/** One typeface for the whole video, with Latin Extended (Polish characters). */
export const { fontFamily } = loadFont("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });

export { PALETTES, paletteFor, type Palette } from "@shorts/schema/video";

export const WHITE = "#FFFFFF";
export const INK = "#141414";
export const CORRECT = "#2EB872";

export { SAFE } from "@shorts/schema/video";
