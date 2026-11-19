import { fmtInt } from "@/charts/format";
import { lastPoint, linePath } from "@/charts/path";
import { linear, pct } from "@/charts/scale";
import { Crosshair, type Readout } from "./Crosshair";

export interface Line {
  id: string;
  /** context: thin grey; median: thick ink; highlight: ink over the highlighter. */
  role: "context" | "median" | "highlight";
  values: readonly (number | undefined)[];
  /** Direct label at the line's end – only on the lines that carry the conclusion. */
  tag?: string;
}

export interface LineChartProps {
  /** Short name of the chart, e.g. "YouTube Shorts". */
  name: string;
  /** What the chart shows, with its key numbers – the text a screen reader gets. */
  label: string;
  lines: Line[];
  /** Number of x positions (0 … count − 1). */
  count: number;
  /** y ticks from `ticks()`; the first and last are the scale ends (shared between small multiples). */
  yTicks: number[];
  /** x axis labels: start, middle, end. */
  xLabels: readonly [string, string, string];
  /** Hover and keyboard readout per x position; without it there is no crosshair. */
  readout?: Readout[];
  /** Shown over empty axes when there is no line. */
  empty?: string;
  /** Name of the x position for the crosshair's slider ("Day"). */
  xName?: string;
}

const ORDER = { context: 0, highlight: 1, median: 2 } as const;

/**
 * Line chart rendered on the server to SVG in a 0–100 box: lines stretch with the container, strokes
 * keep their width (`non-scaling-stroke`), labels are HTML so text never distorts.
 */
export function LineChart({ name, label, lines, count, yTicks, xLabels, readout, empty, xName = "Position" }: LineChartProps) {
  const x = linear([0, Math.max(1, count - 1)]);
  const y = linear([yTicks[0]!, yTicks.at(-1)!], [100, 0]);
  const sorted = [...lines].sort((a, b) => ORDER[a.role] - ORDER[b.role]);
  const ends = sorted
    .filter((l) => l.tag)
    .map((l) => ({ l, p: lastPoint(l.values) }))
    .filter((e): e is { l: Line; p: { i: number; v: number } } => e.p !== undefined);

  return (
    <div className="plot-wrap">
      <div className="yax" aria-hidden="true">
        {yTicks.map((t) => (
          <span key={t} style={{ top: pct(y(t)) }}>
            {fmtInt(t)}
          </span>
        ))}
      </div>
      <div className="plot">
        <div className="plot-img" role="img" aria-label={label}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {yTicks.map((t) => (
            <line key={t} className="g-grid" x1="0" x2="100" y1={y(t)} y2={y(t)} />
          ))}
          {sorted.map((l) => {
            const d = linePath(l.values, x, y);
            if (!d) return null;
            if (l.role === "highlight")
              return (
                <g key={l.id}>
                  <path className="g-hl" d={d} />
                  <path className="g-top" d={d} />
                </g>
              );
            return <path key={l.id} className={l.role === "median" ? "g-med" : "g-ctx"} d={d} />;
          })}
        </svg>
        {ends.map(({ l, p }) => (
          <span key={`dot-${l.id}`} className="dot" style={{ left: pct(x(p.i)), top: pct(y(p.v)) }} aria-hidden="true" />
        ))}
        {ends.map(({ l, p }) => (
          <span
            key={`tag-${l.id}`}
            className={l.role === "highlight" ? "tag hl" : "tag"}
            style={{ left: pct(x(p.i)), top: pct(y(p.v)) }}
            aria-hidden="true"
          >
            {l.tag}
          </span>
        ))}
        {!lines.length && empty ? (
          <p className="plot-empty" aria-hidden="true">
            {empty}
          </p>
        ) : null}
        </div>
        {readout && lines.length ? <Crosshair readout={readout} name={name} xName={xName} /> : null}
      </div>
      <div className="xax" aria-hidden="true">
        {xLabels.map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </div>
    </div>
  );
}
