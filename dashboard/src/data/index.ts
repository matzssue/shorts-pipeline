import { cache } from "react";
import { buildFilms } from "./join";
import { loadCatalog } from "./load";

/** Loaded once per build: the catalog and the joined films. Server components only. */
export const getData = cache(() => {
  const catalog = loadCatalog();
  return { catalog, films: buildFilms(catalog) };
});
