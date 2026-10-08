import { describe, expect, it } from "vitest";
import { badgeRect, overlaps, tickLabelRect } from "../../src/charts/labels";
import { BADGE, CHART_BOX, placeBadge } from "../../src/charts/layout";

describe("overlaps", () => {
  const a = { x: 0, y: 0, width: 10, height: 10 };
  it("is true for intersecting rects and false for disjoint ones", () => {
    expect(overlaps(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
    expect(overlaps(a, { x: 20, y: 0, width: 5, height: 5 })).toBe(false);
  });
  it("treats rects that only touch as not overlapping", () => {
    expect(overlaps(a, { x: 10, y: 0, width: 5, height: 5 })).toBe(false);
  });
});

describe("badgeRect", () => {
  it("contains the tag body with a margin", () => {
    const badge = { x: 500, y: 400, width: 300, above: true };
    const r = badgeRect(badge);
    expect(r.x).toBeLessThan(500 - 150);
    expect(r.x + r.width).toBeGreaterThan(500 + 150);
    expect(r.y).toBeLessThan(400 - BADGE.heightPx / 2);
    expect(r.y + r.height).toBeGreaterThan(400 + BADGE.heightPx / 2);
  });
});

describe("tick labels vs badges", () => {
  it("a badge anchored near the left edge covers the tick label above its gridline", () => {
    const badge = placeBadge(CHART_BOX.left + 40, 900, "2008: 903");
    const tick = tickLabelRect(900 - 120, "1,000");
    expect(overlaps(badgeRect(badge), tick)).toBe(true);
  });
  it("a badge far from the label does not hide it", () => {
    const badge = placeBadge(800, 900, "2008: 903");
    expect(overlaps(badgeRect(badge), tickLabelRect(1100, "1,000"))).toBe(false);
  });
  it("the label box is anchored at the chart's left edge and scales with its text", () => {
    const short = tickLabelRect(800, "0");
    const long = tickLabelRect(800, "4,000");
    expect(short.x).toBe(CHART_BOX.left);
    expect(long.width).toBeGreaterThan(short.width);
  });
});
