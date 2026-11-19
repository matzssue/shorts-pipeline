/** Input data for the Remotion composition – types only, no Node dependencies (browser bundle). */

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export type ComposeOverlay =
  | { type: "label"; heading: string; value: string }
  | { type: "quiz"; options: [string, string]; countdown?: number; answer?: number }
  | { type: "source"; text: string };

export interface ComposeScene {
  kind: "video" | "image" | "text";
  /** Path relative to the video folder (staticFile); none for a text card. */
  src?: string;
  from: number;
  durationInFrames: number;
  /** Slow-down when the clip is shorter than the scene (1 = normal). */
  playbackRate: number;
  headline: string;
  overlay?: ComposeOverlay;
  /** This scene's part of the narration: [startFrom, endAt) in audio frames, starting `delay` frames after the scene. */
  audio: { startFrom: number; endAt: number; delay: number };
}

export interface ComposeWord {
  text: string;
  from: number;
  to: number;
}

export interface ComposeProps {
  [key: string]: unknown;
  /** Series number – picks the palette and the intro card title. */
  series: number;
  seriesTitle: string;
  /** Label above the source overlay, e.g. "Source". */
  sourceLabel: string;
  audioSrc: string;
  scenes: ComposeScene[];
  words: ComposeWord[];
  durationInFrames: number;
}
