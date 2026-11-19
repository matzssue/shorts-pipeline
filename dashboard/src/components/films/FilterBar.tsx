"use client";

import { StateLink } from "@/lib/StateLink";
import { useEffect, useRef } from "react";
import { COLUMNS, DEFAULT_QUERY, filterOptions, isFiltered, QA_STATES, toSearch, type FilmQuery, type FilmRow, type SortKey } from "@/data/selectors/filmQuery";
import { messages } from "@/lib/messages.en";

const t = messages.films;

function Select({ label, value, options, onPick }: { label: string; value: string; options: [string, string][]; onPick: (v: string) => void }) {
  return (
    <label>
      <span className="lab">{label}</span>
      <select value={value} onChange={(e) => onPick(e.target.value)}>
        <option value="">{t.all}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterBar({ rows, query, onChange, pathname }: { rows: FilmRow[]; query: FilmQuery; onChange: (q: FilmQuery) => void; pathname: string }) {
  const o = filterOptions(rows);
  // the search box keeps its own text while typing; the address follows it, not the other way round
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = search.current;
    if (el && document.activeElement !== el && el.value !== query.q) el.value = query.q;
  }, [query.q]);
  const set = (patch: Partial<FilmQuery>) => onChange({ ...query, ...patch });
  const sortValue = `${query.sort}:${query.dir}`;
  const sorts = Object.entries(t.sorts);
  return (
    <form className="fbar" role="search" aria-label={t.filters} onSubmit={(e) => e.preventDefault()}>
      <label>
        <span className="lab">{t.title}</span>
        <input ref={search} type="search" defaultValue={query.q} placeholder={t.titlePlaceholder} onChange={(e) => set({ q: e.target.value })} />
      </label>
      <Select label={t.channel} value={query.channel ?? ""} options={o.channels.map((c) => [c, c.toUpperCase()])} onPick={(v) => set({ channel: v || undefined })} />
      <Select
        label={t.platform}
        value={query.platform ?? ""}
        options={o.platforms.map((p) => [p, p === "youtube" ? "YouTube" : p === "instagram" ? "Instagram" : p === "tiktok" ? "TikTok" : p])}
        onPick={(v) => set({ platform: v || undefined })}
      />
      <Select label={t.format} value={query.format ?? ""} options={o.formats.map((f) => [f, f])} onPick={(v) => set({ format: v || undefined })} />
      <Select label={t.series} value={query.series ? String(query.series) : ""} options={o.series.map((s) => [String(s), `S${s}`])} onPick={(v) => set({ series: v ? Number(v) : undefined })} />
      <Select label={t.narrator} value={query.narrator ?? ""} options={o.narrators.map((n) => [n.id, n.name])} onPick={(v) => set({ narrator: v || undefined })} />
      <Select label={t.qa} value={query.qa ?? ""} options={QA_STATES.map((s) => [s, t.qaStates[s]])} onPick={(v) => set({ qa: (v || undefined) as FilmQuery["qa"] })} />
      <label>
        <span className="lab">{t.sortBy}</span>
        <select
          value={sortValue}
          onChange={(e) => {
            const [sort, dir] = e.target.value.split(":") as [SortKey, "asc" | "desc"];
            set({ sort, dir });
          }}
        >
          {sorts.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
          {sorts.some(([v]) => v === sortValue) ? null : <option value={sortValue}>{t.custom}</option>}
        </select>
      </label>
      <div className="grid gap-[3px]">
        <span className="lab" id="view-label">
          {t.view}
        </span>
        <span className="seg" role="group" aria-labelledby="view-label">
          {(["table", "sheet"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={query.view === v} onClick={() => set({ view: v })}>
              {t.views[v]}
            </button>
          ))}
        </span>
      </div>
      {query.view === "table" ? (
        <details>
          <summary>{t.columns}</summary>
          <fieldset className="cols">
            <legend className="sr-only">{t.columns}</legend>
            {COLUMNS.map((c) => (
              <label key={c}>
                <input
                  type="checkbox"
                  checked={query.cols.includes(c)}
                  onChange={(e) => set({ cols: e.target.checked ? [...query.cols, c] : query.cols.filter((x) => x !== c) })}
                />
                {t.cols[c]}
              </label>
            ))}
          </fieldset>
        </details>
      ) : null}
      {isFiltered(query) ? (
        <StateLink
          className="clear"
          href={`${pathname}${toSearch({ ...DEFAULT_QUERY, sort: query.sort, dir: query.dir, view: query.view, cols: query.cols })}`}
          onGo={() => onChange({ ...DEFAULT_QUERY, sort: query.sort, dir: query.dir, view: query.view, cols: query.cols })}
        >
          {t.clear}
        </StateLink>
      ) : null}
    </form>
  );
}
