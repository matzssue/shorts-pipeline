import Link from "next/link";
import { count, filmNo, fmtDay, fmtInt, fmtPct, fmtSpan } from "@/charts/format";
import { ticks } from "@/charts/scale";
import { Legend } from "@/components/charts/Legend";
import { Meter } from "@/components/charts/Meter";
import { RangeDots } from "@/components/charts/RangeDots";
import { Ranking } from "@/components/charts/Ranking";
import { StartChart } from "@/components/charts/StartChart";
import { TableTwin } from "@/components/charts/TableTwin";
import {
  accounts,
  durations,
  inRange,
  isPublished,
  lead,
  nearMinimum,
  notes,
  qaFlags,
  recent,
  stages,
  type Lead,
  type MeasurementNote,
  type OverviewInput,
  type OvFilm,
  type Range,
} from "@/data/selectors/overview";
import { starts } from "@/data/selectors/starts";
import { messages } from "@/lib/messages.en";
import { timecode } from "@shorts/timeline";
import { QaWord, SectionHead, Thumb } from "./bits";
import { RangeRuler } from "./RangeRuler";

const o = messages.overview;
const FPS = 30;

/** The opening sentence: the numbers that matter, one of them highlighted. Written by hand, filled from data. */
export function LeadSentence({ l }: { l: Lead }) {
  const span = fmtSpan(l.days);
  const qa =
    l.qaFailed === 0 ? null : l.qaFailed === 1 ? " One video failed QA and waits for a new render." : ` ${l.qaFailed} videos failed QA and wait for a new render.`;
  if (!l.published)
    return (
      <p className="lead" data-testid="lead">
        In {span} nothing was published.{" "}
        {l.made ? (
          <>
            The pipeline made <b>{count(l.made, "video", "videos")}</b> in this time.
          </>
        ) : null}
        {qa}
      </p>
    );
  return (
    <p className="lead" data-testid="lead">
      In {span} the pipeline made <b>{count(l.made, "video", "videos")}</b>
      {l.season ? ` from ${count(l.cards, "card", "cards")}` : ""} and published <b>{fmtInt(l.published)}</b> of them on {count(l.channels, "channel", "channels")}.{" "}
      {l.published === 1 ? (
        <>
          It gathered <mark>{count(l.totalViews, "view", "views")}</mark>.
        </>
      ) : (
        <>
          They gathered <mark>{count(l.totalViews, "view", "views")}</mark>
          {"; half of the videos have fewer than "}
          <b>{fmtInt(l.medianViews)}</b>.
        </>
      )}{" "}
      {l.avgViewPercent !== undefined ? (
        <>
          On YouTube a viewer watches <b>{fmtPct(l.avgViewPercent)}</b> of a video on average.
        </>
      ) : (
        "The share watched on YouTube is not in yet."
      )}
      {qa}
    </p>
  );
}

function noteText(n: MeasurementNote): string {
  if (n.kind === "snapshot") return n.text ?? "";
  if (n.kind === "noApi") return o.note.noApi();
  return o.note[n.kind](count(n.count ?? 0, "video", "videos"));
}

function releaseWord(f: OvFilm): string {
  if (f.published) return fmtDay(f.published);
  const h = o.stages.held;
  return { scripted: h.narration, narrated: h.render, rendered: h.qaMissing, qaFailed: h.qaError, qaPassed: h.publish, published: "" }[f.stage];
}

const dash = <span className="mute">–</span>;
const platformCell = (f: OvFilm, p: "youtube" | "instagram") => {
  const v = p === "youtube" ? f.yt?.views : f.ig?.views;
  if (v !== undefined) return fmtInt(v);
  if (f.queued.includes(p)) return <span className="mute">{o.recent.queued}</span>;
  return dash;
};

