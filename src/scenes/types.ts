import type { ResolvedCue } from "../pipeline/resolveScene";

export type SceneRenderProps<P> = {
  props: P;
  cues: ResolvedCue[];
  durationFrames: number;
  /** Set when the year counter is showing over this scene; text scenes start lower to clear it. */
  year?: number;
};
