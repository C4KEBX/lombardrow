import { describe, expect, it } from "vitest";
import { doorLabelText, isTrending } from "../../src/devices/label";
import { doorFolder } from "../../src/pipeline/renderDir";
import { MAX_VIDEO_MS, MIN_VIDEO_MS, TRENDING_VIDEO_MS, lengthWindow } from "../../src/schema/validate";

describe("the trending T-series", () => {
  it("numbers trending videos T-01 on from door 901, apart from the main doors", () => {
    expect(isTrending(6)).toBe(false);
    expect(doorLabelText(6)).toBe("006");
    expect(doorLabelText(901)).toBe("T-01");
    expect(doorLabelText(912)).toBe("T-12");
    expect(doorFolder(901)).toBe("t-001");
    expect(doorFolder(6)).toBe("no-006");
  });
  it("lifts the 62 s floor for trending videos only", () => {
    expect(lengthWindow({ meta: { doorNo: 901 } })).toEqual({ minMs: TRENDING_VIDEO_MS.min, maxMs: TRENDING_VIDEO_MS.max });
    expect(lengthWindow({ meta: { doorNo: 6 } })).toEqual({ minMs: MIN_VIDEO_MS, maxMs: MAX_VIDEO_MS });
    expect(lengthWindow({ meta: { doorNo: 6, lengthWaiver: { minSeconds: 55 } } }).minMs).toBe(55_000);
  });
});
