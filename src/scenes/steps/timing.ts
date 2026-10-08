import { pacedKnots, type PacedKnots } from "../../charts/schedule";
import { itemCueFrames } from "../../schema/emphasis";

/** Shared pacing for scenes that reveal items in spoken order (flow-diagram steps, ledger rows). */
export const STEPS = { start: 10, share: 0.7, minFrames: 30, minSegment: 8, settle: 16 } as const;

/** Item i is reached on its emphasize cue's frame; items must be spoken in order. */
export function stepPlan(cueFrames: readonly number[], durationFrames: number, noun: string): PacedKnots {
  const n = cueFrames.length;
  const defaultEnd = STEPS.start + Math.max(STEPS.minFrames, Math.round(durationFrames * STEPS.share) - STEPS.start);
  return pacedKnots(
    cueFrames.map((frame, i) => ({ frame, progress: n === 1 ? 1 : i / (n - 1) })),
    {
      startFrame: STEPS.start,
      defaultEnd,
      minSegment: STEPS.minSegment,
      orderError: (i) => `${noun}s must be spoken in order (${noun} ${i + 1} is spoken before an earlier one)`,
    },
  );
}

export const stepCueFrames = (items: readonly string[], cues: readonly { frame: number; do: string; text?: string }[]): number[] =>
  itemCueFrames(items, cues);

/** Last frame the scene is still animating: the final item lands and settles. */
export const stepsDoneFrame = (plan: PacedKnots): number =>
  Math.max(plan.knots[plan.knots.length - 1].frame, Math.max(...plan.frames) + STEPS.settle);

/** Frames a ledger line takes to be written in, left to right. */
export const WRITE_FRAMES = 14;

/** A ledger page is done when its last row settles and, if it has one, the total is written. */
export const ledgerDoneFrame = (plan: PacedKnots, hasTotal: boolean): number =>
  stepsDoneFrame(plan) + (hasTotal ? 8 + WRITE_FRAMES : WRITE_FRAMES);
