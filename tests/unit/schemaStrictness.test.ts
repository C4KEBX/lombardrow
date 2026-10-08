import { describe, expect, it } from "vitest";
import { parseFacts } from "../../src/schema/facts";
import { parseStoryboard, StoryboardError } from "../../src/schema/storyboard";

const base = () => ({
  schemaVersion: 1,
  meta: { title: "T", theme: "lombard-row", voice: "v" },
  audio: { music: null },
  scenes: [
    {
      id: "n1", type: "big-number", narration: "It lost half.",
      props: { value: 57, label: "drop", factId: "f1" },
      cues: [{ atWord: "half", do: "callout", text: "Half gone" }],
    },
  ],
});

describe("schema strictness", () => {
  it("rejects a misspelled cue key instead of defaulting it", () => {
    const sb = base();
    (sb.scenes[0].cues[0] as Record<string, unknown>).occurence = 2;
    expect(() => parseStoryboard(sb)).toThrow(StoryboardError);
    expect(() => parseStoryboard(sb)).toThrow(/occurence/);
  });
  it("rejects a misspelled prop key instead of defaulting it", () => {
    const sb = base();
    (sb.scenes[0].props as Record<string, unknown>).decimal = 2;
    expect(() => parseStoryboard(sb)).toThrow(/decimal/);
  });
  it("rejects unknown keys at the top level, meta, audio and scene level", () => {
    expect(() => parseStoryboard({ ...base(), extra: 1 })).toThrow(StoryboardError);
    expect(() => parseStoryboard({ ...base(), meta: { ...base().meta, voic: "x" } })).toThrow(StoryboardError);
    expect(() => parseStoryboard({ ...base(), audio: { music: null, loud: true } })).toThrow(StoryboardError);
    const sb = base();
    (sb.scenes[0] as Record<string, unknown>).narrtion = "x";
    expect(() => parseStoryboard(sb)).toThrow(StoryboardError);
  });
  it("rejects unknown keys in facts and their sources", () => {
    const fact = { id: "f1", claim: "c", value: 1, source: { name: "n", url: "https://example.com/" } };
    expect(() => parseFacts({ facts: [{ ...fact, valeu: 2 }] })).toThrow(StoryboardError);
    expect(() => parseFacts({ facts: [{ ...fact, source: { ...fact.source, link: "x" } }] })).toThrow(StoryboardError);
  });
  it("requires text on a callout cue", () => {
    const sb = base();
    delete (sb.scenes[0].cues[0] as { text?: string }).text;
    expect(() => parseStoryboard(sb)).toThrow(/text/);
  });
});
