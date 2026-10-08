import React from "react";
import { Composition } from "remotion";
import financeFacts from "../fixtures/finance.facts.json";
import financeStoryboard from "../fixtures/finance.storyboard.json";
import ancientFacts from "../fixtures/ancient.facts.json";
import ancientStoryboard from "../fixtures/ancient.storyboard.json";
import historyFacts from "../fixtures/history.facts.json";
import historyStoryboard from "../fixtures/history.storyboard.json";
import facts from "../fixtures/hello.facts.json";
import storyboardJson from "../fixtures/hello.storyboard.json";
import words from "../fixtures/hello.words.json";
import { synthWords } from "./voice/synthWords";
import { Video } from "./compose/Video";
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

/** Placeholder props for the Production composition; real props arrive as inputProps. */
const EMPTY_VIDEO: VideoProps = {
  scenes: [], captions: [], totalFrames: 1, years: [], stamps: [],
  open: { frames: 0, doorNo: 1, series: "", handoffAxis: null },
  close: { startFrame: 0, frames: 0, doorNo: 1 },
};

export const RemotionRoot: React.FC = () => (
  <>
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
