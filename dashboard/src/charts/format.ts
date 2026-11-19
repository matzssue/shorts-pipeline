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
