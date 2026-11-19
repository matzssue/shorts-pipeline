import type { Linear } from "./scale";

/**
 * SVG path through the defined values of one series (index = x). A missing value breaks the line,
 * so a gap in the data is never drawn as a straight jump.
 */
export function linePath(values: readonly (number | undefined)[], x: Linear, y: Linear): string {
  let d = "";
  let pen = false;
  values.forEach((v, i) => {
    if (v === undefined) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${x(i).toFixed(2)} ${y(v).toFixed(2)}`;
    pen = true;
  });
  return d;
}

/** Index and value of the last defined point, where a direct label goes. */
export function lastPoint(values: readonly (number | undefined)[]): { i: number; v: number } | undefined {
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i];
    if (v !== undefined) return { i, v };
  }
  return undefined;
}
