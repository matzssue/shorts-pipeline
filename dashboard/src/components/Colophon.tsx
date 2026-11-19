import { messages } from "@/lib/messages.en";

export function Colophon() {
  const items = [messages.colophon.data, messages.colophon.code, messages.colophon.type];
  return (
    <footer className="page">
      <div className="mt-[72px] grid grid-cols-1 gap-x-5 gap-y-3 border-t-2 border-ink pt-3 pb-10 text-[0.8125rem] leading-[1.45] text-ink-2 md:grid-cols-3">
        {items.map((it) => (
          <p key={it.label}>
            <span className="lab mb-[3px] block">{it.label}</span>
            {it.body}
          </p>
        ))}
      </div>
    </footer>
  );
}
