import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { diffRatio } from "../../src/testing/imageDiff";

const solid = (w: number, h: number, rgb: [number, number, number]): PNG => {
  const png = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i += 1) {
    png.data[i * 4] = rgb[0];
    png.data[i * 4 + 1] = rgb[1];
    png.data[i * 4 + 2] = rgb[2];
    png.data[i * 4 + 3] = 255;
  }
  return png;
};

describe("diffRatio", () => {
  it("is 0 for identical images", () => {
    expect(diffRatio(solid(10, 10, [1, 2, 3]), solid(10, 10, [1, 2, 3]))).toBe(0);
  });
  it("is 1 for completely different images", () => {
    expect(diffRatio(solid(10, 10, [0, 0, 0]), solid(10, 10, [255, 255, 255]))).toBe(1);
  });
  it("ignores tiny antialiasing-level differences", () => {
    expect(diffRatio(solid(10, 10, [100, 100, 100]), solid(10, 10, [102, 100, 100]))).toBe(0);
  });
  it("is 1 when the sizes differ", () => {
    expect(diffRatio(solid(10, 10, [0, 0, 0]), solid(10, 12, [0, 0, 0]))).toBe(1);
  });
  it("measures the changed fraction", () => {
    const a = solid(10, 10, [0, 0, 0]);
    const b = solid(10, 10, [0, 0, 0]);
    for (let i = 0; i < 10; i += 1) b.data[i * 4] = 255; // first 10 of 100 pixels
    expect(diffRatio(a, b)).toBeCloseTo(0.1, 5);
  });
});
