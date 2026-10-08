import { DISPLAY_CHAR_WIDTH_EM, fitFontSize } from "../../design/layout";
import { KINETIC_LANE } from "../../design/tokens";

export const KINETIC = { firstDelay: 4, lineGap: 8, settle: 18, lineHeight: 1.08 } as const;

/** Frames until the last line has settled. */
export const kineticRevealFrames = (lineCount: number): number =>
  KINETIC.firstDelay + (lineCount - 1) * KINETIC.lineGap + KINETIC.settle;

/** One font size for all lines: the widest line fills the lane width, all lines fit its height. */
export function kineticFontSize(
  lines: readonly string[],
  lane: { width: number; height: number; maxFont: number } = KINETIC_LANE,
): number {
  const widest = lines.reduce((a, l) => (l.length > a.length ? l : a), "");
  const byWidth = fitFontSize(widest, lane.width, lane.maxFont, DISPLAY_CHAR_WIDTH_EM);
  const byHeight = Math.floor(lane.height / (lines.length * KINETIC.lineHeight));
  return Math.min(byWidth, byHeight);
}
