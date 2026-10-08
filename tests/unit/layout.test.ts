import { describe, expect, it } from "vitest";
import { fitFontSize, formatNumber } from "../../src/design/layout";

describe("fitFontSize", () => {
  it("uses the max size for short text", () => {
    expect(fitFontSize("57%", 960, 340)).toBe(340);
  });
  it("shrinks long text so it fits the lane", () => {
    const text = "-$1,234,567.89";
    const size = fitFontSize(text, 960, 340);
    expect(size).toBeLessThan(340);
    expect(text.length * size * 0.68).toBeLessThanOrEqual(960);
  });
  it("handles empty text and rejects bad bounds", () => {
    expect(fitFontSize("", 960, 340)).toBe(340);
    expect(() => fitFontSize("x", 0, 340)).toThrow(RangeError);
    expect(() => fitFontSize("x", 960, -1)).toThrow(RangeError);
  });
});

describe("formatNumber", () => {
  it("groups thousands and fixes decimals", () => {
    expect(formatNumber(1234567.891, 2)).toBe("1,234,567.89");
    expect(formatNumber(57, 0)).toBe("57");
    expect(formatNumber(56.8, 1)).toBe("56.8");
  });
  it("never renders negative zero", () => {
    expect(formatNumber(-0, 0)).toBe("0");
  });
  it("keeps the sign of real negatives", () => {
    expect(formatNumber(-57, 0)).toBe("-57");
  });
});
