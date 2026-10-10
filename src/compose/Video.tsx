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
import { Title, type DoorHeader } from "../scenes/title/Title";
import { Archival } from "../scenes/archival/Archival";
import { BleedArchival } from "../scenes/archival/BleedArchival";
import { FlowDiagram } from "../scenes/flow-diagram/FlowDiagram";
import { LedgerPage } from "../scenes/ledger-page/LedgerPage";
import { BRAND, ThemeProvider } from "../design/theme";
import { DoorPlate, SourceStamp, YearCounter } from "../devices/Devices";
import type { VideoProps } from "../pipeline/buildVideo";
import { ColdOpenCamera, ColdOpenMasthead, COLD_OPEN_MASTHEAD_FRAMES, COLD_OPEN_PREROLL_FRAMES } from "./ColdOpenMasthead";
import { CornerTag, cornerTagFrames } from "./CornerTag";
import { WipeOverlay } from "./WipeOverlay";
import { cutFrames, wipeDirections } from "./wipe";

const SceneSwitch: React.FC<{ composed: ComposedScene; images: VideoProps["images"]; door?: DoorHeader }> = ({ composed, images, door }) => {
  const { scene, cues, durationFrames, shotFrames } = composed;
  const year = scene.year;
  switch (scene.type) {
    case "title":
      return <Title props={scene.props} cues={cues} durationFrames={durationFrames} year={year} door={door} />;
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
    case "archival": {
      const image = images[scene.props.assetId];
      if (scene.props.layout === "bleed") {
        const size = image?.width && image.height ? { width: image.width, height: image.height } : undefined;
        return <BleedArchival props={scene.props} shotFrames={shotFrames} durationFrames={durationFrames} src={image?.src} credit={image?.credit} size={size} />;
      }
      return <Archival props={scene.props} cues={cues} durationFrames={durationFrames} year={year} src={image?.src} credit={image?.credit} />;
    }
    case "flow-diagram":
      return <FlowDiagram props={scene.props} cues={cues} durationFrames={durationFrames} year={year} />;
    case "ledger-page":
      return <LedgerPage props={scene.props} cues={cues} durationFrames={durationFrames} year={year} />;
    default: {
      const unreachable: never = scene;
      throw new Error(`Unhandled scene type: ${JSON.stringify(unreachable)}`);
    }
  }
};

/** Narrated scenes from the open (a title card, a cold open with its masthead overlay, or a bleed open with its corner tag) to the door-plate close, with the overlays on top. */
export const Video: React.FC<VideoProps> = ({ scenes, captions, door, coldOpen, bleedOpen, captionStyle = "lane", close, years, stamps, images = {} }) => {
  const grounds = scenes.map((s) => ({ startFrame: s.startFrame, ground: s.ground }));
  const cuts = close.frames > 0 ? [...cutFrames(scenes), close.startFrame] : cutFrames(scenes);
  return (
    <AbsoluteFill style={{ background: BRAND.ledgerInk }}>
      {scenes.map((composed, i) => (
        <Sequence key={composed.id} from={composed.startFrame} durationInFrames={composed.durationFrames} name={composed.id}>
          <ThemeProvider ground={composed.ground}>
            {i === 0 && coldOpen ? (
              <ColdOpenCamera durationFrames={composed.durationFrames}>
                {(frames) => (
                  <SceneSwitch
                    composed={{ ...composed, durationFrames: frames, cues: composed.cues.map((c) => ({ ...c, frame: c.frame + COLD_OPEN_PREROLL_FRAMES })) }}
                    images={images}
                  />
                )}
              </ColdOpenCamera>
            ) : (
              <SceneSwitch composed={composed} images={images} door={i === 0 && !bleedOpen ? door : undefined} />
            )}
          </ThemeProvider>
        </Sequence>
      ))}
      {close.frames > 0 && (
        <Sequence from={close.startFrame} durationInFrames={close.frames} name="Door plate">
          <DoorPlate doorNo={close.doorNo} />
        </Sequence>
      )}
      <WipeOverlay
        cuts={cuts}
        grounds={[...scenes.slice(1).map((s) => s.ground), "ink"]}
        directions={wipeDirections(cuts.length, door.doorNo)}
      />
      <YearCounter spans={years} />
      {coldOpen && (
        <Sequence from={0} durationInFrames={COLD_OPEN_MASTHEAD_FRAMES} name="Cold-open masthead">
          <ColdOpenMasthead doorNo={door.doorNo} series={door.series} headline={coldOpen.headline} />
        </Sequence>
      )}
      {bleedOpen && (
        <Sequence from={0} durationInFrames={cornerTagFrames()} name="Corner tag">
          <CornerTag doorNo={door.doorNo} title={bleedOpen.title} />
        </Sequence>
      )}
      <SourceStamp spans={stamps} groundAt={(frame) => groundAt(grounds, frame)} />
      <Captions chunks={captions} grounds={grounds} style={captionStyle} />
    </AbsoluteFill>
  );
};
