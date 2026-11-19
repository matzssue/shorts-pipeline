"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseRange, sameRange, seasonRange, type OverviewInput, type Range } from "@/data/selectors/overview";
import { OverviewView } from "./OverviewView";

/** The Overview with its range in the address (`?from=…&to=…`): a link reproduces the view. */
export function Overview({ input }: { input: OverviewInput }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const range = parseRange(input, params.get("from"), params.get("to"));
  const href = (r: Range) => (sameRange(r, seasonRange(input)) ? pathname : `${pathname}?from=${r.from}&to=${r.to}`);
  return <OverviewView input={input} range={range} href={href} onChange={(r) => router.replace(href(r), { scroll: false })} />;
}
