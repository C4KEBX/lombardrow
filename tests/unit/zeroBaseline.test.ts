import { describe, expect, it } from "vitest";
import { yDomainAt, type DataPoint } from "../../src/charts/geometry";

const negative: DataPoint[] = [{ x: 0, y: -5 }, { x: 1, y: -3 }, { x: 2, y: -4 }];
const mixed: DataPoint[] = [{ x: 0, y: -2 }, { x: 1, y: 5 }, { x: 2, y: 1 }];

describe("zero baseline always includes zero", () => {
  it("includes 0 for all-negative data at every progress", () => {
    for (let p = 0; p <= 1; p += 0.1) {
      const [lo, hi] = yDomainAt(negative, p, "zero");
      expect(lo).toBeLessThanOrEqual(-5);
      expect(hi).toBeGreaterThan(0);
    }
  });
  it("includes 0 and the full range for mixed-sign data", () => {
    const [lo, hi] = yDomainAt(mixed, 1, "zero");
    expect(lo).toBe(-2);
    expect(hi).toBeCloseTo(-2 + 7 * 1.12, 6);
    const [, hi0] = yDomainAt(mixed, 0, "zero");
    expect(hi0).toBeGreaterThan(0);
  });
  it("never shrinks as progress increases for negative data", () => {
    let prev = -Infinity;
    for (let p = 0; p <= 1; p += 0.05) {
      const [, hi] = yDomainAt(negative, p, "zero");
      expect(hi).toBeGreaterThanOrEqual(prev);
      prev = hi;
    }
  });
  it("leaves the data baseline unchanged", () => {
    const [lo] = yDomainAt(negative, 1, "data");
    expect(lo).toBeLessThan(-5);
  });
});
