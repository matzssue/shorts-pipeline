import { fmtInt, fmtPct } from "@/charts/format";
import { pct } from "@/charts/scale";

/** Small inline meter for a table cell: a 54 px track and the number. The number is the value; the track is a glance. */
export function Meter({ value, max = 100, text, label }: { value: number; max?: number; text?: string; label: string }) {
  const share = Math.min(1, Math.max(0, value / max));
  const shown = text ?? fmtPct(value);
  return (
    <span className="meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={shown}>
      <i style={{ ["--v" as string]: pct(share * 100) }} aria-hidden="true" />
      <span className="num">{shown}</span>
    </span>
  );
}

/**
 * Use against a limit: one ratio, so a bar with a mark at the limit, not a pie. Above the limit the
 * track ends at the mark and the overrun is said in words.
 */
export function LimitMeter({ used, limit, unit, label }: { used: number; limit: number; unit: string; label: string }) {
  const share = limit > 0 ? used / limit : 0;
  const scaleMax = Math.max(limit, used);
  const text = `${fmtInt(used)} of ${fmtInt(limit)} ${unit} · ${fmtPct(share * 100, 0)}`;
  return (
    <div>
      <p className="flex flex-wrap items-baseline justify-between gap-x-4">
        <span className="text-[0.8125rem] text-ink-2">{label}</span>
        <span className="num">{text}</span>
      </p>
      <div
        className="limit-track"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
        aria-valuetext={share > 1 ? `${text}, over the limit` : text}
      >
        <i style={{ width: pct((used / scaleMax) * 100) }} />
        <b style={{ left: pct((limit / scaleMax) * 100) }} />
      </div>
      <p className="limit-scale" aria-hidden="true">
        <span>0</span>
        <span>{share > 1 ? `limit ${fmtInt(limit)} · over by ${fmtInt(used - limit)}` : `limit ${fmtInt(limit)}`}</span>
      </p>
    </div>
  );
}
