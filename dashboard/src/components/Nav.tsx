"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { messages } from "@/lib/messages.en";

export const NAV = [
  { href: "/", label: messages.nav.overview },
  { href: "/films/", label: messages.nav.films },
  { href: "/checks/", label: messages.nav.checks },
  { href: "/costs/", label: messages.nav.costs },
  { href: "/about/", label: messages.nav.about },
] as const;

const normalise = (p: string) => (p.endsWith("/") ? p : `${p}/`);

/** Five words. The current view sits on the highlighter. */
export function Nav() {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const raw = usePathname() ?? "/";
  const path = normalise(raw.startsWith(base) ? raw.slice(base.length) || "/" : raw);
  const isCurrent = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <nav aria-label={messages.nav.label} className="tabs mt-3.5 flex flex-wrap gap-x-5 border-t-2 border-ink pt-[7px]">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isCurrent(item.href) ? "page" : undefined}
          className="-ml-1.5 px-1.5 py-2.5 font-semibold no-underline transition-colors duration-[120ms] ease-film [font-stretch:88%] hover:underline aria-[current=page]:bg-hl aria-[current=page]:text-hl-ink md:py-1"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
