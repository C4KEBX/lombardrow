import { DEVICES } from "../../design/tokens";

export const COMPARE = {
  /** The bars stand on the ledger line, so a compare opener grows out of the open's rule. */
  baseline: DEVICES.devices.ledger_line.rule.y,
  maxBar: 420,
  barWidth: 280,
  /** Centered on the content area (x 72 to 918), clear of the right-hand action rail. */
  centers: [283, 707],
  middle: 495,
  labelY: 1166,
  growStart: 12,
  growFrames: 40,
  sideDelay: 6,
} as const;

/** Bar heights in px: the taller side is `maxBar`, the other proportional. A zero side has no bar. */
export function barHeights(left: number, right: number): [number, number] {
  const max = Math.max(left, right);
  return [(left / max) * COMPARE.maxBar, (right / max) * COMPARE.maxBar];
}

/** Frames until both bars have finished growing and both values show their final number. */
export const compareRevealFrames = (): number => COMPARE.growStart + COMPARE.sideDelay + COMPARE.growFrames;
