import { buildCaptions, type CaptionChunk } from "../captions/chunk";
import { THEMES } from "../design/theme";
import { assertDevicesInBounds, deviceBoxes } from "../devices/bounds";
import { closeFrames, openFrames, stampTrack, yearTrack, type StampSpan, type YearSpan } from "../devices/tracks";
import { parseFacts } from "../schema/facts";
import { StoryboardError, parseStoryboard, type Storyboard } from "../schema/storyboard";
import type { WordTiming } from "../schema/timing";
import {
  assertCuesSupported,
  assertFactsTraceable,
  assertHeadlinesFit,
  assertMapRegions,
  assertTextScenes,
  assertVariety,
  assertYears,
  sceneStamps,
} from "../schema/validate";
import { assertSceneTiming } from "./assertSceneTiming";
import { composeScenes, type ComposedScene } from "./resolveScene";

/** Scene types whose axis sits on the ledger line, so the open's rule can hand off to it. */
const AXIS_ON_LEDGER_LINE = new Set(["line-chart", "compare"]);

export type VideoProps = {
  scenes: ComposedScene[];
  captions: CaptionChunk[];
  totalFrames: number;
  open: { frames: number; doorNo: number; series: string; handoffAxis: string | null };
  close: { startFrame: number; frames: number; doorNo: number };
  years: YearSpan[];
  stamps: StampSpan[];
  /** Archival images by asset id (data URIs or static URLs) with their on-image credit. */
  images: Record<string, { src: string; credit: string }>;
};

export type BuiltVideo = VideoProps & { storyboard: Storyboard };

/** The single path from raw JSON to renderable scenes: parse, validate, compose, place the devices. */
export function buildVideo(
  storyboardJson: unknown,
  factsJson: unknown,
  wordsFor: (sb: Storyboard) => Record<string, readonly WordTiming[]>,
  fps: number,
  audioMsByScene?: Record<string, number>,
  signoffAudioMs?: number,
  images: VideoProps["images"] = {},
): BuiltVideo {
  const storyboard = parseStoryboard(storyboardJson);
  const facts = parseFacts(factsJson);
  assertVariety(storyboard);
  assertCuesSupported(storyboard);
  assertHeadlinesFit(storyboard);
  assertTextScenes(storyboard);
  assertMapRegions(storyboard);
  assertYears(storyboard);
  assertFactsTraceable(storyboard, facts);
  const stampBySceneId = sceneStamps(storyboard, facts);
  for (const scene of storyboard.scenes) {
    if (scene.type === "archival" && !images[scene.props.assetId]) {
      throw new StoryboardError(`Scene "${scene.id}" uses asset "${scene.props.assetId}", but no image was loaded for it; check assets.json and run npm run assets`);
    }
  }

  const open = openFrames(fps);
  const scenes = composeScenes(storyboard, wordsFor(storyboard), fps, audioMsByScene, open);
  assertSceneTiming(scenes);
  const closeStart = scenes.reduce((end, s) => Math.max(end, s.startFrame + s.durationFrames), open);
  const close = closeFrames(fps, signoffAudioMs);

  const years = yearTrack(scenes.map((s) => ({ startFrame: s.startFrame, durationFrames: s.durationFrames, year: s.scene.year })));
  const stamps = stampTrack(
    scenes.map((s) => ({ id: s.id, startFrame: s.startFrame, durationFrames: s.durationFrames, stamp: stampBySceneId[s.id] })),
    fps,
  ).map((span) => ({ ...span, endFrame: Math.min(span.endFrame, closeStart) }));
  const { doorNo, series } = storyboard.meta;
  assertDevicesInBounds(deviceBoxes({ doorNo, series, years, stamps }));

  const first = scenes[0];
  const handoffAxis = first && AXIS_ON_LEDGER_LINE.has(first.scene.type) ? THEMES[first.ground].axis : null;
  return {
    storyboard,
    scenes,
    captions: buildCaptions(scenes, fps),
    totalFrames: closeStart + close,
    open: { frames: open, doorNo, series, handoffAxis },
    close: { startFrame: closeStart, frames: close, doorNo },
    years,
    stamps,
    images: Object.fromEntries(
      storyboard.scenes.flatMap((s) => (s.type === "archival" ? [[s.props.assetId, images[s.props.assetId]]] : [])),
    ),
  };
}

/** What the Remotion composition needs: the built video without the storyboard. */
export function videoProps(built: BuiltVideo): VideoProps {
  const { storyboard: _storyboard, ...props } = built;
  return props;
}
