/** Number and word formatting for every text in the interface (UI language: English). */

const LOCALE = "en-GB";
const int = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const decs = new Map<number, Intl.NumberFormat>();
const plurals = new Intl.PluralRules(LOCALE);

/** 4462 → "4,462". */
export const fmtInt = (n: number): string => int.format(n);

/** Fixed decimals: (43.6, 1) → "43.6", (40, 1) → "40.0". */
export function fmtDec(n: number, digits = 1): string {
  let f = decs.get(digits);
  if (!f) decs.set(digits, (f = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits })));
  return f.format(n);
}

export const fmtPct = (n: number, digits = 1): string => `${fmtDec(n, digits)}%`;
export const fmtSec = (n: number, digits = 1): string => `${fmtDec(n, digits)} s`;

/** (1, "video", "videos") → "1 video"; (22, …) → "22 videos". */
export const count = (n: number, one: string, other: string): string => `${fmtInt(n)} ${plurals.select(n) === "one" ? one : other}`;

/** Two-digit video number as on the slate: 2 → "02". */
export const filmNo = (n: number): string => String(n).padStart(2, "0");

const dayFmt = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", timeZone: "UTC" });
const dayYearFmt = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const at = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);

/** "2026-02-14" → "14 Feb"; with the year → "14 Feb 2026". */
export const fmtDay = (iso: string, year = false): string => (year ? dayYearFmt : dayFmt).format(at(iso));

/** "5 Jan – 15 Feb 2026"; one day → "15 Feb 2026". */
export const fmtRange = (from: string, to: string): string => (from === to ? fmtDay(to, true) : `${fmtDay(from)} – ${fmtDay(to, true)}`);

/** Measurement time: "15 Feb 09:30 UTC". */
export const fmtMeasured = (iso: string): string => `${fmtDay(iso)} ${iso.slice(11, 16)} UTC`;

/** Length of a span in words: 42 days → "6 weeks", 10 days → "10 days". */
export const fmtSpan = (days: number): string => (days >= 14 && days % 7 === 0 ? count(days / 7, "week", "weeks") : count(days, "day", "days"));
