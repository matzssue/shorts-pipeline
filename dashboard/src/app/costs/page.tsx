import type { Metadata } from "next";
import { CostsView } from "@/components/costs/CostsView";
import { getData } from "@/data";
import { costsPage } from "@/data/selectors/costs";
import { messages } from "@/lib/messages.en";

export const metadata: Metadata = { title: messages.views.costs.title };

export default function CostsPage() {
  const { catalog, films } = getData();
  return <CostsView d={costsPage(catalog, films)} />;
}
