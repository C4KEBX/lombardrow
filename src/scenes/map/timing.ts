import { itemCueFrames } from "../../schema/emphasis";

export const MAP = { zoomFrames: 70, settle: 12 } as const;

/** Frame each region lights up: the cue that names it, in region order. */
export const regionCueFrames = (
  regions: readonly string[],
  cues: readonly { frame: number; do: string; text?: string }[],
): number[] => itemCueFrames(regions, cues);
