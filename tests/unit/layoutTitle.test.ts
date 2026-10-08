import { describe, expect, it } from "vitest";
import { DISPLAY_CHAR_WIDTH_EM, QUOTE_WORD_GAP_EM, TITLE_WORD_GAP_EM, fitTitleFontSize } from "../../src/design/layout";

const LANE_W = 960;
const LANE_H = 1240;

describe("fitTitleFontSize", () => {
  it("keeps the max size when the headline fits", () => {
    expect(fitTitleFontSize("The S&P 500 in 2008", LANE_W, LANE_H, 190)).toBe(190);
  });
  it("shrinks long headlines so the wrapped block fits the lane height", () => {
    const long = Array.from({ length: 20 }, () => "gold").join(" ");
    const size = fitTitleFontSize(long, LANE_W, LANE_H, 190);
    expect(size).toBeLessThan(190);
    expect(size).toBeGreaterThanOrEqual(64);
  });
  it("shrinks so the longest word fits the lane width", () => {
    const size = fitTitleFontSize("Bankruptcies", LANE_W, LANE_H, 190);
    expect("Bankruptcies".length * size * DISPLAY_CHAR_WIDTH_EM).toBeLessThanOrEqual(LANE_W);
  });
  it("throws when even the minimum size cannot fit", () => {
    expect(() => fitTitleFontSize("Pneumonoultramicroscopicsilicovolcanoconiosis", LANE_W, LANE_H, 190)).toThrow(RangeError);
  });
});

describe("word gap parameter", () => {
  it("a wider gap never fits a larger size and can force a smaller one", () => {
    const text = Array.from({ length: 12 }, () => "word").join(" ");
    const base = fitTitleFontSize(text, 960, 700, 190);
    const wide = fitTitleFontSize(text, 960, 700, 190, undefined, 0.6);
    expect(wide).toBeLessThanOrEqual(base);
    expect(QUOTE_WORD_GAP_EM).toBeGreaterThan(TITLE_WORD_GAP_EM);
  });
});

describe("word gap shared by fit and render", () => {
  it("is exported so every scene that wraps title-style text renders the gap the fit check assumed", () => {
    expect(TITLE_WORD_GAP_EM).toBe(0.15);
  });
});
