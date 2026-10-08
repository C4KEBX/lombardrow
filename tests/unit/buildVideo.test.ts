import { describe, expect, it } from "vitest";
import facts from "../../fixtures/hello.facts.json";
import storyboard from "../../fixtures/hello.storyboard.json";
import words from "../../fixtures/hello.words.json";
import { buildVideo } from "../../src/pipeline/buildVideo";
import { StoryboardError } from "../../src/schema/storyboard";
import { CueResolutionError } from "../../src/schema/timing";

describe("buildVideo", () => {
  it("parses, validates and composes the hello fixtures", () => {
    const built = buildVideo(storyboard, facts, () => words, 30);
    expect(built.scenes.map((s) => s.id)).toEqual(["intro", "drop"]);
    expect(built.totalFrames).toBe(159);
  });

  it("runs the validation rules (facts mismatch is rejected)", () => {
    const badFacts = { facts: [{ ...facts.facts[0], value: 56 }] };
    expect(() => buildVideo(storyboard, badFacts, () => words, 30)).toThrow(StoryboardError);
  });

  it("rejects unsupported cues before composing", () => {
    const bad = {
      ...storyboard,
      scenes: [
        { ...storyboard.scenes[0], cues: [{ atWord: "the", do: "callout", text: "x" }] },
        storyboard.scenes[1],
      ],
    };
    expect(() => buildVideo(bad, facts, () => words, 30)).toThrow(/does not support cues/);
  });

  it("propagates timing errors naming the scene", () => {
    expect(() => buildVideo(storyboard, facts, () => ({ intro: words.intro }), 30)).toThrow(CueResolutionError);
  });
});
