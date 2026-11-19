"use client";

import { useEffect, useState } from "react";
import { messages } from "@/lib/messages.en";
import { applyTheme, nextTheme, readTheme, type Theme } from "./theme";

/** A word, not an icon: "Theme: auto / light / dark". Click cycles through them. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => setTheme(readTheme()), []);

  return (
    <button
      type="button"
      className="cursor-pointer border border-ink bg-transparent px-2.5 py-2 font-mono text-xs leading-none font-medium text-ink transition-colors duration-[120ms] ease-film hover:bg-ink hover:text-paper"
      onClick={() => {
        const t = nextTheme(theme);
        applyTheme(t);
        setTheme(t);
      }}
    >
      {messages.theme.label}: <span data-testid="theme-value">{messages.theme[theme]}</span>
    </button>
  );
}
