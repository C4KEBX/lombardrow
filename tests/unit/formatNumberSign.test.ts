import { describe, expect, it } from "vitest";
import { formatNumber } from "../../src/design/layout";

describe("formatNumber never shows negative zero", () => {
  it("drops the sign when rounding produces zero", () => {
    expect(formatNumber(-0.001, 0)).toBe("0");
    expect(formatNumber(-0.04, 1)).toBe("0.0");
    expect(formatNumber(-0, 0)).toBe("0");
  });
  it("keeps the sign on real negatives", () => {
    expect(formatNumber(-57, 0)).toBe("-57");
    expect(formatNumber(-0.5, 1)).toBe("-0.5");
  });
});
