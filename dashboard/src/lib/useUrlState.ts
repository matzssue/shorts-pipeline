"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * View state kept in the address. The state changes first and the address follows (`replace`, no
 * scroll), so quick changes in a row never read a stale address; an address change from outside
 * (a link, the back button) replaces the state. `toSearch` returns "" or "?a=b".
 */
export function useUrlState<T>(parse: (p: URLSearchParams) => T, toSearch: (v: T) => string) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(() => parse(new URLSearchParams(params.toString())));
  const pushed = useRef<string[]>([]);

  const search = params.toString();
  useEffect(() => {
    const mine = pushed.current.indexOf(search);
    if (mine >= 0) {
      pushed.current.splice(0, mine + 1);
      return;
    }
    setValue(parse(new URLSearchParams(search)));
    // parse is a pure function of the address, so only the address is a dependency
  }, [search]);

  const set = (next: T) => {
    const s = toSearch(next);
    pushed.current.push(s.slice(1));
    setValue(next);
    router.replace(`${pathname}${s}`, { scroll: false });
  };
  const href = (v: T) => `${pathname}${toSearch(v)}`;
  return { value, set, href, pathname };
}
