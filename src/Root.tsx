import React from "react";
import { Composition, staticFile } from "remotion";
import financeFacts from "../fixtures/finance.facts.json";
import financeStoryboard from "../fixtures/finance.storyboard.json";
import ancientFacts from "../fixtures/ancient.facts.json";
import ancientStoryboard from "../fixtures/ancient.storyboard.json";
import historyFacts from "../fixtures/history.facts.json";
import historyStoryboard from "../fixtures/history.storyboard.json";
import ledgerFacts from "../fixtures/ledger.facts.json";
import ledgerStoryboard from "../fixtures/ledger.storyboard.json";
import facts from "../fixtures/hello.facts.json";
import storyboardJson from "../fixtures/hello.storyboard.json";
import words from "../fixtures/hello.words.json";
import { synthWords } from "./voice/synthWords";
import { Video } from "./compose/Video";
import { Thumbnail, type ThumbnailProps } from "./publish/Thumbnail";
import { VIDEO } from "./design/tokens";
import { buildVideo, videoProps, type VideoProps } from "./pipeline/buildVideo";

const hello = buildVideo(storyboardJson, facts, () => words, VIDEO.fps);
const finance = buildVideo(
  financeStoryboard,
  financeFacts,
  (sb) => Object.fromEntries(sb.scenes.map((s) => [s.id, synthWords(s.narration)])),
  VIDEO.fps,
);

const history = buildVideo(
  historyStoryboard,
  historyFacts,
  (sb) => Object.fromEntries(sb.scenes.map((s) => [s.id, synthWords(s.narration)])),
  VIDEO.fps,
);

const ancient = buildVideo(
  ancientStoryboard,
  ancientFacts,
  (sb) => Object.fromEntries(sb.scenes.map((s) => [s.id, synthWords(s.narration)])),
  VIDEO.fps,
);

/** Archival, flow-diagram and ledger-page scenes, with a generated stand-in for the archival image. */
const ledger = buildVideo(
  ledgerStoryboard,
  ledgerFacts,
  (sb) => Object.fromEntries(sb.scenes.map((s) => [s.id, synthWords(s.narration)])),
  VIDEO.fps,
  undefined,
  { "page-standin": { src: staticFile("demo/page-standin.jpg"), credit: "Generated stand-in image. Not archival." } },
);

/** Placeholder props for the Production composition; real props arrive as inputProps. */
const EMPTY_VIDEO: VideoProps = {
  scenes: [], captions: [], totalFrames: 1, years: [], stamps: [], images: {},
  door: { doorNo: 1, series: "" },
  close: { startFrame: 0, frames: 0, doorNo: 1 },
};

const THUMBNAIL: ThumbnailProps = { doorNo: 4, title: "The Rule of 72", series: "How it works", width: VIDEO.width, height: VIDEO.height };

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Thumbnail"
      component={Thumbnail}
      durationInFrames={1}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
      defaultProps={THUMBNAIL}
      calculateMetadata={({ props }) => ({ width: props.width, height: props.height })}
    />
    <Composition
      id="HelloBigNumber"
      component={Video}
      durationInFrames={hello.totalFrames}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
      defaultProps={videoProps(hello)}
    />
    <Composition
      id="FinanceDemo"
      component={Video}
      durationInFrames={finance.totalFrames}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
      defaultProps={videoProps(finance)}
    />
    <Composition
      id="HistoryDemo"
      component={Video}
      durationInFrames={history.totalFrames}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
      defaultProps={videoProps(history)}
    />
    <Composition
      id="AncientDemo"
      component={Video}
      durationInFrames={ancient.totalFrames}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
      defaultProps={videoProps(ancient)}
    />
    <Composition
      id="LedgerDemo"
      component={Video}
      durationInFrames={ledger.totalFrames}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
      defaultProps={videoProps(ledger)}
    />
    <Composition
      id="Production"
      component={Video}
      durationInFrames={1}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
      defaultProps={EMPTY_VIDEO}
      calculateMetadata={({ props }) => ({ durationInFrames: Math.max(1, props.totalFrames ?? 1) })}
    />
  </>
);
