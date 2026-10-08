import { describe, expect, it } from "vitest";
import facts from "../../fixtures/no-004/rule-of-72.facts.json";
import storyboard from "../../fixtures/no-004/rule-of-72.storyboard.json";
import { buildVideo } from "../../src/pipeline/buildVideo";
import { parseStoryboard } from "../../src/schema/storyboard";
import { parseFacts } from "../../src/schema/facts";
import { assertYears, sceneStamps } from "../../src/schema/validate";
import { synthWords } from "../../src/voice/synthWords";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const words = (sb: { scenes: { id: string; narration: string }[] }) =>
  Object.fromEntries(sb.scenes.map((s) => [s.id, synthWords(s.narration)]));

describe("year counter rules", () => {
  it("accepts a year on an ink title scene", () => {
    expect(() => assertYears(parseStoryboard(storyboard))).not.toThrow();
  });
  it("rejects a year on a Parchment scene", () => {
    const sb = clone(storyboard);
    (sb.scenes[1] as { ground?: string }).ground = "parchment";
    expect(() => assertYears(parseStoryboard(sb))).toThrow(/Ledger Ink only/);
  });
  it("rejects a year on a scene type that uses the top-left band", () => {
    const sb = clone(storyboard);
    (sb.scenes[3] as { year?: number }).year = 1990;
    (sb.scenes[3] as { ground?: string }).ground = "ink";
    expect(() => assertYears(parseStoryboard(sb))).toThrow(/line-chart/);
  });
});

describe("source stamps", () => {
  it("uses the fact's short stamp, else its source name", () => {
    const stamps = sceneStamps(parseStoryboard(storyboard), parseFacts(facts));
    expect(stamps.venice).toBe("Source: British Actuarial Journal, 2019");
    expect(stamps.growth).toBe("Source: SEC, Investor.gov");
    expect(stamps.exact).toBe("Source: SEC, Investor.gov");
    expect(stamps.hook).toBe("Source: British Actuarial Journal, 2019");
    expect(stamps.caveat).toBeUndefined();
  });
  it("requires a source for a scene that shows a year", () => {
    const sb = clone(storyboard);
    delete (sb.scenes[1] as { sourceFactId?: string }).sourceFactId;
    expect(() => sceneStamps(parseStoryboard(sb), parseFacts(facts))).toThrow(/names no source/);
  });
});

describe("the No. 004 test video", () => {
  it("opens, narrates, and closes on the door plate inside 65 to 70 s at a real speaking pace", () => {
    const built = buildVideo(storyboard, facts, words, 30);
    expect(built.open).toMatchObject({ frames: 60, doorNo: 4, series: "How it works", handoffAxis: null });
    expect(built.close.frames).toBe(90);
    expect(built.totalFrames).toBe(built.close.startFrame + 90);
    expect(built.years).toEqual([expect.objectContaining({ from: 1494, to: 1494, fadeIn: true, fadeOut: true })]);
    expect(built.stamps.map((s) => s.text)).toEqual([
      "Source: British Actuarial Journal, 2019",
      "Source: SEC, Investor.gov",
      "Source: SEC, Investor.gov; British Actuarial Journal, 2019",
    ]);
  });
});
