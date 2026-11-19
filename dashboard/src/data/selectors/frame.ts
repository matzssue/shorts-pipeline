import { captionAt, sceneAt } from "@shorts/timeline";
import type { Timeline } from "./film";

/** What the render draws at `frame`, as data: the preview and the tests read the same thing. */
export function frameAt(tl: Timeline, frame: number) {
  const index = Math.max(0, sceneAt(tl.scenes, frame));
  const scene = tl.scenes[index]!;
  const local = frame - scene.from;
  const o = scene.overlay;
  // The cards spring in after a short delay in the render (Film.tsx); the preview shows them from that frame.
  const shown = !o ? false : o.type === "label" ? local >= Math.round(tl.fps * 0.5) : o.type === "source" ? local >= Math.round(tl.fps * 0.3) : true;
  let quiz: { reveal: boolean; left: number } | undefined;
  if (o?.type === "quiz") {
    const n = scene.durationInFrames;
    const countFrom = o.countdown ? Math.max(0, n - Math.round(o.countdown * tl.fps)) : n;
    const left = o.countdown && local >= countFrom ? Math.min(o.countdown, Math.ceil((n - local) / tl.fps)) : 0;
    quiz = { reveal: o.answer !== undefined && local >= Math.round(tl.fps * 0.4), left };
  }
  const caption = captionAt(tl.chunks, frame, tl.fps);
  return { index, scene, overlay: shown ? o : undefined, quiz, caption };
}

/** `?t=` – the playhead in frames; anything else is ignored. */
export function parseT(search: string, frames: number): number | undefined {
  const raw = new URLSearchParams(search).get("t");
  if (raw === null || !/^\d+$/.test(raw)) return undefined;
  return Math.min(Number(raw), frames - 1);
}
