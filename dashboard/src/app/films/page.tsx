import type { Metadata } from "next";
import { Films } from "@/components/films/Films";
import { getData } from "@/data";
import { filmRows } from "@/data/selectors/films";
import { messages } from "@/lib/messages.en";

export const metadata: Metadata = { title: messages.views.films.title };

export default function FilmsPage() {
  const { catalog, films } = getData();
  const rows = filmRows(films, catalog);
  const start = films.map((f) => f.made).sort()[0] ?? "2026-01-01";
  // The static HTML lists every video; the browser then applies the filters from the address.
  return <Films rows={rows} start={start} />;
}
