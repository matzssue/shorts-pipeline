import { ImageResponse } from "next/og";
import { paletteFor } from "@shorts/schema/video";
import { getData } from "@/data";
import { filmNo } from "@/charts/format";
import { messages } from "@/lib/messages.en";

// Drawn once at build time: the wordmark over a strip of video frames in their series colours.
export const dynamic = "force-static";
const size = { width: 1200, height: 630 };

/** `/og.png`: the link preview. A route (not opengraph-image) so the static file keeps its .png name on GitHub Pages. */
export function GET() {
  const films = getData()
    .films.filter((f) => f.compose)
    .slice(0, 9);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#f0f1ec", color: "#141414", padding: "56px 64px" }}>
        <div style={{ display: "flex", fontSize: 92, fontWeight: 700, letterSpacing: -2, borderBottom: "6px solid #141414", paddingBottom: 12 }}>
          {messages.wordmark.toUpperCase()}
        </div>
        <div style={{ display: "flex", fontSize: 30, marginTop: 20, maxWidth: 900, lineHeight: 1.3 }}>{messages.tagline}</div>
        <div style={{ display: "flex", gap: 18, marginTop: "auto" }}>
          {films.map((f, i) => {
            const p = paletteFor(f.series);
            return (
              <div key={f.id} style={{ width: 104, height: 185, background: p.base, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 10 }}>
                <div style={{ color: "#ffffff", fontSize: 22, fontWeight: 700 }}>{filmNo(f.number)}</div>
                <div style={{ height: 8, background: i === 2 ? "#ffd23f" : p.accent, width: "70%" }} />
              </div>
            );
          })}
        </div>
      </div>
    ),
    size,
  );
}
