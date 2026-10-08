import { fitFontSize } from "../design/layout";
import { CONTENT, DEVICES } from "../design/tokens";

/** The plot area. Its bottom edge is the ledger line's y (devices.json), so the open's rule becomes the axis. */
export const CHART_BOX = {
  left: CONTENT.left,
  right: CONTENT.right,
  top: 600,
  bottom: DEVICES.devices.ledger_line.rule.y,
} as const;

/** Callout tag metrics. charPx matches Inter 600 at fontPx (about 0.68em per char, capitals included). */
export const BADGE = { charPx: 30, padPx: 28, heightPx: 84, offsetPx: 90, fontPx: 44 } as const;

export type PlacedBadge = { x: number; y: number; width: number; above: boolean };

export const badgeWidth = (text: string): number => text.length * BADGE.charPx + 2 * BADGE.padPx;

/** Centers a badge above (or below, if there is no room) its anchor, kept inside the side gutters. */
export function placeBadge(anchorX: number, anchorY: number, text: string, minY = 520): PlacedBadge {
  const width = badgeWidth(text);
  const half = width / 2;
  const x = Math.min(CHART_BOX.right - half, Math.max(CHART_BOX.left + half, anchorX));
  const above = anchorY - BADGE.offsetPx - BADGE.heightPx / 2 >= minY;
  return { x, y: above ? anchorY - BADGE.offsetPx : anchorY + BADGE.offsetPx, width, above };
}

/** Font size for a value that counts through `values`: fitted to the widest formatted value. */
export function readoutFontSize(
  values: readonly number[],
  format: (value: number) => string,
  laneWidthPx: number,
  maxSizePx: number,
): number {
  const widest = values.map(format).reduce((a, b) => (b.length > a.length ? b : a), "");
  return fitFontSize(widest, laneWidthPx, maxSizePx);
}
