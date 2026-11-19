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

// Absolute links in the preview tags need the site address; CI passes it (GitHub Pages), locally there is none.
const site = process.env.DASHBOARD_SITE_URL;

export const metadata: Metadata = {
  ...(site ? { metadataBase: new URL(`${site.replace(/\/$/, "")}${process.env.DASHBOARD_BASE_PATH ?? ""}/`) } : {}),
  title: { default: messages.wordmark, template: `%s · ${messages.wordmark}` },
  description: messages.tagline,
  applicationName: messages.wordmark,
  openGraph: {
    type: "website",
    siteName: messages.wordmark,
    title: messages.wordmark,
    description: messages.tagline,
    // the preview image needs an absolute address; without one, no image instead of a localhost link
    ...(site ? { images: [{ url: "og.png", width: 1200, height: 630, alt: `${messages.wordmark}: ${messages.tagline}` }] } : {}),
  },
  twitter: { card: site ? "summary_large_image" : "summary" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${chivoMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Sets the saved theme before the first paint, so the page never flashes the wrong one. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* Controls that only work with JavaScript are in the HTML to keep the layout still; without it they go. */}
        <noscript>
          <style>{".js-only{display:none}"}</style>
        </noscript>
      </head>
      <body>
        <Masthead />
        <main id="main">{children}</main>
        <Colophon />
      </body>
    </html>
  );
}
