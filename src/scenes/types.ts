import type { ResolvedCue } from "../pipeline/resolveScene";

export type SceneRenderProps<P> = {
  props: P;
  cues: ResolvedCue[];
  durationFrames: number;
};
