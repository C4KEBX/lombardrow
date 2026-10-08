import React from "react";
import { AbsoluteFill, Series } from "remotion";
import { Captions } from "../captions/Captions";
import type { CaptionChunk } from "../captions/chunk";
import type { ComposedScene } from "../pipeline/resolveScene";
import { BigNumber } from "../scenes/big-number/BigNumber";
import { BarRace } from "../scenes/bar-race/BarRace";
import { LineChart } from "../scenes/line-chart/LineChart";
import { Compare } from "../scenes/compare/Compare";
import { KineticText } from "../scenes/kinetic-text/KineticText";
import { MapScene } from "../scenes/map/MapScene";
import { Quote } from "../scenes/quote/Quote";
import { Timeline } from "../scenes/timeline/Timeline";
import { Title } from "../scenes/title/Title";
import { THEMES, ThemeProvider } from "../design/theme";
import { WipeOverlay } from "./WipeOverlay";
import { cutFrames } from "./wipe";

const SceneSwitch: React.FC<{ composed: ComposedScene }> = ({ composed }) => {
  const { scene, cues, durationFrames } = composed;
  switch (scene.type) {
    case "title":
      return <Title props={scene.props} cues={cues} durationFrames={durationFrames} />;
    case "big-number":
      return <BigNumber props={scene.props} cues={cues} durationFrames={durationFrames} />;
    case "line-chart":
      return <LineChart props={scene.props} cues={cues} durationFrames={durationFrames} />;
    case "bar-race":
      return <BarRace props={scene.props} cues={cues} durationFrames={durationFrames} />;
    case "kinetic-text":
      return <KineticText props={scene.props} cues={cues} durationFrames={durationFrames} />;
    case "compare":
      return <Compare props={scene.props} cues={cues} durationFrames={durationFrames} />;
    case "quote":
      return <Quote props={scene.props} cues={cues} durationFrames={durationFrames} />;
    case "timeline":
      return <Timeline props={scene.props} cues={cues} durationFrames={durationFrames} />;
    case "map":
      return <MapScene props={scene.props} cues={cues} durationFrames={durationFrames} />;
    default: {
      const unreachable: never = scene;
      throw new Error(`Unhandled scene type: ${JSON.stringify(unreachable)}`);
    }
  }
};

export const Video: React.FC<{ scenes: ComposedScene[]; captions: CaptionChunk[]; totalFrames?: number }> = ({
  scenes,
  captions,
}) => (
  <AbsoluteFill style={{ background: THEMES[scenes[0]?.ground ?? "ink"].ground }}>
    <Series>
      {scenes.map((composed) => (
        <Series.Sequence key={composed.id} durationInFrames={composed.durationFrames}>
          <ThemeProvider ground={composed.ground}>
            <SceneSwitch composed={composed} />
          </ThemeProvider>
        </Series.Sequence>
      ))}
    </Series>
    <WipeOverlay cuts={cutFrames(scenes)} grounds={scenes.slice(1).map((s) => s.ground)} />
    <Captions chunks={captions} grounds={scenes.map((s) => ({ startFrame: s.startFrame, ground: s.ground }))} />
  </AbsoluteFill>
);
