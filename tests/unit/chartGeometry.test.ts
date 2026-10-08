import { describe, expect, it } from "vitest";
import {
  cursorX, decimalsForStep, niceTicks, pointOnPathAtX, reachedValueAtX, valueAtX, visibleMax, yDomainAt,
  type DataPoint,
} from "../../src/charts/geometry";

const pts: DataPoint[] = [{ x: 2000, y: 10 }, { x: 2001, y: 20 }, { x: 2002, y: 40 }];

describe("cursorX", () => {
  it("maps progress onto the x range and clamps", () => {
    expect(cursorX(pts, 0)).toBe(2000);
    expect(cursorX(pts, 0.5)).toBe(2001);
    expect(cursorX(pts, 1)).toBe(2002);
    expect(cursorX(pts, -1)).toBe(2000);
    expect(cursorX(pts, 2)).toBe(2002);
  });
});

describe("reachedValueAtX", () => {
  it("holds the last data point reached, never an in-between value", () => {
    const p = [{ x: 0, y: 1000 }, { x: 9, y: 1999 }, { x: 18, y: 3996 }];
    expect(reachedValueAtX(p, -1)).toBe(1000);
    expect(reachedValueAtX(p, 8.99)).toBe(1000);
    expect(reachedValueAtX(p, 9)).toBe(1999);
    expect(reachedValueAtX(p, 12)).toBe(1999);
    expect(reachedValueAtX(p, 18)).toBe(3996);
    expect(reachedValueAtX(p, 30)).toBe(3996);
  });
});

describe("valueAtX", () => {
  it("interpolates linearly and clamps to the ends", () => {
    expect(valueAtX(pts, 2000.5)).toBe(15);
    expect(valueAtX(pts, 2001)).toBe(20);
    expect(valueAtX(pts, 1999)).toBe(10);
    expect(valueAtX(pts, 3000)).toBe(40);
  });
});

describe("visibleMax", () => {
  it("includes the interpolated tip", () => {
    expect(visibleMax(pts, 2000.5)).toBe(15);
    expect(visibleMax(pts, 2002)).toBe(40);
  });
});

describe("yDomainAt", () => {
  it("starts small and grows to fit the data (zero baseline)", () => {
    const [lo0, hi0] = yDomainAt(pts, 0, "zero");
    expect(lo0).toBe(0);
    expect(hi0).toBeCloseTo(11.2, 6);
    const [, hi1] = yDomainAt(pts, 1, "zero");
    expect(hi1).toBeCloseTo(44.8, 6);
  });
  it("never shrinks as progress increases", () => {
    let prev = -Infinity;
    for (let p = 0; p <= 1; p += 0.02) {
      const [, hi] = yDomainAt(pts, p, "zero");
      expect(hi).toBeGreaterThanOrEqual(prev);
      prev = hi;
    }
  });
  it("keeps a minimum span so an early tiny value does not make a razor-thin axis", () => {
    const [lo, hi] = yDomainAt([{ x: 0, y: 1 }, { x: 1, y: 100 }], 0, "zero");
    expect(lo).toBe(0);
    expect(hi).toBeCloseTo(28, 6);
  });
  it("pads below the data minimum for the data baseline", () => {
    const [lo, hi] = yDomainAt(pts, 1, "data");
    expect(lo).toBeCloseTo(7, 6);
    expect(hi).toBeCloseTo(43.96, 6);
  });
  it("handles flat, all-zero and negative series without NaN or a collapsed axis", () => {
    const cases: DataPoint[][] = [
      [{ x: 0, y: 5 }, { x: 1, y: 5 }],
      [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      [{ x: 0, y: -5 }, { x: 1, y: -3 }],
      [{ x: 0, y: 1e9 }, { x: 1, y: 3e9 }],
    ];
    for (const series of cases) {
      for (const baseline of ["zero", "data"] as const) {
        for (const p of [0, 0.5, 1]) {
          const [lo, hi] = yDomainAt(series, p, baseline);
          expect(Number.isFinite(lo) && Number.isFinite(hi)).toBe(true);
          expect(hi).toBeGreaterThan(lo);
        }
      }
    }
  });
});

describe("niceTicks / decimalsForStep", () => {
  it("returns round tick values inside the domain", () => {
    expect(niceTicks([0, 100], 5)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(niceTicks([0, 11.2], 4)).toEqual([0, 2, 4, 6, 8, 10]);
  });
  it("derives label decimals from the tick step so labels never duplicate", () => {
    expect(decimalsForStep(20)).toBe(0);
    expect(decimalsForStep(1)).toBe(0);
    expect(decimalsForStep(0.5)).toBe(1);
    expect(decimalsForStep(0.05)).toBe(2);
    expect(decimalsForStep(0.00001)).toBe(4);
    expect(decimalsForStep(Number.NaN)).toBe(0);
  });
});

describe("pointOnPathAtX", () => {
  it("finds the point on a path at a given x", () => {
    const p = pointOnPathAtX("M0,0 L100,100", 50);
    expect(p.x).toBeCloseTo(50, 2);
    expect(p.y).toBeCloseTo(50, 2);
  });
  it("clamps to the path ends", () => {
    const end = pointOnPathAtX("M0,0 L100,100", 500);
    expect(end.x).toBeCloseTo(100, 2);
    const start = pointOnPathAtX("M0,0 L100,100", -5);
    expect(start.x).toBeCloseTo(0, 2);
  });
});
