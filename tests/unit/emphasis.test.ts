import { describe, expect, it } from "vitest";
import { emphasisTarget } from "../../src/schema/emphasis";

const lines = ["Debt is", "not the", "enemy, Risk is"];

describe("emphasisTarget", () => {
  it("finds the first matching word with its line and index", () => {
    expect(emphasisTarget(lines, "not")).toEqual({ line: 1, word: 0 });
    expect(emphasisTarget(lines, "risk")).toEqual({ line: 2, word: 1 });
  });
  it("ignores case and punctuation on either side", () => {
    expect(emphasisTarget(lines, "ENEMY")).toEqual({ line: 2, word: 0 });
    expect(emphasisTarget(["Hello, world!"], "world.")).toEqual({ line: 0, word: 1 });
  });
  it("returns the first occurrence when a word repeats", () => {
    expect(emphasisTarget(["is it", "it is"], "it")).toEqual({ line: 0, word: 1 });
  });
  it("returns null for a word that is not on screen or that normalizes to nothing", () => {
    expect(emphasisTarget(lines, "banana")).toBeNull();
    expect(emphasisTarget(lines, "—")).toBeNull();
  });
});
