import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Captions, groundAt } from "../captions/Captions";
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
import { BRAND, ThemeProvider } from "../design/theme";
import { DoorPlate, LedgerLineOpen, SourceStamp, YearCounter } from "../devices/Devices";
import type { VideoProps } from "../pipeline/buildVideo";
import { WipeOverlay } from "./WipeOverlay";
import { cutFrames } from "./wipe";

const SceneSwitch: React.FC<{ composed: ComposedScene }> = ({ composed }) => {
  const { scene, cues, durationFrames } = composed;
  const year = scene.year;
  switch (scene.type) {
    case "title":
      return <Title props={scene.props} cues={cues} durationFrames={durationFrames} year={year} />;
    case "big-number":
      return <BigNumber props={scene.props} cues={cues} durationFrames={durationFrames} year={year} />;
    case "line-chart":
      return <LineChart props={scene.props} cues={cues} durationFrames={durationFrames} year={year} />;
    case "bar-race":
      return <BarRace props={scene.props} cues={cues} durationFrames={durationFrames} year={year} />;
    case "kinetic-text":
      return <KineticText props={scene.props} cues={cues} durationFrames={durationFrames} year={year} />;
    case "compare":
      return <Compare props={scene.props} cues={cues} durationFrames={durationFrames} year={year} />;
    case "quote":
      return <Quote props={scene.props} cues={cues} durationFrames={durationFrames} year={year} />;
    case "timeline":
      return <Timeline props={scene.props} cues={cues} durationFrames={durationFrames} year={year} />;
    case "map":
      return <MapScene props={scene.props} cues={cues} durationFrames={durationFrames} year={year} />;
    default: {
      const unreachable: never = scene;
      throw new Error(`Unhandled scene type: ${JSON.stringify(unreachable)}`);
    }
  }
};

/** Narrated scenes between the ledger-line open and the door-plate close, with the overlays on top. */
export const Video: React.FC<VideoProps> = ({ scenes, captions, open, close, years, stamps }) => {
  const grounds = scenes.map((s) => ({ startFrame: s.startFrame, ground: s.ground }));
  return (
    <AbsoluteFill style={{ background: BRAND.ledgerInk }}>
      {open.frames > 0 && (
        <Sequence durationInFrames={open.frames} name="Open">
          <LedgerLineOpen doorNo={open.doorNo} series={open.series} durationFrames={open.frames} handoffAxis={open.handoffAxis} />
        </Sequence>
      )}
      {scenes.map((composed) => (
        <Sequence key={composed.id} from={composed.startFrame} durationInFrames={composed.durationFrames} name={composed.id}>
          <ThemeProvider ground={composed.ground}>
            <SceneSwitch composed={composed} />
          </ThemeProvider>
        </Sequence>
      ))}
      {close.frames > 0 && (
        <Sequence from={close.startFrame} durationInFrames={close.frames} name="Door plate">
          <DoorPlate doorNo={close.doorNo} />
        </Sequence>
      )}
      <WipeOverlay
        cuts={close.frames > 0 ? [...cutFrames(scenes), close.startFrame] : cutFrames(scenes)}
        grounds={[...scenes.slice(1).map((s) => s.ground), "ink"]}
      />
      <YearCounter spans={years} />
      <SourceStamp spans={stamps} groundAt={(frame) => groundAt(grounds, frame)} />
      <Captions chunks={captions} grounds={grounds} />
    </AbsoluteFill>
  );
};
