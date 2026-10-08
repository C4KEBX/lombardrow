import { spring } from "remotion";

export const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/** Data easing: smooth deceleration, never overshoots. */
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3);

export function dataProgress(frame: number, startFrame: number, durationFrames: number): number {
  if (durationFrames <= 0) throw new RangeError("durationFrames must be positive");
  return easeOutCubic((frame - startFrame) / durationFrames);
}

export const staggerDelay = (index: number, gapFrames = 4): number => index * gapFrames;

/** Object easing: light overshoot spring. For shapes and labels, never for data values. */
export function popIn(frame: number, fps: number, delayFrames = 0): number {
  return spring({ frame: frame - delayFrames, fps, config: { damping: 11, stiffness: 140, mass: 0.7 } });
}

export function countUp(target: number, progress: number, decimals: number): number {
  const factor = 10 ** decimals;
  const scaled = Math.abs(target * clamp01(progress)) * factor;
  const value = (Math.sign(target) * Math.round(scaled)) / factor; // half away from zero, like formatNumber
  return value === 0 ? 0 : value; // normalizes -0 to 0
}

export const sustainDrift = (frame: number, amplitudePx: number, periodFrames: number): number =>
  Math.sin((frame / periodFrames) * 2 * Math.PI) * amplitudePx;

/** Smooth start and stop; used for rank swaps in bar races. Never overshoots. */
export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
