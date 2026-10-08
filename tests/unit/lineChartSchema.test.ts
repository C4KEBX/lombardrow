import { describe, expect, it } from "vitest";
import { parseFacts } from "../../src/schema/facts";
import { parseStoryboard, StoryboardError } from "../../src/schema/storyboard";

const scene = (props: Record<string, unknown> = {}, cues: unknown[] = []) => ({
  id: "c1", type: "line-chart", narration: "It rose.", cues,
  props: { title: "T", points: [{ x: 2000, y: 1 }, { x: 2001, y: 2 }], factId: "f1", ...props },
});
const board = (s: unknown) =>
  parseStoryboard({
    schemaVersion: 1,
    meta: { title: "t", theme: "lombard-row", doorNo: 1, series: "How it works", voice: "v" },
    audio: { music: null },
    scenes: [s],
  });

describe("line-chart schema", () => {
  it("parses and applies defaults", () => {
    const sc = board(scene()).scenes[0];
    if (sc.type !== "line-chart") throw new Error("expected line-chart");
    expect(sc.props).toMatchObject({
      xFormat: "number", baseline: "zero", tone: "highlight", decimals: 0, prefix: "", suffix: "",
    });
  });
  it("rejects fewer than 2 points and more than 60", () => {
    expect(() => board(scene({ points: [{ x: 1, y: 1 }] }))).toThrow(StoryboardError);
    const many = Array.from({ length: 61 }, (_, i) => ({ x: i, y: i }));
    expect(() => board(scene({ points: many }))).toThrow(StoryboardError);
  });
  it("rejects non-increasing and duplicate x with a readable message", () => {
    expect(() => board(scene({ points: [{ x: 2, y: 1 }, { x: 1, y: 2 }] }))).toThrow(/increasing/);
    expect(() => board(scene({ points: [{ x: 1, y: 1 }, { x: 1, y: 2 }] }))).toThrow(/increasing/);
  });
  it("rejects NaN and Infinity coordinates", () => {
    expect(() => board(scene({ points: [{ x: 1, y: NaN }, { x: 2, y: 2 }] }))).toThrow(StoryboardError);
    expect(() => board(scene({ points: [{ x: 1, y: 1 }, { x: 2, y: Infinity }] }))).toThrow(StoryboardError);
  });
  it("rejects unknown props and point keys", () => {
    expect(() => board(scene({ colour: "red" }))).toThrow(StoryboardError);
    expect(() => board(scene({ points: [{ x: 1, y: 1, z: 3 }, { x: 2, y: 2 }] }))).toThrow(StoryboardError);
  });
  it("accepts a callout with an x anchor and rejects text over 24 chars", () => {
    expect(() => board(scene({}, [{ atWord: "rose", do: "callout", text: "Up", x: 2001 }]))).not.toThrow();
    const long = "x".repeat(25);
    expect(() => board(scene({}, [{ atWord: "rose", do: "callout", text: long, x: 2001 }]))).toThrow(StoryboardError);
  });
});

describe("facts dataset", () => {
  it("accepts any JSON dataset and rejects unknown fact keys", () => {
    const fact = { id: "f1", claim: "c", dataset: [{ x: 1, y: 2 }], source: { name: "n", url: "https://example.com/" } };
    expect(parseFacts({ facts: [fact] }).facts[0].dataset).toEqual([{ x: 1, y: 2 }]);
    expect(() => parseFacts({ facts: [{ ...fact, datset: [] }] })).toThrow(StoryboardError);
  });
});
