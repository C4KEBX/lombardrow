import { describe, expect, it } from "vitest";
import { DeviceBoundsError, assertDevicesInBounds, deviceBoxes } from "../../src/devices/bounds";

const base = { doorNo: 4, series: "How it works", years: [], stamps: [] };

describe("device bounds", () => {
  it("keeps every device of a typical video out of the platform zones", () => {
    const boxes = deviceBoxes({
      ...base,
      years: [{ from: -753, to: 1494, startFrame: 0, endFrame: 90, fadeIn: true, fadeOut: true }],
      stamps: [{ text: `Source: ${"Pacioli, Summa de arithmetica (1494)"}`, startFrame: 0, endFrame: 90 }],
    });
    expect(boxes.map((b) => b.name)).toEqual(expect.arrayContaining(["ledger line", "door plate", "wordmark", "series label"]));
    expect(() => assertDevicesInBounds(boxes)).not.toThrow();
  });
  it("accepts the longest allowed stamp", () => {
    const text = `Source: ${"Federal Reserve Bank of St. Louis, FRED series C".padEnd(52, "x")}`;
    expect(text.length).toBe(60);
    expect(() => assertDevicesInBounds(deviceBoxes({ ...base, stamps: [{ text, startFrame: 0, endFrame: 1 }] }))).not.toThrow();
  });
  it("fails when a series label would run into the right-hand rail (the schema caps it at 28 characters)", () => {
    const boxes = deviceBoxes({ ...base, series: "x".repeat(45) });
    expect(() => assertDevicesInBounds(boxes)).toThrow(DeviceBoundsError);
    expect(() => assertDevicesInBounds(boxes)).toThrow(/right platform zone/);
  });
  it("fails a box that enters the bottom platform zone", () => {
    expect(() => assertDevicesInBounds([{ name: "probe", x: 72, y: 1500, width: 10, height: 40 }])).toThrow(/bottom platform zone/);
  });
});
