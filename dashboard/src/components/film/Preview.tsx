import type { CSSProperties } from "react";
import { grotesk } from "@/components/films/Frame";
import type { Timeline } from "@/data/selectors/film";
import { frameAt } from "@/data/selectors/frame";
import { messages } from "@/lib/messages.en";

const t = messages.film.timeline;

/**
 * A 9:16 frame of the video drawn from the timeline: background by scene kind, headline, overlay card
 * and the caption line with the spoken word on the accent box – positions in % of 1080×1920.
 */
export function Preview({ tl, frame }: { tl: Timeline; frame: number }) {
  const { index, scene, overlay, quiz, caption } = frameAt(tl, frame);
  const p = tl.palette;
  const kind = t.kinds[scene.kind];
  return (
    <div
      className={`pv ${grotesk.className}`}
      data-kind={scene.kind}
      role="img"
      aria-label={t.preview(index + 1, kind)}
      style={{ "--b": p.base, "--a": p.accent, "--oa": p.onAccent } as CSSProperties}
      data-testid="preview"
    >
      <div className="pv-bg" />
      {scene.kind !== "text" ? <p className="pv-note">{`${index + 1} · ${kind}`}</p> : null}
      {scene.kind === "text" && !scene.headline && tl.seriesTitle ? <div className="pv-series">{tl.seriesTitle}</div> : null}
      {overlay?.type === "label" ? (
        <div className="pv-call" data-testid="pv-overlay">
          <small>{overlay.heading}</small>
          <b>{overlay.value}</b>
        </div>
      ) : null}
      {overlay?.type === "source" ? (
        <div className="pv-src" data-testid="pv-overlay">
          <small>{tl.sourceLabel}</small>
          <b>{overlay.text}</b>
        </div>
      ) : null}
      {overlay?.type === "quiz" ? (
        <div className="pv-quiz" data-testid="pv-overlay">
          {overlay.options.map((x, i) => (
            <div key={i} className={quiz?.reveal ? (overlay.answer === i ? "right" : "dim") : undefined}>
              <i>{String.fromCharCode(65 + i)}</i>
              {x}
            </div>
          ))}
          {quiz?.left ? <b className="pv-count">{quiz.left}</b> : null}
        </div>
      ) : null}
      {scene.headline ? (
        <div className="pv-head" data-testid="pv-headline">
          <i />
          <span>{scene.headline}</span>
        </div>
      ) : null}
      {caption ? (
        <div className="pv-cc" data-testid="pv-caption">
          {caption.chunk.words.map((w, i) => (
            <span key={i} className={caption.active[i] ? "on" : undefined}>
              {w.text}
            </span>
          ))}
        </div>
      ) : null}
      <div className="pv-guides" aria-hidden="true">
        <i className="g-bot" />
        <i className="g-right" />
        <i className="g-safe" />
        <span className="g-lab">{t.platformUi}</span>
      </div>
    </div>
  );
}
