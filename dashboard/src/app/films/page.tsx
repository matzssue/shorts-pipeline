import type { Metadata } from "next";
import { Suspense } from "react";
import { Films } from "@/components/films/Films";
import { FilmsView } from "@/components/films/FilmsView";
import { getData } from "@/data";
import { DEFAULT_QUERY } from "@/data/selectors/filmQuery";
import { filmRows } from "@/data/selectors/films";
import { messages } from "@/lib/messages.en";

export const metadata: Metadata = { title: messages.views.films.title };

export default function FilmsPage() {
  const { catalog, films } = getData();
  const rows = filmRows(films, catalog);
  const start = films.map((f) => f.made).sort()[0] ?? "2026-01-01";
  // The static HTML lists every video; the browser then applies the filters from the address.
  return (
    <Suspense fallback={<FilmsView rows={rows} start={start} query={DEFAULT_QUERY} />}>
      <Films rows={rows} start={start} />
    </Suspense>
  );
}
