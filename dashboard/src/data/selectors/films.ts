import { filmViews, type Film, type Stage } from "../join";

/** One row of the Films table. Missing numbers stay undefined and render as "–". */
export interface FilmRow {
  id: string;
  number: number;
  title: string;
  stage: Stage;
  format: string;
  series: number;
  seriesTitle: string;
  channel?: string;
  published?: string;
  platforms: string[];
  views: number;
  ytViews?: number;
  igViews?: number;
  avgViewPercent?: number;
  durationS?: number;
  narrationChars: number;
}

export function filmRows(films: Film[]): FilmRow[] {
  return films.map((f) => ({
    id: f.id,
    number: f.number,
    title: f.title,
    stage: f.stage,
    format: f.format,
    series: f.series,
    seriesTitle: f.seriesTitle,
    channel: f.channel,
    published: f.publications.map((p) => p.date).sort()[0],
    platforms: [...new Set(f.publications.map((p) => p.platform))],
    views: filmViews(f),
    ytViews: f.latest.youtube?.views,
    igViews: f.latest.instagram?.views,
    avgViewPercent: f.latest.youtube?.avgViewPercent,
    durationS: f.durationS,
    narrationChars: f.voice.chars,
  }));
}
