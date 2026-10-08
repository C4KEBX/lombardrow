import { describe, expect, it } from "vitest";
import {
  clamp01, countUp, dataProgress, easeOutCubic, popIn, staggerDelay, sustainDrift,
} from "../../src/design/motion";

describe("easeOutCubic (data easing)", () => {
  it("hits 0 and 1 at the ends", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });
  it("is monotonic and never overshoots 1, even for t beyond the range", () => {
    let prev = -1;
    for (let t = -0.5; t <= 2; t += 0.01) {
      const v = easeOutCubic(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(0);
      prev = v;
    }
  });
});

describe("dataProgress", () => {
  it("is 0 before start and exactly 1 after the duration", () => {
    expect(dataProgress(5, 10, 30)).toBe(0);
    expect(dataProgress(40, 10, 30)).toBe(1);
    expect(dataProgress(400, 10, 30)).toBe(1);
  });
  it("is partway in the middle", () => {
    const mid = dataProgress(25, 10, 30);
    expect(mid).toBeGreaterThan(0.5);
    expect(mid).toBeLessThan(1);
  });
  it("rejects a non-positive duration", () => {
    expect(() => dataProgress(1, 0, 0)).toThrow(RangeError);
  });
});

describe("countUp", () => {
  it("ends exactly at the target and never exceeds it", () => {
    for (const target of [57, 56.8, 1234567.89, -57]) {
      expect(countUp(target, 1, 2)).toBeCloseTo(target, 2);
      for (let p = 0; p <= 1; p += 0.05) {
        expect(Math.abs(countUp(target, p, 2))).toBeLessThanOrEqual(Math.abs(target) + 1e-9);
      }
    }
  });
  it("never produces negative zero", () => {
    expect(Object.is(countUp(-57, 0, 0), -0)).toBe(false);
    expect(Object.is(countUp(-0.001, 0.5, 0), -0)).toBe(false);
  });
  it("clamps progress outside 0..1", () => {
    expect(countUp(10, -1, 0)).toBe(0);
    expect(countUp(10, 5, 0)).toBe(10);
  });
});

describe("popIn (object spring)", () => {
  it("starts at 0, overshoots 1, and settles near 1", () => {
    expect(popIn(0, 30, 0)).toBe(0);
    const peak = Math.max(...Array.from({ length: 40 }, (_, f) => popIn(f, 30, 0)));
    expect(peak).toBeGreaterThan(1);
    expect(popIn(120, 30, 0)).toBeCloseTo(1, 2);
  });
  it("respects the delay", () => {
    expect(popIn(5, 30, 10)).toBe(0);
  });
});

describe("staggerDelay / sustainDrift / clamp01", () => {
  it("spaces items by the gap", () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(3)).toBe(12);
    expect(staggerDelay(2, 5)).toBe(10);
  });
  it("drifts within the amplitude and is periodic", () => {
    for (let f = 0; f < 200; f += 7) expect(Math.abs(sustainDrift(f, 10, 90))).toBeLessThanOrEqual(10);
    expect(sustainDrift(0, 10, 90)).toBeCloseTo(0, 6);
    expect(sustainDrift(90, 10, 90)).toBeCloseTo(0, 6);
  });
  it("clamps to 0..1", () => {
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(3)).toBe(1);
    expect(clamp01(0.4)).toBe(0.4);
  });
});
