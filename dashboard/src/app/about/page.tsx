import type { Metadata } from "next";
import { AboutView } from "@/components/about/AboutView";
import { getData } from "@/data";
import { messages, MOCK_SEED } from "@/lib/messages.en";

export const metadata: Metadata = { title: messages.views.about.title };

export default function AboutPage() {
  const { catalog: c } = getData();
  return (
    <AboutView
      d={{
        seed: MOCK_SEED,
        counts: {
          topics: c.topics.length,
          products: c.products.length,
          videos: new Set(c.films.map((f) => f.folder)).size,
          publications: c.publications.length,
          snapshots: c.snapshots.length,
          ledger: c.ledger.length,
        },
        series: Object.entries(c.config.series).map(([n, title]) => ({ n: Number(n), title })),
        repoUrl: process.env.DASHBOARD_REPO_URL || undefined,
      }}
    />
  );
}
