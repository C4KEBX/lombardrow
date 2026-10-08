import { describe, expect, it } from "vitest";
import facts from "../../fixtures/hello.facts.json";
import storyboard from "../../fixtures/hello.storyboard.json";
import words from "../../fixtures/hello.words.json";
import { composeScenes } from "../../src/pipeline/resolveScene";
import { parseFacts } from "../../src/schema/facts";
import { parseStoryboard } from "../../src/schema/storyboard";
import { CueResolutionError } from "../../src/schema/timing";
import { assertFactsTraceable, assertVariety } from "../../src/schema/validate";

const sb = () => parseStoryboard(storyboard);

describe("hello fixtures", () => {
  it("pass the validation rules", () => {
    expect(() => assertVariety(sb())).not.toThrow();
    expect(() => assertFactsTraceable(sb(), parseFacts(facts))).not.toThrow();
  });
});

describe("composeScenes", () => {
  it("derives scene durations in frames from the word timings", () => {
    const composed = composeScenes(sb(), words, 30);
    expect(composed.map((s) => s.durationFrames)).toEqual([78, 81]);
    expect(composed.map((s) => s.id)).toEqual(["intro", "drop"]);
  });

  it("resolves cue words to frames", () => {
    const [, drop] = composeScenes(sb(), words, 30);
    expect(drop.cues).toEqual([{ frame: 30, do: "callout", text: "Half gone" }]);
  });

  it("does not mutate the storyboard or the timings", () => {
    const board = sb();
    const before = JSON.stringify([board, words]);
    composeScenes(board, words, 30);
    expect(JSON.stringify([board, words])).toBe(before);
  });

  it("names the scene when word timings are missing", () => {
    expect(() => composeScenes(sb(), { intro: words.intro }, 30)).toThrow(/No word timings for scene "drop"/);
  });

  it("names the scene and word when a cue word is not in the narration", () => {
    const bad = parseStoryboard({
      ...storyboard,
      scenes: [
        storyboard.scenes[0],
        { ...storyboard.scenes[1], cues: [{ atWord: "crash", do: "callout", text: "x" }] },
      ],
    });
    expect(() => composeScenes(bad, words, 30)).toThrow(CueResolutionError);
    expect(() => composeScenes(bad, words, 30)).toThrow(/Scene "drop".*"crash"/);
  });

  it("rejects a scene whose word timings are empty", () => {
    expect(() => composeScenes(sb(), { intro: words.intro, drop: [] }, 30)).toThrow(CueResolutionError);
  });
});
