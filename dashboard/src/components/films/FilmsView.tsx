import Link from "next/link";
import type { ReactNode } from "react";
import { filmNo, fmtDay, fmtInt, fmtPct, fmtSec } from "@/charts/format";
import { Meter } from "@/components/charts/Meter";
import { QaWord, Thumb } from "@/components/overview/bits";
import {
  applyQuery,
  COLUMNS,
  DEFAULT_QUERY,
  toSearch,
  weeks,
  type Column,
  type FilmQuery,
  type FilmRow,
  type SortKey,
} from "@/data/selectors/filmQuery";
import { messages } from "@/lib/messages.en";
import { timecode } from "@shorts/timeline";
import { FilterBar } from "./FilterBar";
import { Frame } from "./Frame";

const t = messages.films;
const FPS = 30;
const dash = <span className="mute">–</span>;
const opt = (v: number | undefined, f: (n: number) => string = fmtInt): ReactNode => (v === undefined ? dash : f(v));
const length = (r: FilmRow) => (r.durationS === undefined ? dash : timecode(Math.round(r.durationS * FPS), FPS));

function releaseWord(r: FilmRow): string {
  if (r.published) return fmtDay(r.published);
  const h = messages.overview.stages.held;
  return { scripted: h.narration, narrated: h.render, rendered: h.qaMissing, qaFailed: h.qaError, qaPassed: h.publish, published: "" }[r.stage];
}

const platformCell = (r: FilmRow, p: "youtube" | "instagram") => {
  const v = p === "youtube" ? r.ytViews : r.igViews;
  if (v !== undefined) return fmtInt(v);
  if (r.queued.includes(p)) return <span className="mute">{messages.overview.recent.queued}</span>;
  return dash;
};

/** Table cell per optional column, and the sort key a header sorts by (if any). */
const COL: Record<Column, { sort?: SortKey; num?: boolean; cell: (r: FilmRow) => ReactNode }> = {
  released: { sort: "released", cell: (r) => (r.published ? fmtDay(r.published) : <span className="mute">{releaseWord(r)}</span>) },
  format: { cell: (r) => `${r.format} · S${r.series}` },
  length: { sort: "length", cell: length },
  qa: { cell: (r) => <QaWord film={r} /> },
  yt: { sort: "yt", num: true, cell: (r) => platformCell(r, "youtube") },
  ig: { sort: "ig", num: true, cell: (r) => platformCell(r, "instagram") },
  watched: {
    sort: "watched",
    num: true,
    cell: (r) => (r.avgViewPercent !== undefined ? <Meter value={r.avgViewPercent} label={`${filmNo(r.number)}: share watched on YouTube`} /> : dash),
  },
  narrator: { cell: (r) => r.narratorName ?? dash },
  chars: { sort: "chars", num: true, cell: (r) => (r.narrationChars ? fmtInt(r.narrationChars) : dash) },
  likes: { num: true, cell: (r) => opt(r.likes) },
  shares: { num: true, cell: (r) => opt(r.shares) },
  saves: { num: true, cell: (r) => opt(r.saves) },
  watchTime: { num: true, cell: (r) => opt(r.avgViewSeconds, (n) => fmtSec(n, 0)) },
};

function SortHead({ label, sort, query, num, onChange }: { label: string; sort?: SortKey; query: FilmQuery; num?: boolean; onChange?: (q: FilmQuery) => void }) {
  const active = sort && query.sort === sort;
  return (
    <th scope="col" className={num ? "r" : undefined} aria-sort={active ? (query.dir === "asc" ? "ascending" : "descending") : undefined}>
      {sort && onChange ? (
        <button
          type="button"
          onClick={() => onChange({ ...query, sort, dir: active ? (query.dir === "asc" ? "desc" : "asc") : sort === "title" ? "asc" : "desc" })}
        >
          {label}
        </button>
      ) : (
        label
      )}
    </th>
  );
}

