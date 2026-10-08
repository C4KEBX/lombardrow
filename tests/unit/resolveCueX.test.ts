import { describe, expect, it } from "vitest";
import { composeScenes } from "../../src/pipeline/resolveScene";
import { parseStoryboard } from "../../src/schema/storyboard";

describe("composeScenes carries the cue x anchor", () => {
  it("passes x through to the resolved cue", () => {
    const sb = parseStoryboard({
      schemaVersion: 1,
      meta: { title: "t", theme: "bold-flat", voice: "v" },
      audio: { music: null },
      scenes: [{
        id: "c", type: "line-chart", narration: "It rose fast.",
        props: { title: "T", points: [{ x: 1, y: 1 }, { x: 2, y: 2 }], factId: "f1" },
        cues: [{ atWord: "rose", do: "callout", text: "Up", x: 2 }],
      }],
    });
    const words = { c: [
      { text: "It", startMs: 0, endMs: 100 }, { text: "rose", startMs: 100, endMs: 400 },
      { text: "fast.", startMs: 400, endMs: 800 },
    ] };
    const [composed] = composeScenes(sb, words, 30);
    expect(composed.cues).toEqual([{ frame: 3, do: "callout", text: "Up", x: 2 }]);
  });
});
