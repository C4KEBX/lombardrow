import { describe, expect, it } from "vitest";
import { StampError, closeFrames, stampTrack, yearTrack } from "../../src/devices/tracks";

const scene = (id: string, startFrame: number, durationFrames: number, extra: { year?: number; stamp?: string } = {}) => ({
  id, startFrame, durationFrames, ...extra,
});

describe("close length", () => {
  it("is at least a 3 s close", () => {
    expect(closeFrames(30)).toBe(90);
    expect(closeFrames(30, 2000)).toBe(90);
    expect(closeFrames(30, 3200)).toBe(Math.ceil(3.6 * 30)); // a long sign-off is never cut
  });
});

describe("yearTrack", () => {
  it("counts between consecutive year scenes and hides in the present", () => {
    const spans = yearTrack([
      scene("a", 60, 100, { year: 1494 }),
      scene("b", 160, 100, { year: 1602 }),
      scene("c", 260, 100),
      scene("d", 360, 100, { year: 1971 }),
    ]);
    expect(spans).toEqual([
      { from: 1494, to: 1494, startFrame: 60, endFrame: 160, fadeIn: true, fadeOut: false },
      { from: 1494, to: 1602, startFrame: 160, endFrame: 260, fadeIn: false, fadeOut: true },
      { from: 1971, to: 1971, startFrame: 360, endFrame: 460, fadeIn: true, fadeOut: true },
    ]);
  });
});

describe("stampTrack", () => {
  it("holds a stamp at least 2 s, running into the next scene", () => {
    expect(stampTrack([scene("a", 60, 30, { stamp: "Source: SEC" }), scene("b", 90, 100)], 30)).toEqual([
      { text: "Source: SEC", startFrame: 60, endFrame: 120 },
    ]);
  });
  it("keeps one stamp across scenes with the same source", () => {
    const spans = stampTrack([scene("a", 0, 90, { stamp: "Source: SEC" }), scene("b", 90, 90, { stamp: "Source: SEC" })], 30);
    expect(spans).toEqual([{ text: "Source: SEC", startFrame: 0, endFrame: 180 }]);
  });
  it("starts the next stamp only after the previous one's minimum hold", () => {
    const spans = stampTrack([scene("a", 0, 30, { stamp: "Source: A" }), scene("b", 30, 120, { stamp: "Source: B" })], 30);
    expect(spans).toEqual([
      { text: "Source: A", startFrame: 0, endFrame: 60 },
      { text: "Source: B", startFrame: 60, endFrame: 150 },
    ]);
  });
  it("fails rather than truncating a stamp over 60 characters", () => {
    const long = `Source: ${"x".repeat(53)}`;
    expect(long.length).toBe(61);
    expect(() => stampTrack([scene("a", 0, 90, { stamp: long })], 30)).toThrow(StampError);
    expect(() => stampTrack([scene("a", 0, 90, { stamp: long.slice(0, 60) })], 30)).not.toThrow();
  });
});
