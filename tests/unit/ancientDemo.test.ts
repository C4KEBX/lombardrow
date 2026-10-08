import { describe, expect, it } from "vitest";
import facts from "../../fixtures/ancient.facts.json";
import storyboard from "../../fixtures/ancient.storyboard.json";
import { cutFrames } from "../../src/compose/wipe";
import { buildVideo } from "../../src/pipeline/buildVideo";
import { synthWords } from "../../src/voice/synthWords";

const built = buildVideo(
  storyboard, facts,
  (sb) => Object.fromEntries(sb.scenes.map((s) => [s.id, synthWords(s.narration)])),
  30,
);

describe("ancient demo storyboard", () => {
  it("validates under every Plan 5 rule and has four scenes of four types", () => {
    expect(built.scenes.map((s) => s.scene.type)).toEqual(["title", "map", "timeline", "kinetic-text"]);
    expect(cutFrames(built.scenes)).toHaveLength(3);
  });
  it("resolves one cue per region and per event inside their scenes", () => {
    expect(built.scenes[1].cues).toHaveLength(6);
    expect(built.scenes[2].cues).toHaveLength(4);
    for (const s of built.scenes) for (const c of s.cues) expect(c.frame).toBeLessThan(s.durationFrames);
  });
});
