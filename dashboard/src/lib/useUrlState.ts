"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const EVENT = "urlstate";

const subscribe = (cb: () => void) => {
  window.addEventListener("popstate", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("popstate", cb);
    window.removeEventListener(EVENT, cb);
  };
};
const readSearch = () => window.location.search.replace(/^\?/, "");
// The static HTML is the default view: on the server, and while the page hydrates, there is no query.
const noSearch = () => "";

/**
 * View state kept in the address. The state changes first and the address follows (`replaceState`,
 * no navigation), so quick changes in a row never read a stale address; the back button replaces the
 * state. The address is read without `useSearchParams`, so the page is rendered in full on the server
 * and hydrates in place instead of being swapped in after the JavaScript loads.
 * `toSearch` returns "" or "?a=b".
 */
export function useUrlState<T>(parse: (p: URLSearchParams) => T, toSearch: (v: T) => string) {
  const search = useSyncExternalStore(subscribe, readSearch, noSearch);
  const [value, setValue] = useState(() => parse(new URLSearchParams()));
  const [ready, setReady] = useState(false);
  const pushed = useRef<string[]>([]);

  useEffect(() => {
    setReady(true);
    const mine = pushed.current.indexOf(search);
    if (mine >= 0) {
      pushed.current.splice(0, mine + 1);
      return;
    }
    setValue(parse(new URLSearchParams(search)));
    // parse is a pure function of the address, so only the address is a dependency
  }, [search]);

  const pathname = typeof window === "undefined" ? "" : window.location.pathname;
  const set = (next: T) => {
    const s = toSearch(next);
    pushed.current.push(s.slice(1));
    setValue(next);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${s}`);
    window.dispatchEvent(new Event(EVENT));
  };
  const href = (v: T) => `${pathname}${toSearch(v)}`;
  /** False until the page has hydrated: controls appear only when they can work. */
  return { value, set, href, pathname, ready };
}
