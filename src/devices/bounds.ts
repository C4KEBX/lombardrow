import { formatYear } from "../design/layout";
import { DEVICES, VIDEO } from "../design/tokens";
import type { StampSpan, YearSpan } from "./tracks";

export type Box = { name: string; x: number; y: number; width: number; height: number };

export class DeviceBoundsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeviceBoundsError";
  }
}

const D = DEVICES.devices;
const ZONE = DEVICES.platform_zones;
/** Average advance per character in em, measured from the bundled fonts (with a margin). */
const CASLON_EM = 0.62;
const INTER_EM = 0.56;

/**
 * Bounding boxes of every device as this video will draw them. Text widths are estimated from the
 * measured font metrics plus tracking, so the check errs on the side of failing.
 */
export function deviceBoxes(input: { doorNo: number; series: string; years: readonly YearSpan[]; stamps: readonly StampSpan[] }): Box[] {
  const boxes: Box[] = [
    { name: "door plate", x: D.door_plate.plate.x, y: D.door_plate.plate.y, width: D.door_plate.plate.width, height: D.door_plate.plate.height },
  ];
  const wm = D.door_plate.wordmark;
  const wmWidth = "LOMBARD ROW".length * wm.size * (CASLON_EM + wm.tracking_em);
  boxes.push({ name: "wordmark", x: wm.center_x - wmWidth / 2, y: wm.y, width: wmWidth, height: wm.size + 14 + wm.rule_height + 14 + wm.signoff_size * 1.2 });
  const yc = D.year_counter;
  for (const span of input.years) {
    const widest = Math.max(formatYear(span.from).length, formatYear(span.to).length);
    boxes.push({
      name: `year counter (${formatYear(span.to)})`, x: yc.x, y: yc.y,
      width: Math.max(widest * yc.number.size * CASLON_EM, yc.rule.width), height: yc.number.size + yc.rule.gap + yc.rule.height,
    });
  }
  const st = D.source_stamp;
  for (const span of input.stamps) {
    boxes.push({ name: `source stamp "${span.text}"`, x: st.x, y: st.y, width: span.text.length * st.size * INTER_EM, height: st.size * 1.2 });
  }
  return boxes;
}

/** Fails the render when any device's box enters the bottom or right platform zone (or leaves the canvas). */
export function assertDevicesInBounds(boxes: readonly Box[]): void {
  for (const b of boxes) {
    const right = b.x + b.width;
    const bottom = b.y + b.height;
    if (b.x < 0 || b.y < 0 || right > VIDEO.width || bottom > VIDEO.height) {
      throw new DeviceBoundsError(`The ${b.name} leaves the canvas`);
    }
    if (right > ZONE.right.x) {
      throw new DeviceBoundsError(`The ${b.name} reaches x ${Math.round(right)}, into the right platform zone (from x ${ZONE.right.x}); shorten its text`);
    }
    if (bottom > ZONE.bottom.y) {
      throw new DeviceBoundsError(`The ${b.name} reaches y ${Math.round(bottom)}, into the bottom platform zone (from y ${ZONE.bottom.y})`);
    }
  }
}
