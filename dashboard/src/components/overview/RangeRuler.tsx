"use client";

import Link from "next/link";
import { useRef, useState, type PointerEvent } from "react";
import { count, fmtDay, fmtMeasured, fmtRange, fmtSpan } from "@/charts/format";
import { pct } from "@/charts/scale";
import { addDays, PRESETS, presetRange, sameRange, spanDays, type OverviewInput, type OvFilm, type Range } from "@/data/selectors/overview";
import { messages } from "@/lib/messages.en";

const m = messages.overview.range;

/**
 * The season as a ruler: days as ticks, weeks as longer ticks, publications as marks on one lane per
 * channel, the playhead on the measurement day. It is the picture of the publishing rhythm and the
 * range filter at once: drag across it, use the shortcuts or type the dates. Without JavaScript it
 * shows the whole season and no controls.
 */
export function RangeRuler({
  input,
  range,
  films,
  href,
  onChange,
}: {
  input: OverviewInput;
  range: Range;
  /** Videos in the range, for the summary line. */
  films: OvFilm[];
  /** Address for a range; absent = static render (no controls). */
  href?: (r: Range) => string;
  onChange?: (r: Range) => void;
}) {
  const n = spanDays({ from: input.start, to: input.end });
  const idx = (iso: string) => spanDays({ from: input.start, to: iso }) - 1;
  const x = (i: number) => ((i + 0.5) / n) * 100;
  const body = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ a: number; b: number } | null>(null);

  const dayAt = (e: PointerEvent<HTMLDivElement>) => {
    const r = body.current!.getBoundingClientRect();
    return Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / Math.max(1, r.width)) * n)));
  };
  const toRange = (a: number, b: number): Range => ({ from: addDays(input.start, Math.min(a, b)), to: addDays(input.start, Math.max(a, b)) });

  const shown = drag ? toRange(drag.a, drag.b) : range;
  const s0 = Math.max(0, idx(shown.from));
  const s1 = Math.min(n - 1, idx(shown.to));
  const published = films.filter((f) => f.stage === "published");
  const channels = new Set(published.map((f) => f.channel).filter(Boolean)).size;
  const live = !!onChange;

  return (
    <section className="ruler page" aria-labelledby="ov-title">
      <div className="ruler-meta">
        <h1 id="ov-title" className="text-lg leading-[1.2] font-bold [font-stretch:88%]">
          {messages.views.overview.title}
        </h1>
        <span className="num" data-testid="range-summary">
          {fmtRange(range.from, range.to)} · {fmtSpan(spanDays(range))} · {count(published.length, "video", "videos")} on {count(channels, "channel", "channels")}
        </span>
        {input.measuredAt ? <span className="num">{m.measured(fmtMeasured(input.measuredAt))}</span> : null}
      </div>

      <div
        ref={body}
        className={live ? "ruler-body live" : "ruler-body"}
        role="img"
        aria-label={`${m.ruler} ${fmtRange(range.from, range.to)}.`}
        onPointerDown={
          live
            ? (e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                const d = dayAt(e);
                setDrag({ a: d, b: d });
              }
            : undefined
        }
        onPointerMove={live ? (e) => drag && setDrag({ a: drag.a, b: dayAt(e) }) : undefined}
        onPointerUp={
          live
            ? () => {
                if (drag) onChange!(toRange(drag.a, drag.b));
                setDrag(null);
              }
            : undefined
        }
        onPointerCancel={live ? () => setDrag(null) : undefined}
      >
        {s0 <= s1 ? <span className="ruler-sel" style={{ left: pct((s0 / n) * 100), width: pct(((s1 - s0 + 1) / n) * 100) }} aria-hidden="true" /> : null}
        {input.channels.map((ch) => (
          <div key={ch.id} className="lane" aria-hidden="true">
            <span className="num">{ch.id}</span>
            {input.films
              .filter((f) => f.channel === ch.id && f.published)
              .map((f) => (
                <i key={f.id} className={f.published! >= shown.from && f.published! <= shown.to ? undefined : "out"} style={{ left: pct(x(idx(f.published!))) }} />
              ))}
          </div>
        ))}
        <div className="rticks" aria-hidden="true">
          {Array.from({ length: n }, (_, i) => (
            <i key={i} className={i % 7 === 0 ? "wk" : undefined} style={{ left: pct((i / n) * 100) }} />
          ))}
        </div>
        <div className="rweeks" aria-hidden="true">
          {Array.from({ length: Math.ceil(n / 7) }, (_, w) => (
            <span key={w} style={{ left: pct(((w * 7) / n) * 100) }}>
              <b>W{w + 1}</b>
              <span>{fmtDay(addDays(input.start, w * 7))}</span>
            </span>
          ))}
        </div>
        {input.measuredAt ? (
          <span className="ph" style={{ left: pct(x(idx(input.measuredAt.slice(0, 10)))) }} aria-hidden="true">
            <b>{fmtDay(input.measuredAt)}</b>
          </span>
        ) : null}
      </div>

      {href ? (
        <div className="range-ctl">
          <span className="lab">{m.label}</span>
          {PRESETS.map((p) => {
            const r = presetRange(input, p);
            return (
              <Link key={p} href={href(r)} scroll={false} aria-current={sameRange(r, range) ? "true" : undefined}>
                {m.presets[p]}
              </Link>
            );
          })}
          <label>
            {m.from}
            <input type="date" value={range.from} onChange={(e) => e.target.value && onChange?.({ from: e.target.value, to: range.to })} />
          </label>
          <label>
            {m.to}
            <input type="date" value={range.to} onChange={(e) => e.target.value && onChange?.({ from: range.from, to: e.target.value })} />
          </label>
          <span className="text-[0.75rem] text-ink-3">{m.drag}</span>
        </div>
      ) : null}
    </section>
  );
}
