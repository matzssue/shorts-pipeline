import { messages } from "@/lib/messages.en";

export interface TwinColumn {
  head: string;
  /** Numbers align right in mono with tabular digits. */
  num?: boolean;
}

/**
 * The chart's twin in a table: the same numbers, reachable without a mouse, without colour and
 * without JavaScript (`<details>` opens natively). On a phone the table scrolls inside its own box.
 */
export function TableTwin({ caption, columns, rows }: { caption: string; columns: TwinColumn[]; rows: (string | number)[][] }) {
  return (
    <details className="twin">
      <summary>{messages.charts.showTable}</summary>
      <div className="scroll-x" role="region" aria-label={caption} tabIndex={0}>
        <table className="tbl">
          <caption>{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.head} scope="col" className={c.num ? "r" : undefined}>
                  {c.head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((cell, j) =>
                  j === 0 ? (
                    <th key={j} scope="row">
                      {cell}
                    </th>
                  ) : (
                    <td key={j} className={columns[j]?.num ? "r" : undefined}>
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
