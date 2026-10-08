import { describe, expect, it } from "vitest";
import { parseStoryboard } from "../../src/schema/storyboard";
import { adviceLint } from "../../src/skill/adviceLint";

const board = (narration: string) =>
  parseStoryboard({
    schemaVersion: 1,
    meta: { title: "t", theme: "lombard-row", doorNo: 1, series: "How it works", voice: "v" },
    audio: { music: null },
    scenes: [{ id: "s", type: "title", narration, props: { headline: "H" } }],
  });

describe("adviceLint", () => {
  it("flags advice and certainty phrasing with the scene id and phrase", () => {
    for (const text of [
      "You should buy index funds now.",
      "This is a guaranteed return.",
      "It is a risk-free way to grow money.",
      "You can't lose with this strategy.",
      "Sell today before it drops.",
      "You need to invest early.",
    ]) {
      const hits = adviceLint(board(text));
      expect(hits.length, text).toBeGreaterThan(0);
      expect(hits[0].sceneId).toBe("s");
    }
  });
  it("leaves factual, historical phrasing alone", () => {
    for (const text of [
      "Investors bought stocks in the nineteen twenties.",
      "The index fell fifty seven percent from its peak.",
      "Many analysts sold their positions.",
    ]) {
      expect(adviceLint(board(text))).toEqual([]);
    }
  });
});
