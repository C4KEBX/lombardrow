import { buildCaptions, type CaptionChunk, type CaptionStyle } from "../captions/chunk";
import { assertDevicesInBounds, deviceBoxes } from "../devices/bounds";
import { closeFrames, stampTrack, yearTrack, type StampSpan, type YearSpan } from "../devices/tracks";
import { parseFacts } from "../schema/facts";
import { StoryboardError, parseStoryboard, sceneAssetIds, type Storyboard } from "../schema/storyboard";
import { CueResolutionError, msToFrame, resolveCue, type WordTiming } from "../schema/timing";
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

export type VideoProps = {
  scenes: ComposedScene[];
  captions: CaptionChunk[];
  totalFrames: number;
  /** The door number and series, shown on the first scene: the video opens straight on its title card. */
  door: { doorNo: number; series: string };
  /** Set for a cold open: the title laid over the moving first scene, instead of a title card. */
  coldOpen?: { headline: string };
  /** Set for a bleed open: nothing over frame one, then the title in a small corner tag from 2 s. */
  bleedOpen?: { title: string; hookLine?: string };
  /** "lane": captions in their lane under the scene (classic). "bold": big, one to three words, over the frame (fast). */
  captionStyle?: CaptionStyle;
  /**
   * The sign-off, after the narration. On the door plate by default; with `ending`, over the last scene instead
   * (that scene runs on through it) with the comment question shown from `promptFrame` to the end.
   */
  close: { startFrame: number; frames: number; doorNo: number; ending?: { prompt: string; promptFrame: number } };
  years: YearSpan[];
  stamps: StampSpan[];
  /** Archival images by asset id (data URIs or static URLs) with their on-image credit. */
  images: Record<string, { src: string; credit: string; width?: number; height?: number }>;
};

export type BuiltVideo = VideoProps & { storyboard: Storyboard };

/** How long the reveal ending's question card holds after the last spoken word, before the cut back to frame 0. */
export const ENDING_HOLD_FRAMES = 24;

function captionsBefore(chunks: CaptionChunk[], ms: number): CaptionChunk[] {
  return chunks
    .map((c) => ({ ...c, words: c.words.filter((w) => w.startMs < ms), endMs: Math.min(c.endMs, ms) }))
    .filter((c) => c.words.length > 0 && c.startMs < ms);
}

/** Where the comment question appears: its word in the last scene, as a frame of the whole video. */
function revealEnding(ending: NonNullable<Storyboard["meta"]["ending"]>, scenes: readonly ComposedScene[], fps: number): { prompt: string; promptFrame: number } {
  const last = scenes[scenes.length - 1];
  try {
    return { prompt: ending.prompt, promptFrame: last.startFrame + msToFrame(resolveCue(last.words, ending.atWord, ending.occurrence), fps) };
  } catch (error) {
    if (error instanceof CueResolutionError) {
      throw new StoryboardError(`meta.ending.atWord "${ending.atWord}" is not spoken in the last scene "${last.id}": ${error.message}`);
    }
    throw error;
  }
}

/** The single path from raw JSON to renderable scenes: parse, validate, compose, place the devices. */
export function buildVideo(
  storyboardJson: unknown,
  factsJson: unknown,
  wordsFor: (sb: Storyboard) => Record<string, readonly WordTiming[]>,
  fps: number,
  /** When the sign-off's last word ends, in its own clip: the close stops just after it. */
  signoffEndMs?: number,
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
    for (const id of sceneAssetIds(scene)) {
      if (!images[id]) throw new StoryboardError(`Scene "${scene.id}" uses asset "${id}", but no image was loaded for it; check assets.json and run npm run assets`);
      if (scene.type === "archival" && scene.props.layout === "bleed" && !images[id]?.width) {
        throw new StoryboardError(`Scene "${scene.id}" crops asset "${id}" in shots, but its pixel size could not be read; use a JPEG, PNG or WebP`);
      }
    }
  }

  const scenes = composeScenes(storyboard, wordsFor(storyboard), fps);
  assertSceneTiming(scenes);
  const closeStart = scenes.reduce((end, s) => Math.max(end, s.startFrame + s.durationFrames), 0);
  const ending = storyboard.meta.ending && revealEnding(storyboard.meta.ending, scenes, fps);
  // A reveal ending has no spoken sign-off: the narration asks the question, the card holds a beat, and the video cuts.
  const close = ending ? 0 : closeFrames(fps, signoffEndMs);
  if (ending) {
    const last = scenes[scenes.length - 1];
    scenes[scenes.length - 1] = { ...last, durationFrames: last.durationFrames + ENDING_HOLD_FRAMES };
  }
  const endFrame = closeStart + (ending ? ENDING_HOLD_FRAMES : close);

  const years = yearTrack(scenes.map((s) => ({ startFrame: s.startFrame, durationFrames: s.durationFrames, year: s.scene.year })));
  const stamps = stampTrack(
    scenes.map((s) => ({ id: s.id, startFrame: s.startFrame, durationFrames: s.durationFrames, stamp: stampBySceneId[s.id] })),
    fps,
  ).map((span) => ({ ...span, endFrame: Math.min(span.endFrame, ending ? ending.promptFrame : closeStart) }));
  const { doorNo, series } = storyboard.meta;
  const captionStyle: CaptionStyle = storyboard.meta.format === "fast" ? "bold" : "lane";
  assertDevicesInBounds(deviceBoxes({ doorNo, series, years, stamps }));

  return {
    storyboard,
    scenes,
    // The question card carries its own words, so captions stop where it comes in.
    captions: ending ? captionsBefore(buildCaptions(scenes, fps, captionStyle), (ending.promptFrame * 1000) / fps) : buildCaptions(scenes, fps, captionStyle),
    totalFrames: endFrame,
    door: { doorNo, series },
    coldOpen: storyboard.meta.open === "cold" ? { headline: storyboard.meta.title } : undefined,
    bleedOpen: storyboard.meta.open === "bleed" ? { title: storyboard.meta.title, hookLine: storyboard.meta.hookLine } : undefined,
    captionStyle,
    close: { startFrame: closeStart, frames: close, doorNo, ending },
    years,
    stamps,
    images: Object.fromEntries(
      storyboard.scenes.flatMap((s) => sceneAssetIds(s).map((id) => [id, images[id]])),
    ),
  };
}

/** What the Remotion composition needs: the built video without the storyboard. */
export function videoProps(built: BuiltVideo): VideoProps {
  const { storyboard: _storyboard, ...props } = built;
  return props;
}