export function OverviewView({
  input,
  range,
  href,
  onChange,
  ready = true,
}: {
  input: OverviewInput;
  range: Range;
  href?: (r: Range) => string;
  onChange?: (r: Range) => void;
  /** False in the static HTML: the range controls are drawn but inert, and hidden when JavaScript is off. */
  ready?: boolean;
}) {
  const films = input.films.filter(inRange(range));
  const l = lead(input, films, range);
  const st = stages(input, films);
  const ns = notes(input, films);
  const live = films.filter(isPublished);
  const yt = starts(live, "youtube");
  const ig = starts(live, "instagram");
  const yTicks = ticks(0, Math.max(yt.max, ig.max), 3);
  const best = yt.best ?? ig.best;
  const rec = recent(films);
  const dur = durations(films);
  const near = nearMinimum(dur);
  const flags = qaFlags(films);
  const acc = accounts(input, films);
  const maxStage = Math.max(1, ...st.map((s) => s.count));

  return (
    <>
      <RangeRuler input={input} range={range} films={films} href={href} onChange={onChange} ready={ready} />

      <div className="page">
        <section className="lead-sec" aria-label="Summary">
          <LeadSentence l={l} />
          <div className="notes">
            <span className="lab">{o.notesTitle}</span>
            {ns.length ? (
              <ul>
                {ns.map((n, i) => (
                  <li key={i}>
                    <span>{n.platform}</span>
                    <span>{noteText(n)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pt-1.5 text-[0.8125rem] text-ink-2">{o.noNotes}</p>
            )}
          </div>
        </section>

        <section className="sec" data-testid="stages">
          <SectionHead title={o.stages.title} note={o.stages.note} />
          <ol className="stages">
            {st.map((s) => (
              <li key={s.key}>
                <span className="lab">{o.stages.items[s.key].label}</span>
                <span className="st-n">{fmtInt(s.count)}</span>
                <span className="st-bar" style={{ width: `${(s.count / maxStage) * 100}%` }} aria-hidden="true" />
                <span className="st-note">{o.stages.items[s.key].note}</span>
                {s.held.map((h) => (
                  <span key={h.film.id} className="st-held">
                    <span className={h.reason === "qaError" ? "lv lv-err" : "lv lv-warn"}>{o.stages.held[h.reason]}</span>
                    {filmNo(h.film.number)} “{h.film.title}”
                  </span>
                ))}
              </li>
            ))}
          </ol>
        </section>

        <section className="sec" data-testid="starts">
          <SectionHead title={o.starts.title} note={o.starts.note} />
          <div className="grid grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-2">
            <StartChart data={yt} yTicks={yTicks} />
            <StartChart data={ig} yTicks={yTicks} />
          </div>
          <Legend
            items={[
              { key: "median", text: messages.charts.medianOf(yt.days) },
              { key: "context", text: messages.charts.single },
              ...(best ? [{ key: "highlight" as const, text: messages.charts.best(filmNo(best.number), best.title) }] : []),
            ]}
          />
          <TableTwin
            caption="Cumulative views by day since publishing: median and best start per platform"
            columns={[{ head: messages.charts.day }, { head: "YT median", num: true }, { head: "YT best", num: true }, { head: "IG median", num: true }, { head: "IG best", num: true }]}
            rows={Array.from({ length: yt.days + 1 }, (_, d) => {
              const v = (x: number | undefined) => (x === undefined ? "–" : fmtInt(x));
              return [d, v(yt.median?.[d]), v(yt.best?.values[d]), v(ig.median?.[d]), v(ig.best?.values[d])];
            })}
          />
        </section>

        <section className="sec films-wrap" data-testid="recent">
          <SectionHead title={o.recent.title} note={o.recent.note(rec.length, films.length)} />
          {rec.length ? (
            <>
              <table className="tbl films-t">
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="sr-only">{o.recent.cols.frame}</span>
                    </th>
                    <th scope="col">{o.recent.cols.video}</th>
                    <th scope="col">{o.recent.cols.release}</th>
                    <th scope="col">{o.recent.cols.format}</th>
                    <th scope="col">{o.recent.cols.length}</th>
                    <th scope="col">{o.recent.cols.qa}</th>
                    <th scope="col" className="r">
                      {o.recent.cols.yt}
                    </th>
                    <th scope="col" className="r">
                      {o.recent.cols.ig}
                    </th>
                    <th scope="col" className="r">
                      {o.recent.cols.watched}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rec.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <Thumb film={f} />
                      </td>
                      <td>
                        <Link className="f-title" href={`/films/${f.id}/`}>
                          {f.title}
                        </Link>
                        <span className="f-id">{f.folder}</span>
                      </td>
                      <td className="n">{f.published ? fmtDay(f.published) : <span className="mute">{releaseWord(f)}</span>}</td>
                      <td className="n">
                        {f.format} · S{f.series}
                      </td>
                      <td className="n">{f.durationS !== undefined ? timecode(Math.round(f.durationS * FPS), FPS) : dash}</td>
                      <td>
                        <QaWord film={f} />
                      </td>
                      <td className="n r">{platformCell(f, "youtube")}</td>
                      <td className="n r">{platformCell(f, "instagram")}</td>
                      <td className="r">
                        {f.yt?.avgViewPercent !== undefined ? <Meter value={f.yt.avgViewPercent} label={`${filmNo(f.number)}: share watched on YouTube`} /> : dash}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ol className="films-c">
                {rec.map((f) => (
                  <li key={f.id}>
                    <Thumb film={f} />
                    <Link className="f-title" href={`/films/${f.id}/`}>
                          {f.title}
                        </Link>
                    <QaWord film={f} />
                    <span className="m">
                      {[
                        releaseWord(f),
                        `${f.format} · S${f.series}`,
                        f.durationS !== undefined ? timecode(Math.round(f.durationS * FPS), FPS) : null,
                        f.yt?.views !== undefined ? `YT ${fmtInt(f.yt.views)}` : null,
                        f.ig?.views !== undefined ? `IG ${fmtInt(f.ig.views)}` : null,
                        f.yt?.avgViewPercent !== undefined ? `${fmtPct(f.yt.avgViewPercent)} watched` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="text-ink-2">{o.recent.empty}</p>
          )}
          <Link className="more" href="/films/">
            {o.recent.all(input.films.length)}
          </Link>
        </section>

        <div className="trio">
          <section className="sec" data-testid="durations">
            <SectionHead title={o.durations.title} note={o.durations.note} />
            <RangeDots
              rows={dur.map((r) => ({
                key: r.format,
                name: messages.formats[r.format],
                range: r.range,
                points: r.films.map((x) => ({ id: x.film.id, label: `${filmNo(x.film.number)} ${x.film.title}`, value: x.seconds })),
              }))}
              unit="s"
            />
            <p className="foot-note">{near.total ? (near.near ? o.durations.near(near.near, near.total) : null) : o.durations.none}</p>
          </section>

          <section className="sec" data-testid="qa">
            <SectionHead title={o.qa.title} note={o.qa.note(fmtInt(l.made))} />
            {flags.length ? (
              <Ranking
                items={flags.map((f) => ({
                  key: f.text,
                  label: (
                    <>
                      {f.level === "error" ? <span className="lv lv-err mr-1.5">{messages.status.error}</span> : null}
                      {f.text}
                    </>
                  ),
                  value: f.count,
                }))}
              />
            ) : (
              <p className="text-[0.8125rem] text-ink-2">{o.qa.none}</p>
            )}
          </section>

          <section className="sec" data-testid="accounts">
            <SectionHead title={o.accounts.title} note={o.accounts.note} />
            <table className="tbl wrap-h">
              <thead>
                <tr>
                  <th scope="col">{o.accounts.cols.account}</th>
                  <th scope="col" className="r">
                    {o.accounts.cols.followers}
                  </th>
                  <th scope="col" className="r">
                    {o.accounts.cols.growth}
                  </th>
                  <th scope="col" className="r">
                    {o.accounts.cols.videos}
                  </th>
                  <th scope="col" className="r">
                    {o.accounts.cols.views}
                  </th>
                </tr>
              </thead>
              <tbody>
                {acc.map((a) => (
                  <tr key={`${a.channel}-${a.platform}`}>
                    <th scope="row">
                      {a.channel.toUpperCase()} · {a.platform === "youtube" ? "YouTube" : "Instagram"}
                    </th>
                    <td className="r">{a.followers !== undefined ? fmtInt(a.followers) : "–"}</td>
                    <td className="r">{a.followers !== undefined && a.first !== undefined ? `${a.followers >= a.first ? "+" : "−"}${fmtInt(Math.abs(a.followers - a.first))}` : "–"}</td>
                    <td className="r">{fmtInt(a.films)}</td>
                    <td className="r">{fmtInt(a.views)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="foot-note">{o.accounts.foot(input.channels.map((c) => `${c.id.toUpperCase()} is ${c.name}`).join(", "))}</p>
          </section>
        </div>
      </div>
    </>
  );
}
