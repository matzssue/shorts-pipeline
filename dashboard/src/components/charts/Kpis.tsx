export interface Kpi {
  key: string;
  label: string;
  value: string;
  /** One short line under the number: what it is measured against. */
  sub?: string;
  /** The one number the view is about – drawn on the highlight. */
  hl?: boolean;
}

/** The headline numbers of a view: a row of cards, a big number each, a label and one line of context. */
export function Kpis({ items, label, testId = "lead" }: { items: Kpi[]; label: string; testId?: string }) {
  return (
    <dl className="kpis" aria-label={label} data-testid={testId}>
      {items.map((k) => (
        <div key={k.key} className={k.hl ? "kpi hl" : "kpi"} data-testid={`kpi-${k.key}`}>
          <dt>{k.label}</dt>
          <dd>
            <span className="kpi-v">{k.value}</span>
            {k.sub ? <span className="kpi-s">{k.sub}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