function Empty({ pathname, query }: { pathname?: string; query: FilmQuery }) {
  return (
    <p className="mt-6 text-ink-2" data-testid="films-empty">
      {t.empty}{" "}
      {pathname ? (
        <Link href={`${pathname}${toSearch({ ...DEFAULT_QUERY, view: query.view, cols: query.cols })}`} scroll={false}>
          {t.clear}
        </Link>
      ) : null}
    </p>
  );
}

export function FilmsView({
  rows,
  start,
  query,
  onChange,
  pathname,
}: {
  rows: FilmRow[];
  /** First day of the season, for the contact sheet's week strips. */
  start: string;
  query: FilmQuery;
  onChange?: (q: FilmQuery) => void;
  pathname?: string;
}) {
  const shown = applyQuery(rows, query);
  const cols = COLUMNS.filter((c) => query.cols.includes(c));
  const v = messages.views.films;

  return (
    <div className="page">
      <section className="sec">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-5 gap-y-0.5">
          <h1 className="text-lg leading-[1.2] font-bold [font-stretch:88%]">{v.title}</h1>
          <p className="font-mono text-xs leading-[1.4] text-ink-3" data-testid="films-count" aria-live="polite">
            {t.shown(shown.length, rows.length)}
          </p>
        </div>
        {onChange && pathname !== undefined ? <FilterBar rows={rows} query={query} onChange={onChange} pathname={pathname} /> : null}

        {!shown.length ? (
          <Empty pathname={pathname} query={query} />
        ) : query.view === "sheet" ? (
          <div data-testid="sheet">
            {weeks(shown, start).map((w) => (
              <section key={w.week} className="sheet-week" aria-labelledby={`wk-${w.week}`}>
                <h2 id={`wk-${w.week}`}>{t.week(w.week, fmtDay(w.from))}</h2>
                <ol className="sheet">
                  {w.rows.map((r) => (
                    <li key={r.id}>
                      <Frame number={r.number} series={r.series} firstText={r.firstText} rendered={r.durationS !== undefined} />
                      <Link className="f-title" href={`/films/${r.id}/`}>
                        <span className="sr-only">{filmNo(r.number)} </span>
                        {r.title}
                      </Link>
                      <span className="m">
                        <span>{r.stage === "published" ? fmtInt(r.views) : releaseWord(r)}</span>
                        <QaWord film={r} />
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        ) : (
          <div className="ftable-wrap" data-testid="table">
            <table className="tbl ftable">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Frame</span>
                  </th>
                  <SortHead label={t.cols.video} sort="title" query={query} onChange={onChange} />
                  {cols.map((c) => (
                    <SortHead key={c} label={t.cols[c]} sort={COL[c].sort} num={COL[c].num} query={query} onChange={onChange} />
                  ))}
                  <SortHead label={t.cols.views} sort="views" num query={query} onChange={onChange} />
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Thumb film={r} />
                    </td>
                    <td className="video">
                      <Link className="f-title" href={`/films/${r.id}/`}>
                        {r.title}
                      </Link>
                      <span className="f-id">{r.folder}</span>
                    </td>
                    {cols.map((c) => (
                      <td key={c} className={COL[c].num ? "n r" : "n"}>
                        {COL[c].cell(r)}
                      </td>
                    ))}
                    <td className="n r">{r.stage === "published" ? fmtInt(r.views) : dash}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ol className="flist">
              {shown.map((r) => (
                <li key={r.id}>
                  <Thumb film={r} />
                  <Link className="f-title" href={`/films/${r.id}/`}>
                        {r.title}
                      </Link>
                  <QaWord film={r} />
                  <span className="m">
                    {[
                      releaseWord(r),
                      `${r.format} · S${r.series}`,
                      r.durationS !== undefined ? timecode(Math.round(r.durationS * FPS), FPS) : null,
                      r.ytViews !== undefined ? `YT ${fmtInt(r.ytViews)}` : null,
                      r.igViews !== undefined ? `IG ${fmtInt(r.igViews)}` : null,
                      r.avgViewPercent !== undefined ? `${fmtPct(r.avgViewPercent)} watched` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
    </div>
  );
}
