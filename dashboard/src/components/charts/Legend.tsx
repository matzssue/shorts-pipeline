export type LegendKey = "median" | "context" | "highlight" | "band" | "dot";

const CLASS: Record<LegendKey, string> = { median: "k-med", context: "k-ctx", highlight: "k-top", band: "k-band", dot: "k-dot" };

/** Legend for two or more series. The key mirrors the mark; the text stays in text colour. */
export function Legend({ items }: { items: { key: LegendKey; text: string }[] }) {
  return (
    <p className="legend">
      {items.map((it) => (
        <span key={it.key}>
          <i className={CLASS[it.key]} aria-hidden="true" />
          {it.text}
        </span>
      ))}
    </p>
  );
}
