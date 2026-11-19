"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { captionAt, sceneAt, timecode } from "@shorts/timeline";
import { fmtDec, fmtSec } from "@/charts/format";
import { SectionHead } from "@/components/overview/bits";
import { CPS_LIMIT, type EdlRow, type Timeline } from "@/data/selectors/film";
import { messages } from "@/lib/messages.en";
import { parseT } from "@/data/selectors/frame";
import { Preview } from "./Preview";

const t = messages.film.timeline;
const e = messages.film.edl;

const at = (x: number, frames: number) => `${(x / frames) * 100}%`;
const span = (a: number, b: number, frames: number) => ({ left: at(a, frames), width: `calc(${((b - a) / frames) * 100}% - 1px)` });

/**
 * The timeline (frame preview + V/T/A/N tracks under one playhead) and the edit list that follows the
 * playhead. The playhead is a slider: pointer and touch scrub, arrows step a frame (Shift: a second),
 * Home and End jump to the ends. Its position goes into `?t=` so a link opens the same frame.
 */
export function Bench({ tl, edl, avgViewSeconds }: { tl: Timeline; edl: EdlRow[]; avgViewSeconds?: number }) {
  const [frame, setFrame] = useState(0);
  const [ready, setReady] = useState(false);
  const over = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const last = tl.frames - 1;

  useEffect(() => {
    const fromUrl = parseT(window.location.search, tl.frames);
    if (fromUrl !== undefined) setFrame(fromUrl);
    setReady(true);
    return () => clearTimeout(timer.current);
  }, [tl.frames]);

  const move = useCallback(
    (f: number) => {
      const next = Math.max(0, Math.min(last, Math.round(f)));
      setFrame(next);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const u = new URL(window.location.href);
        u.searchParams.set("t", String(next));
        window.history.replaceState(window.history.state, "", u);
      }, 250);
    },
    [last],
  );

  const fromPointer = (ev: PointerEvent<HTMLDivElement>) => {
    const r = over.current!.getBoundingClientRect();
    move(((ev.clientX - r.left) / r.width) * tl.frames);
  };
  const onKey = (ev: KeyboardEvent<HTMLDivElement>) => {
    const step = ev.shiftKey ? tl.fps : 1;
    const to =
      ev.key === "ArrowRight" || ev.key === "ArrowUp"
        ? frame + step
        : ev.key === "ArrowLeft" || ev.key === "ArrowDown"
          ? frame - step
          : ev.key === "PageUp"
            ? frame + tl.fps
            : ev.key === "PageDown"
              ? frame - tl.fps
              : ev.key === "Home"
                ? 0
                : ev.key === "End"
                  ? last
                  : undefined;
    if (to === undefined) return;
    ev.preventDefault();
    move(to);
  };

  const si = Math.max(0, sceneAt(tl.scenes, frame));
  const scene = tl.scenes[si]!;
  const kind = t.kinds[scene.kind];
  const caption = captionAt(tl.chunks, frame, tl.fps);
  const spoken = new Set(caption ? caption.chunk.words.filter((_, i) => caption.active[i]).map((w) => w.from) : []);
  const tc = timecode(frame, tl.fps);
  const seconds = Math.floor(tl.frames / tl.fps);

  return (
    <>
      <section className="sec" data-testid="timeline">
        <SectionHead title={t.title} note={t.note} />
        <div className="bench">
          <div className="pv-col">
            <Preview tl={tl} frame={frame} />
            <p className="pv-cap">{t.previewCap}</p>
            <label className="chk">
              <input type="checkbox" defaultChecked /> {t.safe}
            </label>
          </div>
          <div className="tl">
            <p className="tl-read" aria-live="off">
              <b data-testid="tc">{tc}</b>
              <span className="num">{t.at(si + 1, tl.scenes.length, kind, frame, tl.frames)}</span>
            </p>
            <div className="tl-grid">
              <span className="tk-l" />
              <div className="tk tk-ruler" aria-hidden="true">
                {Array.from({ length: seconds + 1 }, (_, s) => (
                  <i key={s} className={s % 5 === 0 ? "s5" : undefined} style={{ left: at(s * tl.fps, tl.frames) }} />
                ))}
                {Array.from({ length: Math.floor(seconds / 5) + 1 }, (_, k) => (
                  <span key={k} style={{ left: at(k * 5 * tl.fps, tl.frames) }}>
                    {k === 0 ? "0 s" : k * 5}
                  </span>
                ))}
              </div>

              <span className="tk-l" title={t.tracks.V}>
                V
              </span>
              <div className="tk tk-v">
                {tl.scenes.map((s) => (
                  <div
                    key={s.index}
                    className={`clip k-${s.kind}${s.playbackRate < 1 ? " slow" : ""}`}
                    style={span(s.from, s.from + s.durationInFrames, tl.frames)}
                    title={`${s.index + 1} · ${t.kinds[s.kind]} · ${fmtSec(s.durationInFrames / tl.fps)}${s.playbackRate < 1 ? ` · ${t.slowed(fmtDec(s.playbackRate, 2))}` : ""}`}
                  >
                    <span>
                      {s.index + 1}
                      {s.playbackRate < 1 ? ` · ${fmtDec(s.playbackRate, 2)}×` : ""}
                    </span>
                  </div>
                ))}
              </div>

              <span className="tk-l" title={t.tracks.T}>
                T
              </span>
              <div className="tk tk-ov">
                {tl.scenes.flatMap((s) => {
                  const out = [];
                  if (s.headline)
                    out.push(
                      <div key={`h${s.index}`} className="ov" style={span(s.from, s.from + s.durationInFrames, tl.frames)} title={s.headline}>
                        {t.overlays.headline}
                      </div>,
                    );
                  if (s.overlay) {
                    const delay = s.overlay.type === "label" ? Math.round(tl.fps * 0.5) : s.overlay.type === "source" ? Math.round(tl.fps * 0.3) : 0;
                    out.push(
                      <div key={`o${s.index}`} className="ov ov2" style={span(s.from + delay, s.from + s.durationInFrames, tl.frames)}>
                        {t.overlays[s.overlay.type]}
                      </div>,
                    );
                  }
                  return out;
                })}
              </div>

              <span className="tk-l" title={t.tracks.A}>
                A
              </span>
              <div className="tk tk-vo">
                {tl.scenes.map((s) => (s.narration ? <i key={s.index} className="vo" style={span(s.narration.from, s.narration.to, tl.frames)} /> : null))}
              </div>

              <span className="tk-l" title={t.tracks.N}>
                N
              </span>
              <div className="tk tk-cc">
                {tl.words.map((w, i) => (
                  <i key={i} className={spoken.has(w.from) && frame >= w.from && frame < w.to + 2 ? "w on" : "w"} style={span(w.from, w.to, tl.frames)} />
                ))}
              </div>

              {avgViewSeconds !== undefined && avgViewSeconds * tl.fps < tl.frames ? (
                <div className={(avgViewSeconds * tl.fps) / tl.frames > 0.55 ? "tl-avg left" : "tl-avg"} style={{ left: `calc(1.9rem + (100% - 1.9rem) * ${(avgViewSeconds * tl.fps) / tl.frames})` }}>
                  <span>{t.avgView(fmtSec(avgViewSeconds))}</span>
                </div>
              ) : null}

              {ready ? (
                <div
                  ref={over}
                  className="tl-over"
                  role="slider"
                  tabIndex={0}
                  aria-label={t.playhead}
                  aria-valuemin={0}
                  aria-valuemax={last}
                  aria-valuenow={frame}
                  aria-valuetext={t.valueText(tc, si + 1, kind, caption ? caption.chunk.words.map((w) => w.text).join(" ") : "")}
                  aria-orientation="horizontal"
                  data-testid="playhead"
                  onKeyDown={onKey}
                  onPointerDown={(ev) => {
                    ev.currentTarget.setPointerCapture(ev.pointerId);
                    fromPointer(ev);
                  }}
                  onPointerMove={(ev) => {
                    if (ev.pointerType === "mouse" || ev.buttons) fromPointer(ev);
                  }}
                >
                  <div className="tl-ph" style={{ left: at(frame, tl.frames) }}>
                    {/* the label slides from the right of the line to its left, so it never leaves the timeline */}
                    <b style={{ transform: `translateX(${(-frame / last) * 100}%)` }}>{tc}</b>
                  </div>
                </div>
              ) : (
                <div className="tl-over static" aria-hidden="true">
                  <div className="tl-ph" style={{ left: "0%" }} />
                </div>
              )}
            </div>
            <p className="tl-legend">
              <span>
                <b>V</b>
                {t.tracks.V}:<i className="k-video" />
                {t.kinds.video}
                <i className="k-image" />
                {t.kinds.image}
                <i className="k-text" />
                {t.kinds.text}
              </span>
              <span>
                <b>T</b>
                {t.tracks.T}
              </span>
              <span>
                <b>A</b>
                {t.tracks.A}
              </span>
              <span>
                <b>N</b>
                {t.tracks.N}
              </span>
            </p>
            {ready ? <p className="tl-hint">{t.hint}</p> : null}
          </div>
        </div>
      </section>

      <section className="sec" data-testid="edl">
        <SectionHead title={e.title} note={e.note(edl.length, CPS_LIMIT)} />
        <EditList edl={edl} fps={tl.fps} current={si} />
      </section>
    </>
  );
}

