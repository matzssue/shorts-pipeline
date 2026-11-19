import { messages } from "@/lib/messages.en";

/** Placeholder for a view that later stages fill: a section rule, the title and one sentence. */
export function Pending({ view }: { view: keyof typeof messages.views }) {
  const v = messages.views[view];
  return (
    <section className="page">
      <div className="sec">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-5 gap-y-0.5">
          <h1 className="text-[1.75rem] leading-[1.15] font-extrabold">{v.title}</h1>
          <p className="font-mono text-xs leading-[1.4] text-ink-3">{v.note}</p>
        </div>
        <p className="max-w-[60ch] text-ink-2">{messages.pending}</p>
      </div>
    </section>
  );
}
