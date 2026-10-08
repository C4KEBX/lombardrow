import { describe, expect, it } from "vitest";
import facts from "../../fixtures/finance.facts.json";
import storyboard from "../../fixtures/finance.storyboard.json";
import { synthWords } from "../../src/voice/standin";
import { buildVideo } from "../../src/pipeline/buildVideo";

const build = () =>
  buildVideo(
    storyboard, facts,
    (sb) => Object.fromEntries(sb.scenes.map((s) => [s.id, synthWords(s.narration)])),
    30,
  );

describe("finance demo fixtures", () => {
  it("pass every validation rule and compose", () => {
    expect(() => build()).not.toThrow();
  });
  it("run between 20 and 45 seconds", () => {
    const { totalFrames } = build();
    expect(totalFrames).toBeGreaterThanOrEqual(20 * 30);
    expect(totalFrames).toBeLessThanOrEqual(45 * 30);
  });
  it("give each chart scene enough time to draw and every cue a frame inside its scene", () => {
    for (const scene of build().scenes) {
      if (scene.scene.type === "line-chart" || scene.scene.type === "bar-race") {
        expect(scene.durationFrames).toBeGreaterThanOrEqual(120);
      }
      for (const cue of scene.cues) {
        expect(cue.frame).toBeGreaterThanOrEqual(0);
        expect(cue.frame).toBeLessThan(scene.durationFrames);
      }
    }
  });
  it("covers all four scene types", () => {
    const types = new Set(build().scenes.map((s) => s.scene.type));
    expect([...types].sort()).toEqual(["bar-race", "big-number", "line-chart", "title"]);
  });
});
