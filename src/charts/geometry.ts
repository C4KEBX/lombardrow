import { getLength, getPointAtLength } from "@remotion/paths";
import { scaleLinear } from "d3-scale";
import { clamp01 } from "../design/motion";

export type DataPoint = { x: number; y: number };
export type Domain = readonly [number, number];
export type Baseline = "zero" | "data";

const MIN_SPAN_FRACTION = 0.25; // an early tiny value never makes a razor-thin axis
const DATA_BASELINE_PAD = 0.1;
const MAX_TICK_DECIMALS = 4;
const PATH_SEARCH_STEPS = 24;

/** The x position the line has been drawn up to. Points must be sorted by x. */
export function cursorX(points: readonly DataPoint[], progress: number): number {
  const first = points[0].x;
  const last = points[points.length - 1].x;
  return first + (last - first) * clamp01(progress);
}

export function valueAtX(points: readonly DataPoint[], x: number): number {
  const first = points[0];
  const last = points[points.length - 1];
  if (x <= first.x) return first.y;
  if (x >= last.x) return last.y;
  for (let i = 1; i < points.length; i += 1) {
    const b = points[i];
    if (x <= b.x) {
      const a = points[i - 1];
      return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
    }
  }
  return last.y;
}

/**
 * The value of the last data point the cursor has reached. The readout steps from one sourced point
 * to the next instead of counting through in-between values no fact states.
 */
export function reachedValueAtX(points: readonly DataPoint[], x: number): number {
  let value = points[0].y;
  for (const p of points) {
    if (p.x <= x + 1e-9) value = p.y;
    else break;
  }
  return value;
}

export function visibleMax(points: readonly DataPoint[], x: number): number {
  let max = valueAtX(points, x);
  for (const p of points) {
    if (p.x <= x && p.y > max) max = p.y;
  }
  return max;
}

/** Y domain that grows smoothly as the line draws (running max plus headroom). */
export function yDomainAt(
  points: readonly DataPoint[],
  progress: number,
  baseline: Baseline,
  headroom = 0.12,
): Domain {
  const ys = points.map((p) => p.y);
  const dataMin = Math.min(...ys);
  const dataMax = Math.max(...ys);
  const dataSpan = dataMax - dataMin;
  const lo =
    baseline === "zero"
      ? Math.min(0, dataMin)
      : dataMin - DATA_BASELINE_PAD * (dataSpan || Math.max(Math.abs(dataMin), 1));
  // A zero baseline always includes 0, even when every value is negative.
  const top = baseline === "zero" ? Math.max(dataMax, 0) : dataMax;
  let fullSpan = top - lo;
  if (fullSpan <= 0) fullSpan = Math.max(Math.abs(top), 1);
  const tip = visibleMax(points, cursorX(points, progress));
  const visible = baseline === "zero" ? Math.max(tip, 0) : tip;
  const span = Math.max(visible - lo, MIN_SPAN_FRACTION * fullSpan);
  return [lo, lo + span * (1 + headroom)];
}

export function niceTicks(domain: Domain, count: number): number[] {
  return scaleLinear()
    .domain([domain[0], domain[1]])
    .ticks(count)
    .filter((t) => t >= domain[0] && t <= domain[1]);
}

/** Decimals needed so tick labels at this step never repeat (0.5 -> 1, 0.05 -> 2). */
export function decimalsForStep(step: number): number {
  if (!Number.isFinite(step) || step <= 0 || step >= 1) return 0;
  return Math.min(MAX_TICK_DECIMALS, Math.ceil(-Math.log10(step) - 1e-9));
}

/** Point on an x-monotonic path at a given x (bisection on path length). */
export function pointOnPathAtX(path: string, targetX: number): DataPoint {
  let lo = 0;
  let hi = getLength(path);
  const at = (length: number): DataPoint => {
    const p = getPointAtLength(path, length);
    if (!p) throw new RangeError(`path has no point at length ${length}`);
    return { x: p.x, y: p.y };
  };
  for (let i = 0; i < PATH_SEARCH_STEPS; i += 1) {
    const mid = (lo + hi) / 2;
    if (at(mid).x < targetX) lo = mid;
    else hi = mid;
  }
  return at((lo + hi) / 2);
}
