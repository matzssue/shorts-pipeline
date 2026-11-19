import { useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { captionAt, chunkWords } from "@shorts/timeline";
import { CORRECT, fontFamily, INK, paletteFor, SAFE, WHITE, type Palette } from "./theme.js";
import type { ComposeOverlay, ComposeProps, ComposeScene, ComposeWord } from "./types.js";

export const Film: React.FC<ComposeProps> = (p) => {
  const pal = paletteFor(p.series);
  return (
    <AbsoluteFill style={{ backgroundColor: pal.base, fontFamily }}>
      {p.scenes.map((s, i) => (
        <Sequence key={i} from={s.from} durationInFrames={s.durationInFrames}>
          <SceneView scene={s} pal={pal} seriesTitle={p.seriesTitle} sourceLabel={p.sourceLabel} isFirst={i === 0} />
          <Sequence from={s.audio.delay} layout="none">
            <Audio src={staticFile(p.audioSrc)} trimBefore={s.audio.startFrom} trimAfter={s.audio.endAt} />
          </Sequence>
        </Sequence>
      ))}
      <Captions words={p.words} pal={pal} />
    </AbsoluteFill>
  );
};

const SceneView: React.FC<{ scene: ComposeScene; pal: Palette; seriesTitle: string; sourceLabel: string; isFirst: boolean }> = ({
  scene,
  pal,
  seriesTitle,
  sourceLabel,
  isFirst,
}) => (
  <AbsoluteFill>
    {scene.kind === "video" && scene.src && (
      <OffthreadVideo src={staticFile(scene.src)} muted playbackRate={scene.playbackRate} style={cover} />
    )}
    {scene.kind === "image" && scene.src && <KenBurns src={scene.src} />}
    {scene.kind === "text" && <Card pal={pal} seriesTitle={seriesTitle} showTitle={!scene.headline} />}
    {scene.overlay && <OverlayView overlay={scene.overlay} pal={pal} sourceLabel={sourceLabel} sceneFrames={scene.durationInFrames} />}
    {scene.headline && <Headline text={scene.headline} pal={pal} animate={!isFirst} />}
  </AbsoluteFill>
);

const cover: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };

const KenBurns: React.FC<{ src: string }> = ({ src }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [1.1, 1]);
  return <Img src={staticFile(src)} style={{ ...cover, transform: `scale(${scale})` }} />;
};

/** Text card background: flat base colour with diagonal accent stripes; series title only on a card without a headline. */
const Card: React.FC<{ pal: Palette; seriesTitle: string; showTitle: boolean }> = ({ pal, seriesTitle, showTitle }) => (
  <AbsoluteFill
    style={{
      backgroundColor: pal.base,
      backgroundImage: `repeating-linear-gradient(135deg, ${pal.accent}14 0 40px, transparent 40px 120px)`,
    }}
  >
    {showTitle && seriesTitle && (
      <div style={{ position: "absolute", top: SAFE.top, left: SAFE.left }}>
        <span
          style={{
            backgroundColor: pal.accent,
            color: pal.onAccent,
            fontSize: 38,
            fontWeight: 700,
            padding: "10px 22px",
            borderRadius: 8,
          }}
        >
          {seriesTitle}
        </span>
      </div>
    )}
  </AbsoluteFill>
);

/** Large text at the top, left-aligned with an accent bar; in the first scene it shows from the first frame (topic without sound). */
const Headline: React.FC<{ text: string; pal: Palette; animate: boolean }> = ({ text, pal, animate }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = animate ? spring({ frame, fps, config: { damping: 16 } }) : 1;
  return (
    <div
      style={{
        position: "absolute",
        top: SAFE.top,
        left: SAFE.left,
        maxWidth: SAFE.right - SAFE.left,
        transform: `translateX(${(1 - s) * -60}px)`,
        opacity: s,
        display: "flex",
      }}
    >
      <div style={{ width: 14, backgroundColor: pal.accent, borderRadius: 4 }} />
      <div
        style={{
          backgroundColor: `${pal.base}E6`,
          color: WHITE,
          fontSize: 60,
          fontWeight: 700,
          lineHeight: 1.15,
          padding: "20px 28px",
        }}
      >
        {text}
      </div>
    </div>
  );
};

const OverlayView: React.FC<{ overlay: ComposeOverlay; pal: Palette; sourceLabel: string; sceneFrames: number }> = ({
  overlay,
  pal,
  sourceLabel,
  sceneFrames,
}) => {
  if (overlay.type === "label") return <Callout heading={overlay.heading} value={overlay.value} pal={pal} />;
  if (overlay.type === "quiz") return <Quiz {...overlay} pal={pal} sceneFrames={sceneFrames} />;
  return <Source text={overlay.text} label={sourceLabel} pal={pal} />;
};

