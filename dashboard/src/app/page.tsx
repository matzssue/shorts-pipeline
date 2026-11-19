import { Overview } from "@/components/overview/Overview";
import { getData } from "@/data";
import { toOverview } from "@/data/selectors/overview";

export default function OverviewPage() {
  const { catalog, films } = getData();
  const input = toOverview(catalog, films);
  // The static HTML holds the whole season; the browser then reads the range from the address.
  return <Overview input={input} />;
}
