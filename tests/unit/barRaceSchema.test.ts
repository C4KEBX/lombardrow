import { describe, expect, it } from "vitest";
import { parseStoryboard, StoryboardError } from "../../src/schema/storyboard";

const frames = [
  { label: "2020", values: [{ name: "A", value: 1 }, { name: "B", value: 2 }] },
  { label: "2021", values: [{ name: "A", value: 3 }, { name: "B", value: 2 }] },
];
const scene = (props: Record<string, unknown> = {}) => ({
  id: "r1", type: "bar-race", narration: "Race.",
  props: { title: "T", frames, factId: "f1", ...props },
});
const board = (s: unknown) =>
  parseStoryboard({
    schemaVersion: 1,
    meta: { title: "t", theme: "lombard-row", doorNo: 1, series: "How it works", voice: "v" },
    audio: { music: null },
    scenes: [s],
  });

describe("bar-race schema", () => {
  it("parses with defaults", () => {
    const sc = board(scene()).scenes[0];
    if (sc.type !== "bar-race") throw new Error("expected bar-race");
    expect(sc.props).toMatchObject({ topN: 5, decimals: 0, prefix: "", suffix: "" });
  });
  it("rejects fewer than 2 frames, fewer than 2 values, and out-of-range topN", () => {
    expect(() => board(scene({ frames: [frames[0]] }))).toThrow(StoryboardError);
    expect(() => board(scene({ frames: [{ label: "a", values: [{ name: "A", value: 1 }] }, frames[1]] }))).toThrow(StoryboardError);
    expect(() => board(scene({ topN: 2 }))).toThrow(StoryboardError);
    expect(() => board(scene({ topN: 9 }))).toThrow(StoryboardError);
  });
  it("rejects negative, NaN and Infinity values", () => {
    for (const bad of [-1, NaN, Infinity]) {
      const f = [{ label: "a", values: [{ name: "A", value: bad }, { name: "B", value: 1 }] }, frames[1]];
      expect(() => board(scene({ frames: f }))).toThrow(StoryboardError);
    }
  });
  it("rejects duplicate frame labels and duplicate names within a frame", () => {
    expect(() => board(scene({ frames: [frames[0], { ...frames[1], label: "2020" }] }))).toThrow(/duplicate frame label/);
    const dup = [{ label: "a", values: [{ name: "A", value: 1 }, { name: "A", value: 2 }] }, frames[1]];
    expect(() => board(scene({ frames: dup }))).toThrow(/duplicate name/);
  });
  it("rejects names over 18 characters", () => {
    const long = [{ label: "a", values: [{ name: "x".repeat(19), value: 1 }, { name: "B", value: 1 }] }, frames[1]];
    expect(() => board(scene({ frames: long }))).toThrow(StoryboardError);
  });
  it("rejects more than 8 distinct entity names across frames (one color each)", () => {
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ name: `E${i}`, value: i + 1 }));
    const nine = [{ label: "a", values: many(9).slice(0, 8) }, { label: "b", values: many(9).slice(1, 9) }];
    expect(() => board(scene({ frames: nine }))).toThrow(/at most 8 distinct/);
    const eight = [{ label: "a", values: many(8) }, { label: "b", values: many(8) }];
    expect(() => board(scene({ frames: eight }))).not.toThrow();
  });
});