export function EditList({ edl, fps, current }: { edl: EdlRow[]; fps: number; current?: number }) {
  const c = e.cols;
  return (
    <div className="edl-wrap">
      <table className="tbl edl">
        <thead>
          <tr>
            <th scope="col">{c.no}</th>
            <th scope="col">{c.kind}</th>
            <th scope="col">{c.in}</th>
            <th scope="col">{c.out}</th>
            <th scope="col" className="r">
              {c.len}
            </th>
            <th scope="col">{c.vo}</th>
            <th scope="col" className="r">
              {c.cps}
            </th>
            <th scope="col">{c.screen}</th>
            <th scope="col">{c.fact}</th>
          </tr>
        </thead>
        <tbody>
          {edl.map((r) => (
            <tr key={r.index} className={r.index === current ? "cur" : undefined} aria-current={r.index === current ? "true" : undefined}>
              <td className="n">
                <b>{r.index + 1}</b>
              </td>
              <td className="num">{t.kinds[r.kind]}</td>
              <td className="num" data-l={c.in}>
                {r.from === undefined ? "–" : timecode(r.from, fps)}
              </td>
              <td className="num" data-l={c.out}>
                {r.to === undefined ? "–" : timecode(r.to, fps)}
              </td>
              <td className="num r" data-l={c.len}>
                {fmtSec(r.seconds)}
              </td>
              <td className="vo-c">
                <p className="vo-t">{r.voiceover || <span className="mute">–</span>}</p>
              </td>
              <td className={`num r${r.cps > CPS_LIMIT ? " over" : ""}`} data-l={c.cps}>
                {fmtDec(r.cps)}
                {r.cps > CPS_LIMIT ? <span className="sr-only"> ({e.over})</span> : null}
              </td>
              <td className="x" data-l={c.screen}>
                {[r.onScreen, r.overlay].filter(Boolean).join(" · ") || <span className="mute">–</span>}
              </td>
              <td className="x" data-l={c.fact}>
                {r.claims.length ? r.claims.map((cl) => <span key={cl.source} className="num src">{cl.source}</span>) : <span className="mute">–</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
