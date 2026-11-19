import type { ReactNode } from "react";
import { fmtInt } from "@/charts/format";
import { pct } from "@/charts/scale";

export interface RankItem {
  key: string;
  label: ReactNode;
  value: number;
}

/**
 * Ranking: horizontal bars sorted from the largest, one series, one ink. The value is printed next
 * to every bar, so the list reads on its own; the bar only shows proportion.
 */
export function Ranking({ items, format = fmtInt }: { items: RankItem[]; format?: (v: number) => string }) {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...sorted.map((i) => i.value));
  return (
    <ol className="rank">
      {sorted.map((it) => (
        <li key={it.key}>
          <p className="t">{it.label}</p>
          <div className="b">
            {/* 78% leaves room for the number at the end of the longest bar */}
            <i style={{ width: pct((it.value / max) * 78) }} aria-hidden="true" />
            <span>{format(it.value)}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
