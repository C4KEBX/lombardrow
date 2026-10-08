import { describe, expect, it } from "vitest";
import { CAPTION_LANE, CONTENT, SAFE, TITLE_LANE, VIDEO } from "../../src/design/tokens";

describe("tokens", () => {
  it("is 1080x1920 at 30fps", () => {
    expect(VIDEO).toEqual({ width: 1080, height: 1920, fps: 30 });
  });
  it("keeps the top 8%, the bottom platform zone and the right action rail clear", () => {
    expect(SAFE.top).toBe(Math.ceil(VIDEO.height * 0.08));
    expect(SAFE.bottom).toBe(384);
    expect(SAFE.left).toBe(72);
    expect(SAFE.right).toBe(162);
  });
  it("matches the devices.json content area", () => {
    expect(CONTENT).toEqual({ left: 72, right: 918, width: 846, bottom: 1536 });
  });
});

describe("caption lane", () => {
  it("sits between the content area and the bottom safe zone", () => {
    expect(CAPTION_LANE.bottom).toBe(1920 - SAFE.bottom);
    expect(CAPTION_LANE.top).toBe(1250);
    // two caption lines at 52px x 1.25 fit above the source stamp at y 1478
    expect(CAPTION_LANE.top + 2 * 52 * 1.25).toBeLessThan(1478);
  });
  it("leaves the title lane above the captions", () => {
    expect(SAFE.top + TITLE_LANE.height + 140).toBeLessThanOrEqual(CAPTION_LANE.top);
  });
});

describe("kinetic lane", () => {
  it("spans the side gutters and stops above the caption lane", async () => {
    const { KINETIC_LANE } = await import("../../src/design/tokens");
    expect(KINETIC_LANE.width).toBe(CONTENT.width);
    expect(SAFE.top + KINETIC_LANE.height + 120).toBe(CAPTION_LANE.top);
  });
});

describe("quote lane", () => {
  it("is the title lane minus room for the mark and attribution", async () => {
    const { QUOTE_LANE } = await import("../../src/design/tokens");
    expect(QUOTE_LANE.height).toBe(TITLE_LANE.height - 360);
    expect(QUOTE_LANE.width).toBe(TITLE_LANE.width);
  });
});

describe("map box", () => {
  it("sits between the title and the caption lane, inside the side gutters", async () => {
    const { MAP_BOX } = await import("../../src/design/tokens");
    expect(MAP_BOX.left).toBe(CONTENT.left);
    expect(MAP_BOX.right).toBe(CONTENT.right);
    expect(MAP_BOX.top).toBeGreaterThan(SAFE.top + 100);
    expect(MAP_BOX.bottom).toBeLessThan(CAPTION_LANE.top);
  });
});
