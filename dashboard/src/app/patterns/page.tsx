import type { Metadata } from "next";
import type { ReactNode } from "react";
import { filmNo, fmtInt, fmtPct, fmtSec } from "@/charts/format";
import { ticks } from "@/charts/scale";
import { Legend } from "@/components/charts/Legend";
import { LimitMeter, Meter } from "@/components/charts/Meter";
import { RangeDots, type RangeRow } from "@/components/charts/RangeDots";
import { Ranking } from "@/components/charts/Ranking";
import { StartChart } from "@/components/charts/StartChart";
import { TableTwin } from "@/components/charts/TableTwin";
import { getData } from "@/data";
import { filmViews } from "@/data/join";
import { starts } from "@/data/selectors/starts";
import { messages } from "@/lib/messages.en";
import { FORMAT_DURATION_S, FORMATS } from "@shorts/schema";

const p = messages.patterns;
const c = messages.charts;

export const metadata: Metadata = { title: p.title };

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="sec">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-5 gap-y-0.5">
        <h2 className="text-[1.75rem] leading-[1.15] font-extrabold">{title}</h2>
        <p className="font-mono text-xs leading-[1.4] text-ink-3">{note}</p>
      </header>
      {children}
    </section>
  );
}

const monthName = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export default function PatternsPage() {
  const { catalog, films } = getData();

  // line: two small multiples on one shared scale
  const yt = starts(films, "youtube");
  const ig = starts(films, "instagram");
  const yTicks = ticks(0, Math.max(yt.max, ig.max), 3);
  const days = yt.days;
  const best = yt.best ?? ig.best;
  const dash = (v: number | undefined) => (v === undefined ? "–" : fmtInt(v));

  // band with points: rendered length against the allowed range of each format
  const rows: RangeRow[] = FORMATS.map((f) => ({
    key: f,
    name: messages.formats[f],
    range: FORMAT_DURATION_S[f],
    points: films
      .filter((x) => x.format === f && x.durationS !== undefined)
      .map((x) => ({ id: x.id, label: `${filmNo(x.number)} ${x.title}`, value: x.durationS! })),
  }));

  // ranking: top eight by views
  const top = films
    .filter((f) => filmViews(f) > 0)
    .sort((a, b) => filmViews(b) - filmViews(a))
    .slice(0, 8);

  // meters
  const watched = films.filter((f) => f.latest.youtube?.avgViewPercent !== undefined).slice(-5);
  const months = new Map<string, number>();
  for (const r of catalog.ledger) months.set(r.date.slice(0, 7), (months.get(r.date.slice(0, 7)) ?? 0) + r.chars);
  const [month, used] = [...months].sort((a, b) => b[0].localeCompare(a[0]))[0] ?? ["2026-01", 0];

  // edge cases: the same chart with nothing in range and with one video
  const empty = starts([], "youtube");
  const one = starts(
    films.filter((f) => f.id === best?.filmId),
    "youtube",
  );

  return (
    <div className="page">
      <section className="sec">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-5 gap-y-0.5">
          <h1 className="text-[1.75rem] leading-[1.15] font-extrabold">{p.title}</h1>
          <p className="font-mono text-xs leading-[1.4] text-ink-3">{p.note}</p>
        </div>
        <p className="max-w-[68ch] text-ink-2">{p.intro}</p>
      </section>

      <Section title={p.line.title} note={p.line.note}>
        <div className="grid grid-cols-1 gap-x-5 gap-y-8 md:grid-cols-2">
          <StartChart data={yt} yTicks={yTicks} />
          <StartChart data={ig} yTicks={yTicks} />
        </div>
        <Legend
          items={[
            { key: "median", text: c.medianOf(days) },
            { key: "context", text: c.single },
            ...(best ? [{ key: "highlight" as const, text: c.best(filmNo(best.number), best.title) }] : []),
          ]}
        />
        <TableTwin
          caption={`Cumulative views by day since publishing, median and best start (video ${best ? filmNo(best.number) : "–"})`}
          columns={[{ head: c.day }, { head: "YT median", num: true }, { head: "YT best", num: true }, { head: "IG median", num: true }, { head: "IG best", num: true }]}
          rows={Array.from({ length: days + 1 }, (_, d) => [
            d,
            dash(yt.median?.[d]),
            dash(yt.best?.values[d]),
            dash(ig.median?.[d]),
            dash(ig.best?.values[d]),
          ])}
        />
      </Section>

      <Section title={p.band.title} note={p.band.note}>
        <RangeDots rows={rows} unit="s" />
        <Legend
          items={[
            { key: "band", text: "allowed length" },
            { key: "dot", text: "one video; hollow when outside the range" },
          ]}
        />
        <TableTwin
          caption="Length of each rendered video and the allowed range of its format"
          columns={[{ head: "Video" }, { head: "Format" }, { head: "Allowed", num: true }, { head: "Length", num: true }]}
          rows={rows.flatMap((r) => r.points.map((pt) => [pt.label, r.key, `${r.range[0]}–${r.range[1]} s`, fmtSec(pt.value)]))}
        />
      </Section>

      <div className="grid grid-cols-1 gap-x-5 md:grid-cols-2">
        <Section title={p.rank.title} note={p.rank.note}>
          <Ranking items={top.map((f) => ({ key: f.id, label: `${filmNo(f.number)} ${f.title}`, value: filmViews(f) }))} />
        </Section>

        <Section title={p.meter.title} note={p.meter.note}>
          <table className="tbl">
            <caption>{p.meterTable}</caption>
            <thead>
              <tr>
                <th scope="col">Video</th>
                <th scope="col" className="r">
                  Watched
                </th>
              </tr>
            </thead>
            <tbody>
              {watched.map((f) => (
                <tr key={f.id}>
                  <th scope="row">{`${filmNo(f.number)} ${f.title}`}</th>
                  <td className="r">
                    <Meter value={f.latest.youtube!.avgViewPercent!} label={`${filmNo(f.number)}: share watched`} text={fmtPct(f.latest.youtube!.avgViewPercent!)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-8 grid gap-6">
            <LimitMeter used={used} limit={Math.ceil((used * 1.6) / 1000) * 1000} unit="characters" label={p.limitLabel(monthName(month))} />
            <LimitMeter used={used} limit={Math.floor((used * 0.8) / 1000) * 1000} unit="characters" label={`${p.limitLabel(monthName(month))}, lower limit`} />
          </div>
          <p className="mt-3 text-[0.8125rem] text-ink-2">{p.limitNote}</p>
        </Section>
      </div>

      <Section title={p.edge.title} note={p.edge.note}>
        <div className="grid grid-cols-1 gap-x-5 gap-y-8 md:grid-cols-2">
          <StartChart data={empty} yTicks={yTicks} />
          <StartChart data={one} yTicks={ticks(0, one.max, 3)} />
        </div>
      </Section>
    </div>
  );
}
