import { describe, expect, it } from "vitest";
import { BADGE, CHART_BOX, badgeWidth, placeBadge } from "../../src/charts/layout";
import { CAPTION_LANE } from "../../src/design/tokens";

describe("CHART_BOX", () => {
  it("sits inside the side gutters and above the bottom safe zone", () => {
    expect(CHART_BOX.left).toBe(72);
    expect(CHART_BOX.right).toBe(918);
    expect(CHART_BOX.bottom).toBe(1100); // the ledger line
    expect(CHART_BOX.bottom + 80).toBeLessThanOrEqual(CAPTION_LANE.top);
  });
});

describe("placeBadge", () => {
  it("centers above the anchor when there is room", () => {
    const b = placeBadge(540, 1000, "Crash");
    expect(b.x).toBe(540);
    expect(b.y).toBe(1000 - BADGE.offsetPx);
    expect(b.above).toBe(true);
    expect(b.width).toBe(badgeWidth("Crash"));
  });
  it("clamps inside the left and right gutters", () => {
    const left = placeBadge(70, 1000, "Crash");
    expect(left.x - left.width / 2).toBeGreaterThanOrEqual(CHART_BOX.left);
    const right = placeBadge(910, 1000, "Crash");
    expect(right.x + right.width / 2).toBeLessThanOrEqual(CHART_BOX.right);
  });
  it("flips below the anchor when above would collide with the header", () => {
    const b = placeBadge(540, 600, "Crash");
    expect(b.above).toBe(false);
    expect(b.y).toBe(600 + BADGE.offsetPx);
  });
  it("fits the longest allowed text (24 chars) in the gutters", () => {
    const text = "x".repeat(24);
    for (const ax of [60, 540, 1020]) {
      const b = placeBadge(ax, 1000, text);
      expect(b.x - b.width / 2).toBeGreaterThanOrEqual(CHART_BOX.left);
      expect(b.x + b.width / 2).toBeLessThanOrEqual(CHART_BOX.right);
    }
  });
});
