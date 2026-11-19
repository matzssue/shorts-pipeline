/** Video frame constants. No dependencies – safe to import into the Remotion browser bundle. */

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

/**
 * Safe area on 1080×1920: below the top bar, above the bottom ~20% (caption, buttons)
 * and left of the right-hand button column.
 */
export const SAFE = { top: 170, bottom: 1500, left: 70, right: 930 } as const;
