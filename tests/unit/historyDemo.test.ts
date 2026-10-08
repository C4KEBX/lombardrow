import { describe, expect, it } from "vitest";
import facts from "../../fixtures/history.facts.json";
import storyboard from "../../fixtures/history.storyboard.json";
import { buildVideo } from "../../src/pipeline/buildVideo";
import { cutFrames } from "../../src/compose/wipe";
import { synthWords } from "../../src/voice/synthWords";

const built = buildVideo(
  storyboard, facts,
  (sb) => Object.fromEntries(sb.scenes.map((s) => [s.id, synthWords(s.narration)])),
  30,
);

describe("history demo storyboard", () => {
  it("validates, composes five scenes of five different types and has four cuts to wipe", () => {
    expect(built.scenes.map((s) => s.scene.type)).toEqual(["title", "kinetic-text", "compare", "big-number", "quote"]);
    expect(cutFrames(built.scenes)).toHaveLength(4);
  });
  it("resolves the emphasize and callout cues inside their scenes", () => {
    for (const s of built.scenes) for (const c of s.cues) expect(c.frame).toBeLessThan(s.durationFrames);
    expect(built.scenes[1].cues[0].do).toBe("emphasize");
    expect(built.scenes[2].cues[0].do).toBe("callout");
  });
});
