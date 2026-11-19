import { Suspense } from "react";
import { Overview } from "@/components/overview/Overview";
import { OverviewView } from "@/components/overview/OverviewView";
import { getData } from "@/data";
import { seasonRange, toOverview } from "@/data/selectors/overview";

export default function OverviewPage() {
  const { catalog, films } = getData();
  const input = toOverview(catalog, films);
  // The static HTML holds the whole season; the browser then reads the range from the address.
  return (
    <Suspense fallback={<OverviewView input={input} range={seasonRange(input)} />}>
      <Overview input={input} />
    </Suspense>
  );
}
