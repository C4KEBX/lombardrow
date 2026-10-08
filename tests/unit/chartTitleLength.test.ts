import { describe, expect, it } from "vitest";
import { parseStoryboard, StoryboardError } from "../../src/schema/storyboard";

const board = (scene: unknown) =>
  parseStoryboard({
    schemaVersion: 1,
    meta: { title: "t", theme: "lombard-row", voice: "v" },
    audio: { music: null },
    scenes: [scene],
  });
const line = (title: string) => ({
  id: "c", type: "line-chart", narration: "x",
  props: { title, points: [{ x: 1, y: 1 }, { x: 2, y: 2 }], factId: "f1" },
});
const race = (title: string) => ({
  id: "r", type: "bar-race", narration: "x",
  props: {
    title, factId: "f1",
    frames: [
      { label: "a", values: [{ name: "A", value: 1 }, { name: "B", value: 2 }] },
      { label: "b", values: [{ name: "A", value: 2 }, { name: "B", value: 3 }] },
    ],
  },
});

describe("chart titles must fit on one line (32 characters)", () => {
  it("accepts 32 characters and rejects 33 on both chart types", () => {
    expect(() => board(line("x".repeat(32)))).not.toThrow();
    expect(() => board(line("x".repeat(33)))).toThrow(StoryboardError);
    expect(() => board(race("x".repeat(32)))).not.toThrow();
    expect(() => board(race("x".repeat(33)))).toThrow(StoryboardError);
  });
});