/** Callout card that slides in from the right: a small heading and a large value. */
const Callout: React.FC<{ heading: string; value: string; pal: Palette }> = ({ heading, value, pal }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - Math.round(fps * 0.5), fps, config: { damping: 15 } });
  return (
    <div
      style={{
        position: "absolute",
        top: 780,
        right: 1080 - SAFE.right,
        transform: `translateX(${(1 - s) * 400}px)`,
        opacity: s,
        backgroundColor: WHITE,
        borderRadius: 16,
        padding: "24px 32px",
        borderLeft: `14px solid ${pal.accent}`,
        boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
      }}
    >
      <div style={{ fontSize: 34, fontWeight: 500, color: INK, opacity: 0.7 }}>{heading}</div>
      <div style={{ fontSize: 72, fontWeight: 700, color: INK }}>{value}</div>
    </div>
  );
};

/**
 * Guessing game: two answers, then a countdown or the highlighted answer.
 * The countdown ends together with the scene – after "1" the next scene starts, no empty card.
 */
const Quiz: React.FC<{ options: [string, string]; countdown?: number; answer?: number; pal: Palette; sceneFrames: number }> = ({
  options,
  countdown,
  answer,
  pal,
  sceneFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = answer === undefined ? 0 : spring({ frame: frame - Math.round(fps * 0.4), fps, config: { damping: 12 } });
  const countFrom = countdown ? Math.max(0, sceneFrames - Math.round(countdown * fps)) : sceneFrames;
  const left = countdown && frame >= countFrom ? Math.min(countdown, Math.ceil((sceneFrames - frame) / fps)) : 0;
  // Each digit pops in at the start of its second.
  const tick = spring({ frame: (frame - countFrom) % fps, fps, config: { damping: 10, mass: 0.6 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 40, paddingBottom: 400 }}>
      {options.map((o, i) => {
        const pop = spring({ frame: frame - i * 6, fps, config: { damping: 14 } });
        const isAnswer = answer === i;
        const dim = answer !== undefined && !isAnswer;
        return (
          <div
            key={o}
            style={{
              width: 780,
              padding: "30px 40px",
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              gap: 28,
              fontSize: 64,
              fontWeight: 700,
              color: isAnswer ? WHITE : INK,
              backgroundColor: isAnswer ? CORRECT : WHITE,
              opacity: dim ? 1 - reveal * 0.6 : 1,
              transform: `translateY(${(1 - pop) * 60}px) scale(${isAnswer ? 1 + reveal * 0.05 : 1})`,
            }}
          >
            <span
              style={{
                width: 76,
                height: 76,
                borderRadius: 12,
                backgroundColor: pal.accent,
                color: pal.onAccent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 48,
              }}
            >
              {String.fromCharCode(65 + i)}
            </span>
            {o}
          </div>
        );
      })}
      {countdown && left > 0 && (
        <div
          style={{
            marginTop: 16,
            width: 160,
            height: 160,
            borderRadius: 16,
            backgroundColor: pal.accent,
            color: pal.onAccent,
            fontSize: 96,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `rotate(${(1 - tick) * -12}deg) scale(${0.7 + tick * 0.3})`,
          }}
        >
          {left}
        </div>
      )}
    </AbsoluteFill>
  );
};

const Source: React.FC<{ text: string; label: string; pal: Palette }> = ({ text, label, pal }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - Math.round(fps * 0.3), fps, config: { damping: 14 } });
  return (
    <div
      style={{
        position: "absolute",
        top: 580,
        left: SAFE.left,
        maxWidth: SAFE.right - SAFE.left,
        opacity: s,
        transform: `translateY(${(1 - s) * 30}px)`,
        backgroundColor: WHITE,
        borderRadius: 16,
        padding: "20px 30px",
      }}
    >
      <div style={{ color: pal.base, fontSize: 32, fontWeight: 700 }}>{label}</div>
      <div style={{ color: INK, fontSize: 46, fontWeight: 500, marginTop: 4 }}>{text}</div>
    </div>
  );
};

/** Captions for the whole narration; the current word sits on an accent-coloured box. */
const Captions: React.FC<{ words: ComposeWord[]; pal: Palette }> = ({ words, pal }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chunks = useMemo(() => chunkWords(words, fps), [words, fps]);
  const caption = captionAt(chunks, frame, fps);
  if (!caption) return null;
  const { chunk, active } = caption;
  return (
    <div
      style={{
        position: "absolute",
        top: 1200,
        left: SAFE.left,
        width: SAFE.right - SAFE.left,
        textAlign: "center",
        fontSize: 64,
        fontWeight: 700,
        lineHeight: 1.35,
        color: WHITE,
        textShadow: "0 3px 10px rgba(0,0,0,0.85)",
      }}
    >
      {chunk.words.map((w, i) => {
        const on = active[i];
        return (
          <span
            key={i}
            style={{
              padding: "2px 10px",
              borderRadius: 10,
              backgroundColor: on ? pal.accent : "transparent",
              color: on ? pal.onAccent : WHITE,
              textShadow: on ? "none" : undefined,
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};
