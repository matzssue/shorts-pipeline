import type { CSSProperties } from "react";
import { paletteFor } from "@shorts/schema/video";
import { filmNo } from "@/charts/format";
import type { OvFilm } from "@/data/selectors/overview";
import { messages } from "@/lib/messages.en";

/** A 9:16 thumbnail in the series palette; a video without a render is an empty frame with its number. */
export function Thumb({ film }: { film: OvFilm }) {
  if (film.durationS === undefined)
    return (
      <span className="th none" aria-hidden="true">
        <b>{filmNo(film.number)}</b>
      </span>
    );
  const p = paletteFor(film.series);
  return (
    <span className="th" style={{ "--b": p.base, "--a": p.accent } as CSSProperties} aria-hidden="true">
      <b>{filmNo(film.number)}</b>
      <i />
    </span>
  );
}

/** QA result as a word in one of three weights: quiet OK, outlined warning, filled error. */
export function QaWord({ film }: { film: OvFilm }) {
  const s = messages.status;
  if (!film.qa) return <span className="mute">–</span>;
  if (film.qa.errors || !film.qa.passed) return <span className="lv lv-err">{s.error}</span>;
  if (film.qa.warnings) return <span className="lv lv-warn">{s.warning(film.qa.warnings)}</span>;
  return <span className="lv lv-ok">{s.ok}</span>;
}

export function SectionHead({ title, note, level = 2 }: { title: string; note?: string; level?: 2 | 1 }) {
  const H = level === 1 ? "h1" : "h2";
  return (
    <header className="sec-h">
      <H>{title}</H>
      {note ? <p className="sec-note">{note}</p> : null}
    </header>
  );
}
