import { describe, expect, it } from "vitest";
import { deepEqual } from "../../src/schema/deepEqual";

describe("deepEqual", () => {
  it("compares primitives, arrays and objects", () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual("a", "b")).toBe(false);
    expect(deepEqual([1, 2], [1, 2])).toBe(true);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(null, 0)).toBe(false);
  });
  it("ignores object key order", () => {
    expect(deepEqual({ x: 1, y: 2 }, { y: 2, x: 1 })).toBe(true);
  });
  it("detects nested differences and extra or missing keys", () => {
    expect(deepEqual([{ x: 1, y: 2 }], [{ x: 1, y: 3 }])).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });
  it("does not treat an array and an object as equal", () => {
    expect(deepEqual([], {})).toBe(false);
    expect(deepEqual({ 0: 1 }, [1])).toBe(false);
  });
});
