import { describe, expect, it } from "vitest";
import { countUp } from "../../src/design/motion";

describe("countUp rounds symmetrically (half away from zero), like formatNumber", () => {
  it("rounds negative halves away from zero", () => {
    expect(countUp(-2.5, 1, 0)).toBe(-3);
    expect(countUp(-1.25, 1, 1)).toBe(-1.3);
    expect(countUp(-0.5, 1, 0)).toBe(-1);
  });
  it("matches positive behavior", () => {
    expect(countUp(2.5, 1, 0)).toBe(3);
    expect(countUp(1.25, 1, 1)).toBe(1.3);
  });
});
