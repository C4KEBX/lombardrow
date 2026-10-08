import { describe, expect, it } from "vitest";
import { raceStateAt, type RaceFrame } from "../../src/charts/race";

const frames: RaceFrame[] = [
  { label: "a", values: [{ name: "X", value: 5 }, { name: "Y", value: 4 }] },
  { label: "b", values: [{ name: "X", value: 6 }, { name: "Y", value: 4 }, { name: "Z", value: 3 }] },
  { label: "c", values: [{ name: "X", value: 7 }, { name: "Z", value: 3 }] },
];
const bar = (t: number, name: string) => raceStateAt(frames, t, 5).bars.find((b) => b.name === name);

describe("entities missing from the dataset are never shown as zero", () => {
  it("hides an entity before it first appears, even when topN has room", () => {
    expect(bar(0, "Z")).toBeUndefined();
  });
  it("fades an entering entity in across the frame it first appears", () => {
    const mid = bar(0.5, "Z");
    expect(mid?.present).toBeCloseTo(0.5, 6);
    expect(mid?.opacity).toBeCloseTo(0.5, 6);
    expect(bar(1, "Z")?.present).toBe(1);
    expect(bar(1, "Z")?.opacity).toBe(1);
  });
  it("fades an exiting entity out and hides it afterwards", () => {
    expect(bar(1.5, "Y")?.present).toBeCloseTo(0.5, 6);
    expect(bar(2, "Y")).toBeUndefined();
  });
  it("keeps fully present entities at present = 1", () => {
    expect(bar(1.5, "X")?.present).toBe(1);
  });
});
