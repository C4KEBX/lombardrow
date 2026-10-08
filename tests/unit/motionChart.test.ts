import { describe, expect, it } from "vitest";
import { dataProgress, easeInOutCubic } from "../../src/design/motion";

describe("easeInOutCubic", () => {
  it("is 0 at 0, 0.5 at 0.5, 1 at 1 and clamps outside", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 10);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(-3)).toBe(0);
    expect(easeInOutCubic(4)).toBe(1);
  });
  it("is monotonic and never overshoots", () => {
    let prev = -1;
    for (let t = 0; t <= 1; t += 0.01) {
      const v = easeInOutCubic(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeLessThanOrEqual(1);
      prev = v;
    }
  });
});
