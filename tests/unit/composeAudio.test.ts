import { describe, expect, it } from "vitest";
import { buildVideo } from "../../src/pipeline/buildVideo";
import { DEFAULT_TAIL_PAD_MS } from "../../src/schema/timing";
import { synthWords } from "../../src/voice/standin";
import facts from "../../fixtures/hello.facts.json";
import storyboard from "../../fixtures/hello.storyboard.json";

const words = (sb: { scenes: { id: string; narration: string }[] }) =>
  Object.fromEntries(sb.scenes.map((s) => [s.id, synthWords(s.narration)]));

describe("scene duration follows the words", () => {
  it("cuts a short tail after the last word, not after the clip's trailing silence", () => {
    const built = buildVideo(storyboard, facts, words, 30);
    const intro = built.scenes[0];
    const lastEnd = Math.max(...intro.words.map((w) => w.endMs));
    expect(intro.durationFrames).toBe(Math.round(((lastEnd + DEFAULT_TAIL_PAD_MS) / 1000) * 30));
  });
  it("starts on the first scene, with no open before it", () => {
    const built = buildVideo(storyboard, facts, words, 30);
    expect(built.scenes[0].startFrame).toBe(0);
    expect(built.scenes[1].startFrame).toBe(built.scenes[0].durationFrames);
    expect(built.door).toEqual({ doorNo: storyboard.meta.doorNo, series: storyboard.meta.series });
  });
});
