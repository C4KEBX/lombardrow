import { easeInOutCubic } from "../design/motion";
import { VIDEO } from "../design/tokens";

/** frames: total sweep length; slant: horizontal lean of the band edges in px; lag: the second band's delay. */
export const WIPE = { frames: 10, slant: 280, lag: 2 } as const;

export type Band = { trail: number; lead: number };

/** Frames where a scene starts after another scene: the cuts the wipes hide. */
export const cutFrames = (scenes: readonly { startFrame: number }[]): number[] =>
  scenes.slice(1).map((scene) => scene.startFrame);

/**
 * A band sweeps left to right across `[cutFrame - frames/2, cutFrame + frames/2)`, fully covering
 * the frame exactly on the cut. Edges are the top-edge x positions; the bottom edge leans left by
 * `slant`. Returns null when the band is off screen.
 */
export function wipeBand(frame: number, cutFrame: number, lagFrames = 0): Band | null {
  const t = (frame - (cutFrame - WIPE.frames / 2 + lagFrames)) / WIPE.frames;
  if (t <= 0 || t >= 1) return null;
  const travel = VIDEO.width + 2 * WIPE.slant;
  const at = (u: number) => -WIPE.slant + travel * easeInOutCubic(u);
  return { lead: at(2 * t), trail: at(2 * t - 1) };
}

export const bandPoints = ({ trail, lead }: Band): string =>
  `${trail},0 ${lead},0 ${lead - WIPE.slant},${VIDEO.height} ${trail - WIPE.slant},${VIDEO.height}`;
