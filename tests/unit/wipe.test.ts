import { describe, expect, it } from "vitest";
import { WIPE, bandPoints, cutFrames, wipeBand } from "../../src/compose/wipe";
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
