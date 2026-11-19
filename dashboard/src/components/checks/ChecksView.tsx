import Link from "next/link";
import { count, filmNo, fmtDay, fmtDec, fmtInt } from "@/charts/format";
import { pct } from "@/charts/scale";
import { Ranking } from "@/components/charts/Ranking";
import { TableTwin } from "@/components/charts/TableTwin";
import { SectionHead } from "@/components/overview/bits";
import type { ChecksPage, MatrixCell } from "@/data/selectors/checks";
import { messages } from "@/lib/messages.en";

const m = messages.checks;
const groups = messages.film.qa.groups;

export function ChecksView({ d }: { d: ChecksPage }) {
  const t = d.totals;
  return (
    <div className="page">
      <section className="lead-sec" aria-label="Summary">
        <div>
          <SectionHead title={messages.views.checks.title} note={messages.views.checks.note} level={1} />
          <p className="lead" data-testid="lead">
            QA checked <b>{count(t.checked, "video", "videos")}</b>: {fmtInt(t.clean)} pass every check, <b>{fmtInt(t.withWarnings)}</b> pass with warnings
            {t.failed ? (
              <>
                {" "}
                and <mark>{count(t.failed, "video is", "videos are")} held back</mark> by an error
              </>
            ) : null}
            .{t.notChecked ? ` ${count(t.notChecked, "video waits", "videos wait")} for a render before QA can run.` : ""}
          </p>
        </div>
      </section>

      <section className="sec" data-testid="matrix">
        <SectionHead title={m.matrix.title} note={m.matrix.note} />
        <Matrix d={d} />
        <p className="qm-legend">
          <span>
            <i className="qm qm-warning" aria-hidden="true" />
            {m.legend.warning}
          </span>
          <span>
            <i className="qm qm-error" aria-hidden="true" />
            {m.legend.error}
          </span>
          {d.rows.some((r) => d.columns.some((c) => c.always && !r.cells[c.key])) ? (
            <span>
              <i className="qm qm-none" aria-hidden="true">
                –
              </i>
              {m.legend.notRun}
            </span>
          ) : null}
          <span className="mute">empty: passed</span>
        </p>
        {d.unknown.length ? (
          <div className="mt-3 text-[0.8125rem]">
            <p>{m.matrix.unknown(d.unknown.length)}</p>
            <ul className="num">
              {d.unknown.map((u, i) => (
                <li key={i}>
                  {u.id}: {u.text}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <div className="grid grid-cols-1 gap-x-12 md:grid-cols-2">
        <section className="sec" data-testid="ranking">
          <SectionHead title={m.ranking.title} note={m.ranking.note} />
          {d.ranking.length ? (
            <Ranking
              items={d.ranking.map((r) => ({
                key: r.key,
                label: (
                  <>
                    {r.name}
                    {r.errors ? <span className="mute"> · {count(r.errors, "error", "errors")}</span> : null}
                  </>
                ),
                value: r.warnings + r.errors,
              }))}
            />
          ) : (
            <p className="empty-note">{m.ranking.none}</p>
          )}
        </section>

        <section className="sec" data-testid="weeks">
          <SectionHead title={m.weeks.title} note={m.weeks.note} />
          <Weeks d={d} />
        </section>
      </div>

      <section className="sec" data-testid="held">
        <SectionHead title={m.held.title} note={m.held.note} />
        {d.held.length ? (
          <ul className="held">
            {d.held.map((h) => (
              <li key={h.id}>
                <Link className="f-title" href={`/films/${h.id}/`}>
                  <span className="num">{filmNo(h.number)}</span> {h.title}
                </Link>
                <ul>
                  {h.errors.map((e) => (
                    <li key={e}>
                      <span className="lv lv-err">{messages.status.error}</span>
                      <span>{e}</span>
                    </li>
                  ))}
                  {h.warnings.map((e) => (
                    <li key={e}>
                      <span className="lv lv-warn">{m.matrix.warning}</span>
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-note">{m.held.none}</p>
        )}
      </section>
    </div>
  );
}

function Cell({ cell, check, video, g0, always }: { cell?: MatrixCell; check: string; video: string; g0: boolean; always: boolean }) {
  const cls = g0 ? "qc g0" : "qc";
  // A conditional check writes a message only when it finds something: no message means it passed.
  if (!cell && !always) cell = { level: "ok", texts: [] };
  if (!cell)
    return (
      <td className={cls}>
        <span className="qm qm-none" aria-hidden="true">
          –
        </span>
        <span className="sr-only">{m.matrix.notRun}</span>
      </td>
    );
  const word = cell.level === "ok" ? m.matrix.passed : cell.level === "warning" ? m.matrix.warning : m.matrix.error;
  if (cell.level === "ok")
    return (
      <td className={cls}>
        <span className="sr-only">{word}</span>
      </td>
    );
  return (
    <td className={cls}>
      <span className={`qm qm-${cell.level} tip`} data-tip={cell.texts.join(" · ")} tabIndex={0} aria-label={`${video}, ${check}: ${word} – ${cell.texts.join("; ")}`} role="img" />
    </td>
  );
}

function Matrix({ d }: { d: ChecksPage }) {
  const spans: { group: keyof typeof groups; n: number }[] = [];
  for (const c of d.columns) {
    const last = spans.at(-1);
    if (last?.group === c.group) last.n += 1;
    else spans.push({ group: c.group, n: 1 });
  }
  return (
    <div className="matrix-scroll" role="region" aria-label={m.matrix.title} tabIndex={0}>
      <table className="matrix">
        <caption className="sr-only">{m.matrix.caption}</caption>
        <thead>
          <tr>
            <td className="corner" />
            {spans.map((s, i) => (
              <th key={i} scope="colgroup" colSpan={s.n} className="grp">
                {groups[s.group]}
              </th>
            ))}
          </tr>
          <tr>
            <th scope="col" className="vid">
              {m.matrix.video}
            </th>
            {d.columns.map((c, i) => (
              <th key={c.key} scope="col" className={i > 0 && d.columns[i - 1]!.group !== c.group ? "qh g0" : "qh"}>
                <span>{c.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {d.rows.map((r) => (
            <tr key={r.id} className={r.passed ? undefined : "fail"}>
              <th scope="row" className="vid">
                <Link href={`/films/${r.id}/`}>
                  <span className="num">{filmNo(r.number)}</span> <span className="vt">{r.title}</span>
                </Link>
              </th>
              {d.columns.map((c, i) => (
                <Cell key={c.key} cell={r.cells[c.key]} check={c.name} video={filmNo(r.number)} g0={i > 0 && d.columns[i - 1]!.group !== c.group} always={c.always} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Weeks({ d }: { d: ChecksPage }) {
  const per = d.weeks.map((w) => (w.videos ? w.flags / w.videos : 0));
  const max = Math.max(1, ...per);
  const w = m.weeks;
  return (
    <>
      <ol className="wk-cols" aria-label={w.caption}>
        {d.weeks.map((wk, i) => (
          <li key={wk.week}>
            <span className="v num" aria-hidden="true">
              {wk.videos ? fmtDec(per[i]!) : "–"}
            </span>
            <span className="bar">
              <i style={{ height: pct((per[i]! / max) * 100) }} aria-hidden="true" />
            </span>
            <span className="lab">W{wk.week}</span>
            <span className="sr-only">
              {wk.videos ? `${fmtDec(per[i]!)} flags per video, ${count(wk.videos, "video", "videos")}` : w.none}
            </span>
          </li>
        ))}
      </ol>
      <TableTwin
        caption={w.caption}
        columns={[{ head: w.cols.week }, { head: w.cols.from }, { head: w.cols.videos, num: true }, { head: w.cols.flags, num: true }, { head: w.cols.per, num: true }]}
        rows={d.weeks.map((wk, i) => [`W${wk.week}`, fmtDay(wk.from), wk.videos, wk.flags, wk.videos ? fmtDec(per[i]!) : "–"])}
      />
    </>
  );
}
