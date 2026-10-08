import { BADGE, CHART_BOX, type PlacedBadge } from "./layout";

export type Rect = { x: number; y: number; width: number; height: number };

/** The tag is flat (no shadow, no tilt); the margin keeps tick labels from touching its border. */
const SHADOW_PX = 0;
const TILT_MARGIN_PX = 4;
export const TICK_FONT_PX = 30;
const TICK_CHAR_EM = 0.6;

export const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** The tag's body plus a small margin. */
export const badgeRect = (badge: PlacedBadge): Rect => ({
  x: badge.x - badge.width / 2 - TILT_MARGIN_PX,
  y: badge.y - BADGE.heightPx / 2 - TILT_MARGIN_PX,
  width: badge.width + SHADOW_PX + 2 * TILT_MARGIN_PX,
  height: BADGE.heightPx + SHADOW_PX + 2 * TILT_MARGIN_PX,
});

/** A y tick label sits at the chart's left edge, just above its gridline (baseline y - 12). */
export const tickLabelRect = (gridY: number, text: string): Rect => ({
  x: CHART_BOX.left,
  y: gridY - 12 - TICK_FONT_PX,
  width: text.length * TICK_CHAR_EM * TICK_FONT_PX,
  height: TICK_FONT_PX + 12,
});
