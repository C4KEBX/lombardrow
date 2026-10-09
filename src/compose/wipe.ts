import { easeInOutCubic } from "../design/motion";
import { VIDEO } from "../design/tokens";

/** frames: total sweep length; slant: horizontal lean of the band edges in px; lag: the second band's delay. */
export const WIPE = { frames: 10, slant: 280, lag: 2 } as const;

export type Band = { trail: number; lead: number };

/** Frames where a scene starts after another scene: the cuts the wipes hide. */
export const cutFrames = (scenes: readonly { startFrame: number }[]): number[] =>
  scenes.slice(1).map((scene) => scene.startFrame);

/** Which way a wipe sweeps across the frame. */
export type WipeDirection = "left-to-right" | "right-to-left" | "top-to-bottom" | "bottom-to-top";
export const WIPE_DIRECTIONS: readonly WipeDirection[] = ["left-to-right", "right-to-left", "top-to-bottom", "bottom-to-top"];

const isVertical = (d: WipeDirection) => d === "top-to-bottom" || d === "bottom-to-top";
/** Length of the frame along the sweep. */
export const sweepLength = (d: WipeDirection): number => (isVertical(d) ? VIDEO.height : VIDEO.width);

/**
 * A band sweeps across `[cutFrame - frames/2, cutFrame + frames/2)`, fully covering the frame exactly
 * on the cut. Edges are positions along the sweep at the band's leading side; the far side leans back
 * by `slant`. Returns null when the band is off screen.
 */
export function wipeBand(frame: number, cutFrame: number, lagFrames = 0, length: number = VIDEO.width): Band | null {
  const t = (frame - (cutFrame - WIPE.frames / 2 + lagFrames)) / WIPE.frames;
  if (t <= 0 || t >= 1) return null;
  const travel = length + 2 * WIPE.slant;
  const at = (u: number) => -WIPE.slant + travel * easeInOutCubic(u);
  return { lead: at(2 * t), trail: at(2 * t - 1) };
}

/** The band as an SVG polygon, mapped from sweep coordinates (along, across) onto the frame. */
export function bandPoints({ trail, lead }: Band, direction: WipeDirection = "left-to-right"): string {
  const across = isVertical(direction) ? VIDEO.width : VIDEO.height;
  const corners: [number, number][] = [[trail, 0], [lead, 0], [lead - WIPE.slant, across], [trail - WIPE.slant, across]];
  const length = sweepLength(direction);
  const map = ([a, c]: [number, number]): [number, number] => {
    switch (direction) {
      case "left-to-right": return [a, c];
      case "right-to-left": return [length - a, c];
      case "top-to-bottom": return [c, a];
      case "bottom-to-top": return [c, length - a];
    }
  };
  return corners.map((p) => map(p).join(",")).join(" ");
}

/**
 * One direction per cut, never the same twice in a row. Seeded (by the door number) so a video always
 * renders the same, while different videos get different orders.
 */
export function wipeDirections(count: number, seed: number): WipeDirection[] {
  let state = (seed * 2654435761) >>> 0 || 1;
  const next = () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state;
  };
  const out: WipeDirection[] = [];
  for (let i = 0; i < count; i += 1) {
    const options = WIPE_DIRECTIONS.filter((d) => d !== out[i - 1]);
    out.push(options[next() % options.length]);
  }
  return out;
}
