"use client";

import type { MouseEvent, ReactNode } from "react";

/**
 * A link to another state of the same view. A plain click changes the state in place (the address
 * follows); a modified click, a new tab or a page without JavaScript just follows the address.
 */
export function StateLink({ href, onGo, className, children, ...rest }: { href: string; onGo?: () => void; className?: string; children: ReactNode; "aria-current"?: "true" }) {
  const click = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!onGo || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onGo();
  };
  return (
    <a href={href} className={className} onClick={click} {...rest}>
      {children}
    </a>
  );
}
