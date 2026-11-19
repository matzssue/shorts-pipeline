import Link from "next/link";
import { FLOW_CREDITS_PER_S_720P } from "@shorts/schema/video";
import { count, filmNo, fmtDec, fmtInt, fmtPct } from "@/charts/format";
import { pct } from "@/charts/scale";
import { Kpis } from "@/components/charts/Kpis";
import { LimitMeter } from "@/components/charts/Meter";
import { TableTwin } from "@/components/charts/TableTwin";
import { SectionHead } from "@/components/overview/bits";
import type { CostsPage } from "@/data/selectors/costs";
import { messages } from "@/lib/messages.en";

const m = messages.costs;
const monthName = (ym: string) => new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${ym}-01T00:00:00Z`));

export function CostsView({ d }: { d: CostsPage }) {
  const avg = d.narrated ? d.total / d.narrated : 0;
  const share = d.total ? (d.takes / d.total) * 100 : 0;
  const max = Math.max(1, ...d.perFilm.map((f) => f.full + f.takes));
  const made = d.credits.filter((c) => c.made);
  const credits = made.reduce((s, c) => s + c.credits, 0);
  const n = m.narrators.cols;

  return (
    <div className="page">
      <div className="view-head">
        <SectionHead title={messages.views.costs.title} note={messages.views.costs.note} level={1} />
      </div>
      <Kpis
        label={m.kpi.label}
        items={[
          { key: "chars", label: m.kpi.chars, value: fmtInt(d.total), sub: m.kpi.charsSub(count(d.narrated, "video", "videos")), hl: true },
          { key: "perVideo", label: m.kpi.perVideo, value: fmtInt(Math.round(avg)), sub: m.kpi.perVideoSub },
          { key: "retakes", label: m.kpi.retakes, value: fmtPct(share), sub: m.kpi.retakesSub },
          { key: "credits", label: m.kpi.credits, value: fmtInt(credits), sub: m.kpi.creditsSub(count(made.length, "rendered video", "rendered videos")) },
        ]}
      />

      <section className="sec" data-testid="per-film">
        <SectionHead title={m.perFilm.title} note={m.perFilm.note} />
        <ol className="cbars">
          {d.perFilm.map((f) => (
            <li key={f.id}>
              <Link className="t" href={`/films/${f.id}/`}>
                <span className="num">{filmNo(f.number)}</span> {f.title}
              </Link>
              <span className="b" aria-hidden="true">
                <i className="full" style={{ width: pct((f.full / max) * 78) }} />
                {f.takes ? <i className="takes" style={{ width: pct((f.takes / max) * 78) }} /> : null}
              </span>
              <span className="v num">
                {fmtInt(f.full + f.takes)}
                {f.takes ? <span className="mute">{` · ${fmtInt(f.takes)} ${m.perFilm.takes}`}</span> : null}
                {f.cached ? <span className="mute">{` · ${m.perFilm.cached(f.cached)}`}</span> : null}
              </span>
            </li>
          ))}
        </ol>
        <p className="cbars-legend">
          <span>
            <i className="full" aria-hidden="true" />
            {m.perFilm.full}
          </span>
          <span>
            <i className="takes" aria-hidden="true" />
            {m.perFilm.takes}
          </span>
        </p>
        <TableTwin
          caption={m.perFilm.caption}
          columns={[{ head: "Video" }, { head: m.perFilm.full, num: true }, { head: m.perFilm.takes, num: true }, { head: "Cache hits", num: true }, { head: "Total", num: true }]}
          rows={d.perFilm.map((f) => [`${filmNo(f.number)} ${f.title}`, fmtInt(f.full), fmtInt(f.takes), f.cached, fmtInt(f.full + f.takes)])}
        />
      </section>

      <div className="grid grid-cols-1 gap-x-5 md:grid-cols-2">
        <section className="sec" data-testid="limit">
          <SectionHead title={m.limit.title} note={m.limit.note} />
          {d.limit ? (
            <div className="grid gap-5">
              {d.months.map((x) => (
                <LimitMeter key={x.month} used={x.used} limit={d.limit!} unit="characters" label={m.limit.label(monthName(x.month))} />
              ))}
            </div>
          ) : (
            <p className="empty-note">{m.limit.none}</p>
          )}
        </section>

        <section className="sec" data-testid="narrators">
          <SectionHead title={m.narrators.title} note={m.narrators.note} />
          <div className="tbl-scroll" role="region" aria-label={m.narrators.title} tabIndex={0}>
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">{n.narrator}</th>
                  <th scope="col" className="r">
                    {n.videos}
                  </th>
                  <th scope="col" className="r">
                    {n.chars}
                  </th>
                  <th scope="col" className="r">
                    {n.perS}
                  </th>
                  <th scope="col" className="r">
                    {n.takes}
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.narrators.map((x) => (
                  <tr key={x.id}>
                    <th scope="row">
                      {x.name}
                      <span className="f-id">{x.model}</span>
                    </th>
                    <td className="num r">{x.videos}</td>
                    <td className="num r">{fmtInt(x.chars)}</td>
                    <td className="num r">{x.seconds ? fmtDec(x.chars / x.seconds) : "–"}</td>
                    <td className="num r">{x.takes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-x-5 md:grid-cols-2">
        <section className="sec" data-testid="credits">
          <SectionHead title={m.credits.title} note={m.credits.note(FLOW_CREDITS_PER_S_720P)} />
          <div className="tbl-scroll" role="region" aria-label={m.credits.title} tabIndex={0}>
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">{m.credits.cols.video}</th>
                  <th scope="col" className="r">
                    {m.credits.cols.seconds}
                  </th>
                  <th scope="col" className="r">
                    {m.credits.cols.credits}
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.credits.map((c) => (
                  <tr key={c.id}>
                    <th scope="row">
                      <Link href={`/films/${c.id}/`}>
                        <span className="num">{filmNo(c.number)}</span> {c.title}
                      </Link>
                    </th>
                    <td className="num r">{fmtDec(c.clipSeconds)}</td>
                    <td className="num r">{c.made ? fmtInt(c.credits) : <span className="mute">{m.credits.notYet}</span>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">{m.credits.total}</th>
                  <td className="num r">{fmtDec(made.reduce((s, c) => s + c.clipSeconds, 0))}</td>
                  <td className="num r">{fmtInt(credits)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="sec" data-testid="per-thousand">
          <SectionHead title={m.perThousand.title} note={m.perThousand.note} />
          <div className="tbl-scroll" role="region" aria-label={m.perThousand.title} tabIndex={0}>
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">{m.perThousand.cols.video}</th>
                  <th scope="col" className="r">
                    {m.perThousand.cols.chars}
                  </th>
                  <th scope="col" className="r">
                    {m.perThousand.cols.views}
                  </th>
                  <th scope="col" className="r" aria-sort="ascending">
                    {m.perThousand.cols.value}
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.perThousand.map((x) => (
                  <tr key={x.id}>
                    <th scope="row">
                      <Link href={`/films/${x.id}/`}>
                        <span className="num">{filmNo(x.number)}</span> {x.title}
                      </Link>
                    </th>
                    <td className="num r">{fmtInt(x.chars)}</td>
                    <td className="num r">{fmtInt(x.views)}</td>
                    <td className="num r">{fmtDec(x.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
