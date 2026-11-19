"use client";

import { parseQuery, toSearch, type FilmRow } from "@/data/selectors/filmQuery";
import { useUrlState } from "@/lib/useUrlState";
import { FilmsView } from "./FilmsView";

/** The Films view with filters, sort, view mode and columns in the address: a link reproduces it. */
export function Films({ rows, start }: { rows: FilmRow[]; start: string }) {
  const { value, set, pathname, ready } = useUrlState(parseQuery, toSearch);
  // The filter bar is in the HTML from the start (hidden without JavaScript), so nothing moves when the page hydrates.
  return <FilmsView rows={rows} start={start} query={value} onChange={set} pathname={pathname} ready={ready} />;
}
