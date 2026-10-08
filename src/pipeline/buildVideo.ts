import { buildCaptions, type CaptionChunk } from "../captions/chunk";
import { parseFacts } from "../schema/facts";
import { parseStoryboard, type Storyboard } from "../schema/storyboard";
import type { WordTiming } from "../schema/timing";
import {
  assertCuesSupported,
  assertFactsTraceable,
  assertHeadlinesFit,
  assertMapRegions,
  assertTextScenes,
  assertVariety,
} from "../schema/validate";
import { assertSceneTiming } from "./assertSceneTiming";
import { composeScenes, type ComposedScene } from "./resolveScene";

export type BuiltVideo = {
  storyboard: Storyboard;
  scenes: ComposedScene[];
  captions: CaptionChunk[];
  totalFrames: number;
};

/** The single path from raw JSON to renderable scenes: parse, validate, compose. */
export function buildVideo(
  storyboardJson: unknown,
  factsJson: unknown,
  wordsFor: (sb: Storyboard) => Record<string, readonly WordTiming[]>,
  fps: number,
  audioMsByScene?: Record<string, number>,
): BuiltVideo {
  const storyboard = parseStoryboard(storyboardJson);
  assertVariety(storyboard);
  assertCuesSupported(storyboard);
  assertHeadlinesFit(storyboard);
  assertTextScenes(storyboard);
  assertMapRegions(storyboard);
  assertFactsTraceable(storyboard, parseFacts(factsJson));
  const scenes = composeScenes(storyboard, wordsFor(storyboard), fps, audioMsByScene);
  assertSceneTiming(scenes);
  const totalFrames = scenes.reduce((sum, scene) => sum + scene.durationFrames, 0);
  return { storyboard, scenes, captions: buildCaptions(scenes, fps), totalFrames };
}
