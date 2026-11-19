import { FLOW_CREDITS_PER_S_720P, MAX_VOICE_CHARS_PER_S, paletteFor } from "@shorts/schema/video";
import { fmtInt } from "@/charts/format";
import { Frame } from "@/components/films/Frame";
import { SectionHead } from "@/components/overview/bits";
import { messages } from "@/lib/messages.en";

const m = messages.about;

export interface AboutData {
  seed: number;
  counts: Record<keyof typeof m.read.rows, number>;
  series: { n: number; title: string }[];
  /** From the build environment; absent locally. */
  repoUrl?: string;
}

export function AboutView({ d }: { d: AboutData }) {
  return (
    <div className="page">
      <section className="lead-sec" aria-label="Summary">
        <div>
          <SectionHead title={messages.views.about.title} note={messages.views.about.note} level={1} />
          <p className="lead" data-testid="lead">
            {m.lead}
          </p>
        </div>
      </section>

      <section className="sec" data-testid="flow">
        <SectionHead title={m.flow.title} note={m.flow.note} />
        <ol className="flow">
          {m.flow.steps.map((s, i) => (
            <li key={s.name}>
              <span className="num">{String(i + 1).padStart(2, "0")}</span>
              <h3>{s.name}</h3>
              <code>
                {/* break only after a slash or between two files, never inside a name */}
                {s.file.split(/(?<=\/)|(?= · )/).map((part, k) => (
                  <span key={k}>
                    {k > 0 ? <wbr /> : null}
                    {part}
                  </span>
                ))}
              </code>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid grid-cols-1 gap-x-12 md:grid-cols-2">
        <section className="sec" data-testid="real">
          <SectionHead title={m.real.title} />
          <div className="real">
            <div>
              <h3 className="lab">{m.real.realHead}</h3>
              <ul>
                {m.real.real.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="lab">{m.real.madeHead}</h3>
              <ul>
                {m.real.made.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="sec" data-testid="read">
          <SectionHead title={m.read.title} />
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">{m.read.cols.what}</th>
                <th scope="col" className="r">
                  {m.read.cols.count}
                </th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(m.read.rows) as (keyof typeof m.read.rows)[]).map((k) => (
                <tr key={k}>
                  <th scope="row">{m.read.rows[k]}</th>
                  <td className="num r">{fmtInt(d.counts[k])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="sec" data-testid="mock">
        <SectionHead title={m.mock.title} note={m.mock.note} />
        <div className="mock">
          <div>
            <p className="prose">{m.mock.body(d.seed)}</p>
            <pre className="cmd">
              <code>{m.mock.command}</code>
            </pre>
          </div>
          <div>
            <h3 className="lab">{m.mock.scenariosHead}</h3>
            <ol className="scen">
              {m.mock.scenarios.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="sec" data-testid="rules">
        <SectionHead title={m.rules.title} />
        <dl className="rules">
          {m.rules.items.map((r) => (
            <div key={r.term}>
              <dt>{r.term}</dt>
              <dd>{typeof r.body === "function" ? r.body(r.term === "Credits" ? FLOW_CREDITS_PER_S_720P : MAX_VOICE_CHARS_PER_S) : r.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid grid-cols-1 gap-x-12 md:grid-cols-2">
        <section className="sec" data-testid="links">
          <SectionHead title={m.links.title} />
          {d.repoUrl ? (
            <ul className="links">
              <li>
                <a href={d.repoUrl}>{m.links.repo}</a>
              </li>
              <li>
                <a href={`${d.repoUrl}/tree/main/dashboard/tests`}>{m.links.tests}</a>
              </li>
              <li>
                <a href={`${d.repoUrl}/actions`}>{m.links.ci}</a>
              </li>
            </ul>
          ) : (
            <p className="empty-note">{m.links.none}</p>
          )}
        </section>

        <section className="sec" data-testid="colophon">
          <SectionHead title={m.palette.title} />
          <p className="prose">{m.palette.type}</p>
          <ul className="swatches">
            {d.series.map((s) => {
              const p = paletteFor(s.n);
              return (
                <li key={s.n}>
                  <span className="sw">
                    <Frame number={s.n} series={s.n} firstText={s.title} rendered />
                  </span>
                  <span>
                    {m.palette.series(s.n, s.title)}
                    <span className="num block text-ink-3">
                      {p.base} · {p.accent}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="prose mt-3">{m.palette.ink}</p>
        </section>
      </div>
    </div>
  );
}
