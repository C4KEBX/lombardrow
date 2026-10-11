import { describe, expect, it } from "vitest";
import { WIPE, WIPE_DIRECTIONS, bandPoints, cutFrames, wipeBand, wipeDirections } from "../../src/compose/wipe";
import { VIDEO } from "../../src/design/tokens";

const CUT = 200;
const HALF = WIPE.frames / 2;

describe("cutFrames", () => {
  it("returns the start frame of every scene after the first", () => {
    expect(cutFrames([{ startFrame: 0 }, { startFrame: 90 }, { startFrame: 210 }])).toEqual([90, 210]);
  });
  it("returns nothing for a single scene", () => {
    expect(cutFrames([{ startFrame: 0 }])).toEqual([]);
  });
});

describe("wipeBand", () => {
  it("draws nothing outside its window (no residue before or after the cut)", () => {
    expect(wipeBand(CUT - HALF, CUT)).toBeNull();
    expect(wipeBand(CUT - HALF - 30, CUT)).toBeNull();
    expect(wipeBand(CUT + HALF, CUT)).toBeNull();
    expect(wipeBand(CUT + HALF + 30, CUT)).toBeNull();
  });
  it("covers the whole frame on the cut frame, slanted edges included", () => {
    const band = wipeBand(CUT, CUT);
    expect(band).not.toBeNull();
    const { trail, lead } = band!;
    expect(trail).toBeLessThanOrEqual(0);
    expect(lead).toBeGreaterThanOrEqual(VIDEO.width);
    expect(trail - WIPE.slant).toBeLessThanOrEqual(0);
    expect(lead - WIPE.slant).toBeGreaterThanOrEqual(VIDEO.width);
  });
  it("sweeps left to right: both edges never move left", () => {
    let prev: { trail: number; lead: number } | null = null;
    for (let f = CUT - HALF + 1; f < CUT + HALF; f += 1) {
      const band = wipeBand(f, CUT)!;
      if (prev) {
        expect(band.lead).toBeGreaterThanOrEqual(prev.lead);
        expect(band.trail).toBeGreaterThanOrEqual(prev.trail);
      }
      prev = band;
    }
  });
  it("a lagging band starts and ends later by the lag", () => {
    expect(wipeBand(CUT - HALF + 1, CUT, WIPE.lag)).toBeNull();
    expect(wipeBand(CUT + HALF, CUT, WIPE.lag)).not.toBeNull();
    expect(wipeBand(CUT + HALF + WIPE.lag, CUT, WIPE.lag)).toBeNull();
  });
});

describe("bandPoints", () => {
  it("builds a slanted four-point polygon", () => {
    expect(bandPoints({ trail: 10, lead: 500 })).toBe(
      `10,0 500,0 ${500 - WIPE.slant},${VIDEO.height} ${10 - WIPE.slant},${VIDEO.height}`,
    );
  });
});

describe("wipe directions", () => {
  it("never uses the same direction twice in a row and uses all four", () => {
    for (const seed of [1, 4, 17, 250]) {
      const dirs = wipeDirections(40, seed);
      expect(dirs).toHaveLength(40);
      for (let i = 1; i < dirs.length; i += 1) expect(dirs[i]).not.toBe(dirs[i - 1]);
      expect(new Set(dirs)).toEqual(new Set(WIPE_DIRECTIONS));
    }
  });
  it("is the same for the same door number, so re-renders match", () => {
    expect(wipeDirections(9, 1)).toEqual(wipeDirections(9, 1));
    expect(wipeDirections(9, 1)).not.toEqual(wipeDirections(9, 2));
  });
  it("maps the band onto each side of the frame", () => {
    const band = { trail: 10, lead: 500 };
    expect(bandPoints(band, "right-to-left")).toBe(
      `${VIDEO.width - 10},0 ${VIDEO.width - 500},0 ${VIDEO.width - 500 + WIPE.slant},${VIDEO.height} ${VIDEO.width - 10 + WIPE.slant},${VIDEO.height}`,
    );
    expect(bandPoints(band, "top-to-bottom")).toBe(`0,10 0,500 ${VIDEO.width},${500 - WIPE.slant} ${VIDEO.width},${10 - WIPE.slant}`);
    expect(bandPoints(band, "bottom-to-top").split(" ")[0]).toBe(`0,${VIDEO.height - 10}`);
  });
  it("covers the full height on the cut for a vertical sweep", () => {
    const band = wipeBand(CUT, CUT, 0, VIDEO.height)!;
    expect(band.trail).toBeLessThanOrEqual(0);
    expect(band.lead - WIPE.slant).toBeGreaterThanOrEqual(VIDEO.height);
  });
});
