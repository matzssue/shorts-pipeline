import { filmViews, type Film } from "../join";
import type { Catalog } from "../load";
import type { FilmRow } from "./filmQuery";

export type { FilmRow } from "./filmQuery";

/** Server side: one row per video for the Films view. */
export function filmRows(films: Film[], catalog?: Catalog): FilmRow[] {
  return films.map((f) => {
    const live = f.publications.filter((p) => p.status === "published" && p.link !== "");
    const flagged = (f.qa?.checks ?? []).filter((x) => x.level !== "ok");
    const yt = f.latest.youtube;
    const ig = f.latest.instagram;
    const sum = (...xs: (number | undefined)[]) => (xs.every((x) => x === undefined) ? undefined : xs.reduce<number>((s, x) => s + (x ?? 0), 0));
    return {
      id: f.id,
      number: f.number,
      title: f.title,
      folder: f.folder,
      made: f.made,
      stage: f.stage,
      format: f.format,
      series: f.series,
      seriesTitle: f.seriesTitle,
      channel: f.channel,
      narrator: f.narrator,
      narratorName: f.narratorName,
      model: catalog?.config.narrators.find((n) => n.id === f.narrator)?.model,
      firstText: f.compose?.scenes.find((s) => s.headline)?.headline,
      published: live.map((p) => p.date).sort()[0],
      live: [...new Set(live.map((p) => p.platform))],
      queued: [...new Set(f.publications.filter((p) => !live.includes(p)).map((p) => p.platform))],
      qa: f.qa && {
        passed: f.qa.passed,
        warnings: flagged.filter((x) => x.level === "warning").length,
        errors: flagged.filter((x) => x.level === "error").length,
      },
      durationS: f.durationS,
      views: filmViews(f),
      ytViews: yt?.views,
      igViews: ig?.views,
      avgViewPercent: yt?.avgViewPercent,
      avgViewSeconds: yt?.avgViewSeconds,
      likes: sum(yt?.likes, ig?.likes),
      shares: sum(yt?.shares, ig?.shares),
      saves: ig?.saved,
      narrationChars: f.voice.chars,
      takes: f.voice.takes,
    };
  });
}
