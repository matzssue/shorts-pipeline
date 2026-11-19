import { fmtDec } from "@/charts/format";
import { linear, pct, ticks } from "@/charts/scale";

export interface RangeRow {
  key: string;
  name: string;
  /** Allowed range [min, max]. */
  range: readonly [number, number];
  points: { id: string; label: string; value: number }[];
}

/**
 * Band with points: the allowed range of each row as a grey band, every item as a dot on one shared
 * axis. A dot outside its band is drawn hollow, so the break shows without colour. Each dot takes
 * hover and keyboard focus and shows its label and value.
 */
export function RangeDots({ rows, unit, digits = 1 }: { rows: RangeRow[]; unit: string; digits?: number }) {
  const all = rows.flatMap((r) => [...r.range, ...r.points.map((p) => p.value)]);
  const t = ticks(Math.min(...all), Math.max(...all), 4);
  const x = linear([t[0]!, t.at(-1)!]);
  const fmt = (v: number) => `${fmtDec(v, digits)} ${unit}`;

  return (
    <div>
      <ol className="rng">
        {rows.map((r) => (
          <li key={r.key}>
            <span className="name">
              <b>{r.key}</b>
              {r.name}
            </span>
            <span className="ax">
              <i className="band" style={{ left: pct(x(r.range[0])), width: pct(x(r.range[1]) - x(r.range[0])) }} aria-hidden="true" />
              {!r.points.length ? <span className="sr-only">{`${r.key}: allowed ${fmtDec(r.range[0], 0)}–${fmtDec(r.range[1], 0)} ${unit}, no video`}</span> : null}
              {r.points.map((p) => {
                const out = p.value < r.range[0] || p.value > r.range[1];
                const pos = x(p.value);
                const text = `${p.label} · ${fmt(p.value)}${out ? ` · outside ${fmtDec(r.range[0], 0)}–${fmtDec(r.range[1], 0)} ${unit}` : ""}`;
                return (
                  <span
                    key={p.id}
                    className={`d tip${out ? " out" : ""}${pos > 70 ? " tip-l" : pos < 30 ? " tip-r" : ""}`}
                    style={{ left: pct(pos) }}
                    role="img"
                    tabIndex={0}
                    aria-label={`${r.key}: ${text}`}
                    data-tip={text}
                  />
                );
              })}
            </span>
          </li>
        ))}
      </ol>
      <div className="rng-ax" aria-hidden="true">
        <div>
          {t.map((v) => (
            <span key={v} style={{ left: pct(x(v)) }}>
              {v === t.at(-1) ? `${fmtDec(v, 0)} ${unit}` : fmtDec(v, 0)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
