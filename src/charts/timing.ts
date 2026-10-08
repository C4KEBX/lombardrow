import type { DataPoint } from "./geometry";
import { pacedKnots, type Knot } from "./schedule";

/** Frames at the end of every scene used by the exit fade. */
export const EXIT_FRAMES = 8;

export const LINE_DRAW = { start: 14, share: 0.7, minFrames: 30 } as const;
export const RACE_RUN = { start: 10, share: 0.8, minFrames: 40 } as const;

/** Least frames the line may spend travelling between two callouts (prevents a teleporting cursor). */
export const LINE_DRAW_MIN_SEGMENT = 6;

export const lineDrawFrames = (durationFrames: number): number =>
  Math.max(LINE_DRAW.minFrames, Math.round(durationFrames * LINE_DRAW.share) - LINE_DRAW.start);

export const raceRunFrames = (durationFrames: number): number =>
  Math.max(RACE_RUN.minFrames, Math.round(durationFrames * RACE_RUN.share) - RACE_RUN.start);

export type CalloutAnchor = { frame: number; x: number };
export type DrawPlan = { knots: Knot[]; appear: number[] };

/**
 * Pacing for a line draw: the cursor sits on each callout's x on the frame that callout appears,
 * which is its cue frame (pushed later only when the line could not otherwise get there without
 * jumping). `appear[i]` belongs to `callouts[i]`. Callouts must run left to right in spoken order.
 */
export function drawPlan(
  callouts: readonly CalloutAnchor[],
  points: readonly DataPoint[],
  durationFrames: number,
): DrawPlan {
  const first = points[0].x;
  const span = points[points.length - 1].x - first;
  const { knots, frames } = pacedKnots(
    callouts.map((c) => ({ frame: c.frame, progress: (c.x - first) / span })),
    {
      startFrame: LINE_DRAW.start,
      defaultEnd: LINE_DRAW.start + lineDrawFrames(durationFrames),
      minSegment: LINE_DRAW_MIN_SEGMENT,
      orderError: (i) =>
        `callout cues must run left to right in spoken order (x ${callouts[i].x} is spoken after a callout further right)`,
    },
  );
  return { knots, appear: frames };
}
