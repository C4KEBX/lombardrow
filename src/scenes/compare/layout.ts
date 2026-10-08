export const COMPARE = {
  baseline: 1130,
  maxBar: 420,
  barWidth: 300,
  centers: [300, 780],
  labelY: 1196,
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
