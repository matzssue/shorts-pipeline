import type { Metadata } from "next";
import { Archivo, Chivo_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { Colophon } from "@/components/Colophon";
import { Masthead } from "@/components/Masthead";
import { THEME_INIT_SCRIPT } from "@/components/theme";
import { messages } from "@/lib/messages.en";
import "./globals.css";

// next/font downloads the files at build time and serves them from this site: no request to Google.
const archivo = Archivo({ subsets: ["latin", "latin-ext"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });
const chivoMono = Chivo_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-chivo-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: messages.wordmark, template: `%s · ${messages.wordmark}` },
  description: messages.tagline,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${chivoMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Sets the saved theme before the first paint, so the page never flashes the wrong one. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <Masthead />
        <main id="main">{children}</main>
        <Colophon />
      </body>
    </html>
  );
}
