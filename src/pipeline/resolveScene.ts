import type { Ground } from "../design/theme";
import type { Scene, Storyboard } from "../schema/storyboard";
import {
  assertValidWords,
  CueResolutionError,
  msToFrame,
  resolveCue,
  sceneDurationMs,
  type WordTiming,
} from "../schema/timing";

export type ResolvedCue = { frame: number; do: "callout" | "emphasize"; text?: string; x?: number };

export type ComposedScene = {
  id: string;
  scene: Scene;
  /** The scene's own ground, else the video's palette lead. */
  ground: Ground;
  cues: ResolvedCue[];
  durationFrames: number;
  startFrame: number;
  words: WordTiming[];
};

/**
 * Scene length follows the narration: the last word plus a short tail. The voice clip's own trailing
 * silence is not waited out; the clip keeps playing under the next scene, so nothing is cut off.
 */
export function composeScenes(
  sb: Storyboard,
  wordsByScene: Record<string, readonly WordTiming[]>,
  fps: number,
): ComposedScene[] {
  const composed: ComposedScene[] = [];
  let startFrame = 0;
  for (const scene of sb.scenes) {
    const words = wordsByScene[scene.id];
    if (!words) throw new CueResolutionError(`No word timings for scene "${scene.id}"`);
    try {
      assertValidWords(words);
      const cues = scene.cues.map((cue) => ({
        frame: msToFrame(resolveCue(words, cue.atWord, cue.occurrence), fps),
        do: cue.do,
        text: cue.text,
        x: cue.x,
      }));
      const durationFrames = msToFrame(sceneDurationMs(words), fps);
      composed.push({ id: scene.id, scene, ground: scene.ground ?? sb.meta.paletteLead, cues, durationFrames, startFrame, words: [...words] });
      startFrame += durationFrames;
    } catch (error) {
      if (error instanceof CueResolutionError) {
        throw new CueResolutionError(`Scene "${scene.id}": ${error.message}`);
      }
      throw error;
    }
  }
  return composed;
}
