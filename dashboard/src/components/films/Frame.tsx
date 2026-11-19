import { Space_Grotesk } from "next/font/google";
import type { CSSProperties } from "react";
import { paletteFor } from "@shorts/schema/video";
import { filmNo } from "@/charts/format";

// The videos' own typeface, used only inside a frame: the frame is a preview of the video, not interface.
export const grotesk = Space_Grotesk({ subsets: ["latin", "latin-ext"], weight: ["700"], display: "swap" });

/**
 * A video as a 9:16 frame in its series palette: number, first text on screen, a caption bar.
 * A video without a render is an empty frame with its number.
 */
export function Frame({ number, series, firstText, rendered }: { number: number; series: number; firstText?: string; rendered: boolean }) {
  if (!rendered)
    return (
      <span className="frame none" aria-hidden="true">
        <b>{filmNo(number)}</b>
      </span>
    );
  const p = paletteFor(series);
  return (
    <span className={`frame ${grotesk.className}`} style={{ "--b": p.base, "--a": p.accent } as CSSProperties} aria-hidden="true">
      <b>{filmNo(number)}</b>
      {firstText ? <span className="fr-head">{firstText}</span> : null}
      <i />
    </span>
  );
}
