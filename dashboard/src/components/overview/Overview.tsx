"use client";

import { parseRange, sameRange, seasonRange, type OverviewInput, type Range } from "@/data/selectors/overview";
import { useUrlState } from "@/lib/useUrlState";
import { OverviewView } from "./OverviewView";

/** The Overview with its range in the address (`?from=…&to=…`): a link reproduces the view. */
export function Overview({ input }: { input: OverviewInput }) {
  const toSearch = (r: Range) => (sameRange(r, seasonRange(input)) ? "" : `?from=${r.from}&to=${r.to}`);
  const { value, set, href } = useUrlState((p) => parseRange(input, p.get("from"), p.get("to")), toSearch);
  return <OverviewView input={input} range={value} href={href} onChange={set} />;
}
