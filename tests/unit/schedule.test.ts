import { describe, expect, it } from "vitest";
import { scheduleProgress, type Knot } from "../../src/charts/schedule";

const knots: Knot[] = [
  { frame: 14, progress: 0 },
  { frame: 30, progress: 0.1 },
  { frame: 90, progress: 0.8 },
  { frame: 120, progress: 0.8 }, // flat segment
  { frame: 150, progress: 1 },
];

describe("scheduleProgress", () => {
  it("passes exactly through every knot", () => {
    for (const k of knots) expect(scheduleProgress(k.frame, knots)).toBeCloseTo(k.progress, 12);
  });
  it("holds the first value before the start and the last value after the end", () => {
    expect(scheduleProgress(-5, knots)).toBe(0);
    expect(scheduleProgress(500, knots)).toBe(1);
  });
  it("never moves backwards and never leaves [0, 1] (sampled every frame)", () => {
    let prev = 0;
    for (let f = 0; f <= 160; f += 1) {
      const p = scheduleProgress(f, knots);
      expect(p).toBeGreaterThanOrEqual(prev - 1e-12);
      expect(p).toBeLessThanOrEqual(1);
      prev = p;
    }
  });
  it("stays flat across a flat segment", () => {
    expect(scheduleProgress(105, knots)).toBeCloseTo(0.8, 12);
  });
  it("has continuous speed through an interior knot (no jolt at a callout)", () => {
    const e = 1e-4;
    const left = (scheduleProgress(30, knots) - scheduleProgress(30 - e, knots)) / e;
    const right = (scheduleProgress(30 + e, knots) - scheduleProgress(30, knots)) / e;
    expect(Math.abs(left - right)).toBeLessThan(1e-3);
  });
  it("is an ease-out (1 - (1 - t)^2) on a single segment and settles with zero speed", () => {
    const one: Knot[] = [{ frame: 10, progress: 0 }, { frame: 50, progress: 1 }];
    for (const t of [0.1, 0.25, 0.5, 0.9]) {
      expect(scheduleProgress(10 + 40 * t, one)).toBeCloseTo(1 - (1 - t) ** 2, 10);
    }
    expect(scheduleProgress(50, one) - scheduleProgress(49.999, one)).toBeLessThan(1e-4);
  });
  it("rejects fewer than two knots, repeated frames and falling progress", () => {
    expect(() => scheduleProgress(1, [{ frame: 1, progress: 0 }])).toThrow(RangeError);
    expect(() => scheduleProgress(1, [{ frame: 1, progress: 0 }, { frame: 1, progress: 1 }])).toThrow(RangeError);
    expect(() => scheduleProgress(1, [{ frame: 1, progress: 0.5 }, { frame: 9, progress: 0.2 }])).toThrow(RangeError);
  });
});
