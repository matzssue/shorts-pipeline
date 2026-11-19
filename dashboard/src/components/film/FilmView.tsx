import Link from "next/link";
import { timecode } from "@shorts/timeline";
import { LineChart, type Line } from "@/components/charts/LineChart";
import { Legend } from "@/components/charts/Legend";
import { fmtDay, fmtInt, fmtPct, filmNo } from "@/charts/format";
import { ticks } from "@/charts/scale";
import { QaWord, SectionHead } from "@/components/overview/bits";
import type { FilmPage } from "@/data/selectors/film";
import type { Starts } from "@/data/selectors/starts";
import { messages } from "@/lib/messages.en";
import { Bench, EditList } from "./Bench";

const m = messages.film;
const PLATFORM: Record<string, string> = { youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok" };
const CHART_NAME = { youtube: "YouTube Shorts", instagram: "Instagram Reels" } as const;

export function FilmView({ f }: { f: FilmPage }) {
  const s = m.slate;
  const live = f.releases.filter((r) => r.status === "published" && r.link);
  const first = live.map((r) => r.date).sort()[0];
  const yt = f.releases.find((r) => r.platform === "youtube")?.views;
  const ig = f.releases.find((r) => r.platform === "instagram")?.views;
  const flagged = f.qa?.groups.flatMap((g) => g.checks).filter((c) => c.level !== "ok") ?? [];
  const qaSummary = f.qa && {
    passed: f.qa.passed,
    warnings: flagged.filter((c) => c.level === "warning").length,
    errors: flagged.filter((c) => c.level === "error").length,
  };

  return (
    <article data-testid="film">
      <div className="page">
        <p className="crumb">
          <Link href="/films/">{m.crumb}</Link> / <span>{f.folder}</span>
        </p>
        <h1 className="film-h1">{f.title}</h1>
        <dl className="slate" data-testid="slate">
          <div>
            <dt className="lab">{s.no}</dt>
            <dd className="big">{filmNo(f.number)}</dd>
          </div>
          <div>
            <dt className="lab">{s.format}</dt>
            <dd>
              {f.format} · {messages.formats[f.format as keyof typeof messages.formats] ?? ""}
              <small>{s.range(f.formatRange[0], f.formatRange[1])}</small>
            </dd>
          </div>
          <div>
            <dt className="lab">{s.series}</dt>
            <dd>
              {f.series} · {f.seriesTitle}
              <small>{f.channelName ?? "–"}</small>
            </dd>
          </div>
          <div>
            <dt className="lab">{s.narrator}</dt>
            <dd>
              {f.narratorName ?? "–"}
              <small>{f.model ?? "–"}</small>
            </dd>
          </div>
          <div>
            <dt className="lab">{s.length}</dt>
            <dd className="big">{f.timeline ? timecode(f.timeline.frames, f.timeline.fps) : "–"}</dd>
          </div>
          <div>
            <dt className="lab">{s.frames}</dt>
            <dd>
              {f.timeline ? s.framesAt(fmtInt(f.timeline.frames), f.timeline.fps) : s.noRender}
              {f.timeline ? <small>{`${f.timeline.width}×${f.timeline.height}`}</small> : null}
            </dd>
          </div>
          <div>
            <dt className="lab">{s.narration}</dt>
            <dd>
              {f.voice.chars ? s.chars(fmtInt(f.voice.chars)) : "–"}
              <small>{[f.voice.takes ? s.takes(f.voice.takes) : "", f.voice.cached ? s.cached(f.voice.cached) : ""].filter(Boolean).join(" · ") || " "}</small>
            </dd>
          </div>
          <div>
            <dt className="lab">{s.qa}</dt>
            <dd>
              <QaWord film={{ qa: qaSummary }} />
            </dd>
          </div>
          <div>
            <dt className="lab">{s.released}</dt>
            <dd>
              {first ? fmtDay(first, true) : s.notYet}
              <small>{live.map((r) => PLATFORM[r.platform] ?? r.platform).join(", ") || " "}</small>
            </dd>
          </div>
          <div>
            <dt className="lab">{s.views}</dt>
            <dd>
              {yt === undefined && ig === undefined ? "–" : fmtInt((yt ?? 0) + (ig ?? 0))}
              <small>{[yt !== undefined ? `YT ${fmtInt(yt)}` : "", ig !== undefined ? `IG ${fmtInt(ig)}` : ""].filter(Boolean).join(" · ") || " "}</small>
            </dd>
          </div>
        </dl>
      </div>

      <div className="page">
        {f.timeline ? (
          <Bench tl={f.timeline} edl={f.edl} avgViewSeconds={f.avgViewSeconds} />
        ) : (
          <>
            <section className="sec" data-testid="timeline">
              <SectionHead title={m.timeline.title} />
              <p className="empty-note">{m.timeline.none}</p>
            </section>
            <section className="sec" data-testid="edl">
              <SectionHead title={m.edl.title} note={m.edl.note(f.edl.length, 16)} />
              <EditList edl={f.edl} fps={30} />
            </section>
          </>
        )}

        <Qa f={f} />
        <Releases f={f} />
        <Voice f={f} />
        <Facts f={f} />

        <nav className="film-nav" aria-label="Other videos">
          {f.prev ? (
            <Link href={`/films/${f.prev.id}/`} rel="prev">
              <span className="lab">{m.prev}</span>
              {f.prev.title}
            </Link>
          ) : (
            <span />
          )}
          {f.next ? (
            <Link href={`/films/${f.next.id}/`} rel="next" className="nx">
              <span className="lab">{m.next}</span>
              {f.next.title}
            </Link>
          ) : null}
        </nav>
      </div>
    </article>
  );
}

function Qa({ f }: { f: FilmPage }) {
  const q = m.qa;
  if (!f.qa)
    return (
      <section className="sec" data-testid="qa">
        <SectionHead title={q.title} />
        <p className="empty-note">{q.none}</p>
      </section>
    );
  const all = f.qa.groups.flatMap((g) => g.checks);
  const warnings = all.filter((c) => c.level === "warning").length;
  const errors = all.filter((c) => c.level === "error").length;
  return (
    <section className="sec" data-testid="qa">
      <SectionHead title={q.title} note={q.note} />
      <div className="qa">
        <div>
          <p className="qa-verdict">{q.verdict(f.qa.passed, warnings, errors)}</p>
          <span className="num">{q.checks(all.length)}</span>
          {f.qa.groups.map((g) => (
            <div key={g.key} className="qa-g">
              <h3 className="lab">{q.groups[g.key]}</h3>
              <ul>
                {g.checks.map((c, i) => (
                  <li key={i} className={`is-${c.level}`}>
                    <span className={c.level === "ok" ? "lv lv-ok" : c.level === "warning" ? "lv lv-warn" : "lv lv-err"}>{q.levels[c.level]}</span>
                    <span>{c.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {f.qa.manual.length ? (
          <div>
            <h3 className="man-h">{q.manual}</h3>
            <ul className="man">
              {f.qa.manual.map((x) => (
                <li key={x}>
                  <i aria-hidden="true" />
                  {x}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function FilmStart({ data, filmId, number, yTicks }: { data: Starts; filmId: string; number: number; yTicks: number[] }) {
  const r = m.releases;
  const name = CHART_NAME[data.platform];
  const own = data.lines.find((l) => l.filmId === filmId);
  const lines: Line[] = data.lines.filter((l) => l !== own).map((l) => ({ id: l.filmId, role: "context", values: l.values }));
  if (data.median) lines.push({ id: "median", role: "median", values: data.median });
  const lastOwn = own ? [...own.values].reverse().find((v) => v !== undefined) : undefined;
  if (own) lines.push({ id: own.filmId, role: "highlight", values: own.values, tag: filmNo(number) });
  const med = data.median?.[data.days];
  return (
    <figure>
      <h3 className="chart-h">{name}</h3>
      {own ? (
        <LineChart
          name={name}
          label={r.startLabel(name, filmNo(number), lastOwn === undefined ? undefined : fmtInt(lastOwn), med === undefined ? undefined : fmtInt(med), data.days)}
          lines={lines}
          count={data.days + 1}
          yTicks={yTicks}
          xLabels={[`${messages.charts.day.toLowerCase()} 0`, String(Math.round(data.days / 2)), String(data.days)]}
          xName={messages.charts.day}
        />
      ) : (
        <p className="empty-note">{r.noStart}</p>
      )}
    </figure>
  );
}

function Releases({ f }: { f: FilmPage }) {
  const r = m.releases;
  const c = r.cols;
  const { youtube, instagram } = f.starts;
  const max = Math.max(youtube.max, instagram.max);
  const yTicks = ticks(0, max);
  const any = [youtube, instagram].some((d) => d.lines.some((l) => l.filmId === f.id));
  return (
    <section className="sec" data-testid="releases">
      <SectionHead title={r.title} note={r.note} />
      {f.releases.length ? (
        <div className="tbl-scroll" tabIndex={0} role="region" aria-label={r.title}>
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">{c.platform}</th>
                <th scope="col">{c.date}</th>
                <th scope="col">{c.status}</th>
                <th scope="col">{c.link}</th>
                <th scope="col" className="r">
                  {c.views}
                </th>
                <th scope="col" className="r">
                  {c.likes}
                </th>
                <th scope="col" className="r">
                  {c.comments}
                </th>
                <th scope="col" className="r">
                  {c.watched}
                </th>
              </tr>
            </thead>
            <tbody>
              {f.releases.map((x) => (
                <tr key={x.platform}>
                  <th scope="row">{PLATFORM[x.platform] ?? x.platform}</th>
                  <td className="num">{fmtDay(x.date, true)}</td>
                  <td className="num">{x.status}</td>
                  <td className="num link">{x.link ? <span>{x.link.replace(/^https?:\/\//, "")}</span> : "–"}</td>
                  <td className="num r">{x.views === undefined ? "–" : fmtInt(x.views)}</td>
                  <td className="num r">{x.likes === undefined ? "–" : fmtInt(x.likes)}</td>
                  <td className="num r">{x.comments === undefined ? "–" : fmtInt(x.comments)}</td>
                  <td className="num r">{x.avgViewPercent === undefined ? "–" : fmtPct(x.avgViewPercent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty-note">{r.none}</p>
      )}
      {any ? (
        <>
          <div className="mt-6 grid grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-2">
            <FilmStart data={youtube} filmId={f.id} number={f.number} yTicks={yTicks} />
            <FilmStart data={instagram} filmId={f.id} number={f.number} yTicks={yTicks} />
          </div>
          <Legend
            items={[
              { key: "highlight", text: r.thisVideo },
              { key: "median", text: messages.charts.medianOf(youtube.days) },
              { key: "context", text: messages.charts.single },
            ]}
          />
        </>
      ) : null}
    </section>
  );
}

function Voice({ f }: { f: FilmPage }) {
  const v = m.voice;
  return (
    <section className="sec" data-testid="voice">
      <SectionHead title={v.title} note={v.note} />
      {f.voice.rows.length ? (
        <>
          <dl className="facts-row">
            <div>
              <dt className="lab">{v.chars}</dt>
              <dd className="big">{fmtInt(f.voice.chars)}</dd>
            </div>
            <div>
              <dt className="lab">{v.full}</dt>
              <dd className="big">{f.voice.full}</dd>
            </div>
            <div>
              <dt className="lab">{v.takes}</dt>
              <dd className="big">{f.voice.takes}</dd>
            </div>
            <div>
              <dt className="lab">{v.cached}</dt>
              <dd className="big">{f.voice.cached}</dd>
            </div>
            <div>
              <dt className="lab">{v.model}</dt>
              <dd className="num">{f.model ?? "–"}</dd>
            </div>
          </dl>
          <div className="tbl-scroll" tabIndex={0} role="region" aria-label={v.title}>
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">{v.cols.date}</th>
                  <th scope="col">{v.cols.kind}</th>
                  <th scope="col" className="r">
                    {v.cols.scene}
                  </th>
                  <th scope="col" className="r">
                    {v.cols.chars}
                  </th>
                  <th scope="col">{v.cols.model}</th>
                </tr>
              </thead>
              <tbody>
                {f.voice.rows.map((x, i) => (
                  <tr key={i}>
                    <td className="num">{fmtDay(x.date, true)}</td>
                    <td className="num">{v.kinds[x.kind as keyof typeof v.kinds] ?? x.kind}</td>
                    <td className="num r">{x.scene === undefined ? "–" : x.scene + 1}</td>
                    <td className="num r">{fmtInt(x.chars)}</td>
                    <td className="num">{x.model}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="empty-note">{v.none}</p>
      )}
    </section>
  );
}

function Facts({ f }: { f: FilmPage }) {
  const x = m.facts;
  const claims = f.edl.flatMap((r) => r.claims.map((c) => ({ ...c, scene: r.index })));
  return (
    <section className="sec" data-testid="facts">
      <SectionHead title={x.title} note={x.note} />
      <div className="facts">
        <div>
          {claims.length ? (
            <ol className="claims">
              {claims.map((c, i) => (
                <li key={i}>
                  <span className="lab">{`${x.scene(c.scene + 1)} · ${c.source}`}</span>
                  <p>
                    <span className="sr-only">{x.claim}: </span>
                    {c.text}
                  </p>
                  {c.fact ? (
                    <p className="fact">
                      <span className="sr-only">{x.fact}: </span>
                      {c.fact.text}
                      <span className="num">
                        {c.fact.sourceName} · {x.checked(fmtDay(c.fact.checkedAt, true))}
                      </span>
                    </p>
                  ) : (
                    <p className="fact missing">{x.missing}</p>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="empty-note">{x.none}</p>
          )}
        </div>
        <div>
          <h3 className="lab">{x.angle}</h3>
          <p className="desc">{f.angle}</p>
          <h3 className="lab">{x.caption}</h3>
          <p className="desc">{f.caption}</p>
          <h3 className="lab">{x.hashtags}</h3>
          <p className="num tags">{f.hashtags.join(" ")}</p>
        </div>
      </div>
    </section>
  );
}
