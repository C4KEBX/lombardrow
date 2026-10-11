import { CAPTION_LANE, CONTENT } from "../../design/tokens";

/** Steps stack top to bottom between the title and the caption lane. */
export const FLOW_LAYOUT = {
  top: 300,
  bottom: CAPTION_LANE.top - 60,
  boxHeight: 128,
  left: CONTENT.left,
  width: CONTENT.width - 120,
  label: 50,
  note: 32,
  arrowText: 38,
} as const;

/** Top of step i of n: evenly spread, never closer than the box plus room for an arrow. */
export function flowStepY(i: number, n: number): number {
  const { top, bottom, boxHeight } = FLOW_LAYOUT;
  const pitch = n === 1 ? 0 : Math.min(260, (bottom - top - boxHeight) / (n - 1));
  return top + i * pitch;
}
