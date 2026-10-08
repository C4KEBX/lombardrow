import { pacedKnots, type PacedKnots } from "../../charts/schedule";
import { itemCueFrames } from "../../schema/emphasis";

export const TIMELINE = { start: 12, share: 0.7, minFrames: 30, minSegment: 6, settle: 14 } as const;

const defaultEnd = (durationFrames: number): number =>
  TIMELINE.start + Math.max(TIMELINE.minFrames, Math.round(durationFrames * TIMELINE.share) - TIMELINE.start);

/** Spine schedule: the cursor stands on event i on that event's cue frame. Events must be spoken in order. */
export function timelinePlan(cueFrames: readonly number[], durationFrames: number): PacedKnots {
  const n = cueFrames.length;
  return pacedKnots(
    cueFrames.map((frame, i) => ({ frame, progress: i / (n - 1) })),
    {
      startFrame: TIMELINE.start,
      defaultEnd: defaultEnd(durationFrames),
      minSegment: TIMELINE.minSegment,
      orderError: (i) => `events must be spoken in chronological order (event ${i + 1} is spoken before an earlier one)`,
    },
  );
}

export const eventCueFramesFor = (
  events: readonly { label: string }[],
  cues: readonly { frame: number; do: string; text?: string }[],
): number[] => itemCueFrames(events.map((e) => e.label), cues);
