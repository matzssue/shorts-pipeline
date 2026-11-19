import { count, filmNo, fmtInt } from "@/charts/format";
import type { Starts } from "@/data/selectors/starts";
import { messages } from "@/lib/messages.en";
import { LineChart, type Line } from "./LineChart";
import type { Readout } from "./Crosshair";

const m = messages.charts;
const NAMES = { youtube: "YouTube Shorts", instagram: "Instagram Reels" } as const;

/**
 * How videos start on one platform: every video a thin grey line, the median thick, the best start
 * highlighted. With one video the median goes away and the video's own line stays.
 */
export function StartChart({ data, yTicks }: { data: Starts; yTicks: number[] }) {
  const name = NAMES[data.platform];
  const { days, best } = data;
  const lines: Line[] = [];
  if (data.median) {
    for (const l of data.lines) if (l !== best) lines.push({ id: l.filmId, role: "context", values: l.values });
    if (best) lines.push({ id: best.filmId, role: "highlight", values: best.values, tag: `${filmNo(best.number)} · ${fmtInt(best.values[days]!)}` });
    lines.push({ id: "median", role: "median", values: data.median, tag: `${m.median} ${fmtInt(data.median[days]!)}` });
  } else {
    for (const l of data.lines) lines.push({ id: l.filmId, role: "median", values: l.values, tag: data.lines.length === 1 ? filmNo(l.number) : undefined });
  }

  const readout: Readout[] = Array.from({ length: days + 1 }, (_, d) => {
    const rows: Readout["rows"] = [];
    if (data.median?.[d] !== undefined) rows.push({ name: m.median, value: fmtInt(data.median[d]!) });
    if (best?.values[d] !== undefined) rows.push({ name: filmNo(best.number), value: fmtInt(best.values[d]!) });
    if (!best && data.lines.length === 1 && data.lines[0]!.values[d] !== undefined)
      rows.push({ name: filmNo(data.lines[0]!.number), value: fmtInt(data.lines[0]!.values[d]!) });
    rows.push({ name: m.videos, value: fmtInt(data.lines.filter((l) => l.values[d] !== undefined).length) });
    return { title: m.dayN(d), rows };
  });

  const label = !data.lines.length
    ? `${name}: ${m.noStarts}.`
    : `${name}: cumulative views in the first ${days} days after publishing, ${count(data.lines.length, "video", "videos")}.` +
      (data.median ? ` Median on day ${days}: ${fmtInt(data.median[days]!)}.` : "") +
      (best ? ` Best start: video ${filmNo(best.number)}, ${fmtInt(best.values[days]!)} views.` : "");

  return (
    <figure>
      <h3 className="chart-h">
        {name}
        <span>{count(data.lines.length, "video", "videos")}</span>
      </h3>
      <LineChart
        name={name}
        label={label}
        lines={lines}
        count={days + 1}
        yTicks={yTicks}
        xLabels={[`${m.day.toLowerCase()} 0`, String(Math.round(days / 2)), String(days)]}
        readout={readout}
        empty={m.noStarts}
        xName={m.day}
      />
    </figure>
  );
}
