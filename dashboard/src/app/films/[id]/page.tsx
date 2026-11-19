import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FilmView } from "@/components/film/FilmView";
import { getData } from "@/data";
import { filmPage } from "@/data/selectors/film";

type Props = { params: Promise<{ id: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getData().films.map((f) => ({ id: f.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const f = getData().films.find((x) => x.id === id);
  return { title: f ? f.title : undefined };
}

export default async function FilmPageRoute({ params }: Props) {
  const { id } = await params;
  const { catalog, films } = getData();
  const f = filmPage(catalog, films, id);
  if (!f) notFound();
  return <FilmView f={f} />;
}
