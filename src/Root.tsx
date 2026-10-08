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
import { buildVideo } from "./pipeline/buildVideo";

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

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="HelloBigNumber"
      component={Video}
      durationInFrames={hello.totalFrames}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
      defaultProps={{ scenes: hello.scenes, captions: hello.captions }}
    />
    <Composition
      id="FinanceDemo"
      component={Video}
      durationInFrames={finance.totalFrames}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
      defaultProps={{ scenes: finance.scenes, captions: finance.captions }}
    />
    <Composition
      id="HistoryDemo"
      component={Video}
      durationInFrames={history.totalFrames}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
      defaultProps={{ scenes: history.scenes, captions: history.captions }}
    />
    <Composition
      id="AncientDemo"
      component={Video}
      durationInFrames={ancient.totalFrames}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
      defaultProps={{ scenes: ancient.scenes, captions: ancient.captions }}
    />
    <Composition
      id="Production"
      component={Video}
      durationInFrames={1}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
      defaultProps={{ scenes: [], captions: [], totalFrames: 1 }}
      calculateMetadata={({ props }) => ({ durationInFrames: Math.max(1, props.totalFrames ?? 1) })}
    />
  </>
);
