import { describe, expect, it } from "vitest";
import { raceStateAt, type RaceFrame } from "../../src/charts/race";

const F: RaceFrame[] = [
  { label: "2010", values: [{ name: "A", value: 10 }, { name: "B", value: 20 }, { name: "C", value: 5 }] },
  { label: "2011", values: [{ name: "A", value: 30 }, { name: "B", value: 20 }, { name: "C", value: 8 }] },
  { label: "2012", values: [{ name: "A", value: 30 }, { name: "B", value: 40 }, { name: "D", value: 12 }] },
];
const names = (s: ReturnType<typeof raceStateAt>) => s.bars.map((b) => b.name);
const bar = (s: ReturnType<typeof raceStateAt>, n: string) => s.bars.find((b) => b.name === n)!;

describe("raceStateAt at keyframes", () => {
  it("returns exact values, ranks and label at t=0", () => {
    const s = raceStateAt(F, 0, 3);
    expect(names(s)).toEqual(["B", "A", "C"]);
    expect(bar(s, "B").value).toBe(20);
    expect(bar(s, "B").rank).toBe(0);
    expect(s.label).toBe("2010");
    expect(s.axisMax).toBeCloseTo(21.6, 6);
  });
  it("hides an entity that has not appeared yet (D) and shows it once it ranks in", () => {
    expect(names(raceStateAt(F, 1, 3))).toEqual(["A", "B", "C"]);
    expect(names(raceStateAt(F, 2, 3))).toEqual(["B", "A", "D"]);
  });
});

describe("raceStateAt between keyframes", () => {
  it("interpolates values linearly and swaps ranks smoothly", () => {
    const s = raceStateAt(F, 0.5, 3);
    expect(bar(s, "A").value).toBeCloseTo(20, 6);
    expect(bar(s, "A").rank).toBeCloseTo(0.5, 6);
    expect(bar(s, "B").rank).toBeCloseTo(0.5, 6);
    expect(bar(s, "C").value).toBeCloseTo(6.5, 6);
  });
  it("fades entities across the topN boundary", () => {
    const s = raceStateAt(F, 1.5, 3);
    expect(bar(s, "D").value).toBeCloseTo(6, 6);
    expect(bar(s, "D").opacity).toBeCloseTo(0.5, 6);
    expect(bar(s, "C").opacity).toBeCloseTo(0.5, 6);
  });
  it("keeps colors stable by first appearance", () => {
    const s = raceStateAt(F, 2, 4);
    expect(bar(s, "A").colorIndex).toBe(0);
    expect(bar(s, "B").colorIndex).toBe(1);
    expect(bar(s, "D").colorIndex).toBe(3);
  });
  it("clamps t outside the range", () => {
    expect(raceStateAt(F, -5, 3)).toEqual(raceStateAt(F, 0, 3));
    expect(raceStateAt(F, 99, 3)).toEqual(raceStateAt(F, 2, 3));
  });
});

describe("raceStateAt edge cases", () => {
  it("returns fewer bars than topN when there are fewer entities", () => {
    const two: RaceFrame[] = [
      { label: "a", values: [{ name: "X", value: 1 }, { name: "Y", value: 2 }] },
      { label: "b", values: [{ name: "X", value: 2 }, { name: "Y", value: 3 }] },
    ];
    expect(raceStateAt(two, 0.5, 5).bars).toHaveLength(2);
  });
  it("breaks ties by name so ranks are stable", () => {
    const tie: RaceFrame[] = [
      { label: "a", values: [{ name: "B", value: 5 }, { name: "A", value: 5 }] },
      { label: "b", values: [{ name: "B", value: 5 }, { name: "A", value: 5 }] },
    ];
    expect(names(raceStateAt(tie, 0, 2))).toEqual(["A", "B"]);
  });
  it("never divides by zero when every value is 0", () => {
    const zero: RaceFrame[] = [
      { label: "a", values: [{ name: "X", value: 0 }, { name: "Y", value: 0 }] },
      { label: "b", values: [{ name: "X", value: 0 }, { name: "Y", value: 0 }] },
    ];
    const s = raceStateAt(zero, 0.5, 2);
    expect(s.axisMax).toBe(1);
    for (const b of s.bars) expect(Number.isFinite(b.value) && Number.isFinite(b.rank)).toBe(true);
  });
  it("works with a single frame and rejects an empty list", () => {
    expect(names(raceStateAt([F[0]], 0.7, 3))).toEqual(["B", "A", "C"]);
    expect(() => raceStateAt([], 0, 3)).toThrow(RangeError);
  });
  it("does not mutate its input", () => {
    const before = JSON.stringify(F);
    raceStateAt(F, 1.3, 3);
    expect(JSON.stringify(F)).toBe(before);
  });
});
