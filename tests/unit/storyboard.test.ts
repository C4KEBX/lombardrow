import { describe, expect, it } from "vitest";
import { parseStoryboard, StoryboardError } from "../../src/schema/storyboard";

const valid = () => ({
  schemaVersion: 1,
  meta: { title: "Test", theme: "lombard-row", doorNo: 1, series: "How it works", voice: "en-US-AndrewNeural" },
  audio: { music: null },
  scenes: [
    { id: "intro", type: "title", narration: "Hello there.", props: { headline: "Hello" } },
    {
      id: "n1", type: "big-number", narration: "It lost half.",
      props: { value: 57, suffix: "%", label: "drop", factId: "f1" },
      cues: [{ atWord: "half", do: "callout", text: "Half gone" }],
    },
  ],
});

describe("parseStoryboard", () => {
  it("accepts a valid storyboard and applies defaults", () => {
    const sb = parseStoryboard(valid());
    expect(sb.scenes[0].cues).toEqual([]);
    const n = sb.scenes[1];
    if (n.type !== "big-number") throw new Error("expected big-number");
    expect(n.props).toMatchObject({ prefix: "", suffix: "%", decimals: 0, tone: "highlight" });
    expect(n.cues[0].occurrence).toBe(1);
  });

  it("does not mutate its input", () => {
    const input = valid();
    const snapshot = JSON.stringify(input);
    parseStoryboard(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("rejects an unknown scene type", () => {
    const bad = valid();
    (bad.scenes[0] as { type: string }).type = "hologram";
    expect(() => parseStoryboard(bad)).toThrow(StoryboardError);
  });

  it("rejects a wrong schema version", () => {
    expect(() => parseStoryboard({ ...valid(), schemaVersion: 2 })).toThrow(StoryboardError);
  });

  it("rejects empty narration and empty scene list", () => {
    const a = valid();
    a.scenes[0].narration = "";
    expect(() => parseStoryboard(a)).toThrow(StoryboardError);
    expect(() => parseStoryboard({ ...valid(), scenes: [] })).toThrow(StoryboardError);
  });

  it("rejects NaN and Infinity values", () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      const sb = valid();
      (sb.scenes[1].props as { value: number }).value = bad;
      expect(() => parseStoryboard(sb)).toThrow(StoryboardError);
    }
  });

  it("rejects bad scene ids and out-of-range decimals", () => {
    const a = valid();
    a.scenes[0].id = "Has Spaces";
    expect(() => parseStoryboard(a)).toThrow(StoryboardError);
    const b = valid();
    (b.scenes[1].props as { decimals?: number }).decimals = 9;
    expect(() => parseStoryboard(b)).toThrow(StoryboardError);
  });

  it("rejects duplicate scene ids with a readable message", () => {
    const a = valid();
    a.scenes[1].id = "intro";
    expect(() => parseStoryboard(a)).toThrow(/duplicate scene id "intro"/i);
  });

  it("produces a human-readable error message", () => {
    expect(() => parseStoryboard({})).toThrow(/schemaVersion|meta|scenes/);
  });
});
