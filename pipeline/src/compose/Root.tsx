import { Composition } from "remotion";
import { Film } from "./Film.js";
import { FPS, HEIGHT, WIDTH, type ComposeProps } from "./types.js";

const emptyProps: ComposeProps = {
  series: 1,
  seriesTitle: "Quick tip",
  sourceLabel: "Source",
  audioSrc: "",
  scenes: [],
  words: [],
  durationInFrames: FPS,
};

export const Root: React.FC = () => (
  <Composition
    id="FilmF5"
    component={Film}
    width={WIDTH}
    height={HEIGHT}
    fps={FPS}
    durationInFrames={FPS}
    defaultProps={emptyProps}
    calculateMetadata={({ props }) => ({ durationInFrames: Math.max(1, props.durationInFrames) })}
  />
);
