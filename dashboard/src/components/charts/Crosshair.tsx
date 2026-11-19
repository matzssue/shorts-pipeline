"use client";

import { useEffect, useState, type KeyboardEvent, type PointerEvent } from "react";

export interface Readout {
  /** e.g. "Day 7". */
  title: string;
  /** Value first, then the series it belongs to. */
  rows: { name: string; value: string }[];
}

/**
 * Crosshair over a line chart: a hairline snaps to the nearest x position and one readout lists every
 * series there. Mouse, touch (horizontal drag) and keyboard (arrows, Home, End) do the same. It only
 * adds hover detail: every value is also in the chart's labels and its table twin.
 */
export function Crosshair({ readout, name, xName }: { readout: Readout[]; name: string; xName: string }) {
  const n = readout.length;
  const [at, setAt] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  // rendered only once JavaScript runs: without it a focusable slider would do nothing
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const fromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / Math.max(1, r.width)));
    setAt(Math.round(ratio * (n - 1)));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const cur = at ?? n - 1;
    const next = { ArrowRight: cur + 1, ArrowUp: cur + 1, ArrowLeft: cur - 1, ArrowDown: cur - 1, Home: 0, End: n - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setAt(Math.min(n - 1, Math.max(0, next)));
  };

  const i = at ?? n - 1;
  const r = readout[i]!;
  const left = n > 1 ? (i / (n - 1)) * 100 : 0;
  const show = at !== null;
  if (!ready) return null;

  return (
    <div
      className="xhair"
      role="slider"
      tabIndex={0}
      aria-label={`${name}: ${xName.toLowerCase()}`}
      aria-valuemin={0}
      aria-valuemax={n - 1}
      aria-valuenow={i}
      aria-valuetext={`${r.title}. ${r.rows.map((x) => `${x.name} ${x.value}`).join(", ")}`}
      onPointerMove={fromPointer}
      onPointerDown={fromPointer}
      onPointerLeave={() => !focused && setAt(null)}
      onFocus={() => {
        setFocused(true);
        setAt((a) => a ?? n - 1);
      }}
      onBlur={() => {
        setFocused(false);
        setAt(null);
      }}
      onKeyDown={onKey}
    >
      {show ? (
        <>
          <span className="xhair-line" style={{ left: `${left}%` }} />
          <span
            className="xhair-tip"
            aria-hidden="true"
            style={left > 55 ? { left: `${left}%`, transform: "translateX(calc(-100% - 8px))" } : { left: `calc(${left}% + 8px)` }}
          >
            <b>{r.title}</b>
            {r.rows.map((x) => (
              <span key={x.name}>
                <strong>{x.value}</strong>
                {x.name}
              </span>
            ))}
          </span>
        </>
      ) : null}
    </div>
  );
}
