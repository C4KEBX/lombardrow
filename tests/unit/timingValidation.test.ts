import { describe, expect, it } from "vitest";
import {
  CueResolutionError,
  assertValidWords,
  sceneDurationMs,
  type WordTiming,
} from "../../src/schema/timing";

const w = (text: string, startMs: number, endMs: number): WordTiming => ({ text, startMs, endMs });

describe("assertValidWords", () => {
  it("accepts ordered finite timings, including small overlaps", () => {
    expect(() => assertValidWords([w("a", 0, 120), w("b", 100, 300)])).not.toThrow();
  });
  it("rejects NaN and Infinity", () => {
    expect(() => assertValidWords([w("a", 0, NaN)])).toThrow(CueResolutionError);
    expect(() => assertValidWords([w("a", 0, Infinity)])).toThrow(CueResolutionError);
  });
  it("rejects negative starts and ends before starts", () => {
    expect(() => assertValidWords([w("a", -5, 10)])).toThrow(/"a"/);
    expect(() => assertValidWords([w("a", 100, 50)])).toThrow(/"a"/);
  });
  it("rejects out-of-order start times", () => {
    expect(() => assertValidWords([w("a", 500, 600), w("b", 100, 200)])).toThrow(/order/);
  });
});

describe("sceneDurationMs uses the latest end, not the last word's end", () => {
  it("does not cut narration off when a later word ends earlier", () => {
    expect(sceneDurationMs([w("a", 0, 5000), w("b", 100, 300)])).toBe(5000 + 200);
  });
});
