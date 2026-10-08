import { describe, expect, it } from "vitest";
import { buildVideo } from "../../src/pipeline/buildVideo";
import { synthWords } from "../../src/voice/standin";
import facts from "../../fixtures/hello.facts.json";
import storyboard from "../../fixtures/hello.storyboard.json";

const words = (sb: { scenes: { id: string; narration: string }[] }) =>
  Object.fromEntries(sb.scenes.map((s) => [s.id, synthWords(s.narration)]));

describe("scene duration follows the audio", () => {
  it("is unchanged when the audio is shorter than the word timings", () => {
    const base = buildVideo(storyboard, facts, words, 30);
    const withAudio = buildVideo(storyboard, facts, words, 30, { intro: 500, drop: 500 });
    expect(withAudio.totalFrames).toBe(base.totalFrames);
  });
  it("extends a scene when the audio outlasts its words so narration is never cut", () => {
    const base = buildVideo(storyboard, facts, words, 30);
    const longer = buildVideo(storyboard, facts, words, 30, { intro: 9000 });
    expect(longer.scenes[0].durationFrames).toBe(Math.round(((9000 + 400) / 1000) * 30));
    expect(longer.scenes[0].durationFrames).toBeGreaterThan(base.scenes[0].durationFrames);
    expect(longer.scenes[1].durationFrames).toBe(base.scenes[1].durationFrames);
  });
  it("exposes each scene's words and start frame", () => {
    const built = buildVideo(storyboard, facts, words, 30);
    expect(built.scenes[0].startFrame).toBe(0);
    expect(built.scenes[1].startFrame).toBe(built.scenes[0].durationFrames);
    expect(built.scenes[0].words.length).toBeGreaterThan(0);
  });
});
