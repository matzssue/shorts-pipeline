import Link from "next/link";
import { messages } from "@/lib/messages.en";
import { Nav } from "./Nav";
import { ThemeToggle } from "./ThemeToggle";

export function Masthead() {
  return (
    <header className="page pt-5">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:bg-hl focus:px-2 focus:py-1 focus:text-hl-ink">
        Skip to content
      </a>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-[22px] gap-y-1.5 md:grid-cols-[auto_minmax(0,1fr)_auto]">
        <Link href="/" className="text-[2.5rem] leading-[0.86] font-extrabold uppercase no-underline [font-stretch:62%]">
          {messages.wordmark}
        </Link>
        <p className="col-span-full row-start-2 max-w-[46ch] pb-px text-sm leading-[1.3] text-ink-2 md:col-span-1 md:row-start-auto">{messages.tagline}</p>
        <ThemeToggle />
      </div>
      <Nav />
    </header>
  );
}
