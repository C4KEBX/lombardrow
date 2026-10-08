import { describe, expect, it } from "vitest";
import { readoutFontSize } from "../../src/charts/layout";
import { fitFontSize, formatNumber } from "../../src/design/layout";

const fmt = (v: number) => `$${formatNumber(v, 2)}`;

describe("readoutFontSize", () => {
  it("fits the widest value in the series, not just the last one", () => {
    const falling = [1234.56, 500, 99.1];
    const size = readoutFontSize(falling, fmt, 960, 220);
    expect(size).toBe(fitFontSize("$1,234.56", 960, 220));
    expect(size).toBeLessThan(fitFontSize("$99.10", 960, 220));
    for (const v of falling) expect(fmt(v).length * size * 0.75).toBeLessThanOrEqual(960);
  });
  it("uses the max size for short values", () => {
    expect(readoutFontSize([1, 2, 3], (v) => String(v), 960, 220)).toBe(220);
  });
  it("accounts for negative signs", () => {
    const size = readoutFontSize([-1234.56, 5], fmt, 960, 220);
    expect(size).toBe(fitFontSize(fmt(-1234.56), 960, 220));
  });
});
