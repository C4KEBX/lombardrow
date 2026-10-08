import { describe, expect, it } from "vitest";
import { WIDE_FACTOR, labelPosition, lerpBbox, projectionFor, visibleBbox, wideBbox, type Bbox } from "../../src/map/camera";
import { geoPath } from "d3-geo";
import { MAP_BOX } from "../../src/design/tokens";
import { COUNTRIES, COUNTRY_BY_NAME, visibleCountries } from "../../src/map/atlas";
import { parseStoryboard, StoryboardError } from "../../src/schema/storyboard";

const MED: Bbox = [-12, 28, 45, 56];

describe("wideBbox", () => {
  it("contains the focus and is WIDE_FACTOR times larger around the same center", () => {
    const [w, s, e, n] = wideBbox(MED);
    expect(w).toBeLessThan(-12);
    expect(e).toBeGreaterThan(45);
    expect(s).toBeLessThan(28);
    expect(n).toBeGreaterThan(56);
    expect(e - w).toBeCloseTo((45 + 12) * WIDE_FACTOR, 9);
    expect((w + e) / 2).toBeCloseTo((-12 + 45) / 2, 9);
  });
  it("clamps to the map's valid range near the poles and antimeridian", () => {
    const [w, s, e, n] = wideBbox([-170, -60, 170, 75]);
    expect(w).toBeGreaterThanOrEqual(-180);
    expect(e).toBeLessThanOrEqual(180);
    expect(s).toBeGreaterThanOrEqual(-80);
    expect(n).toBeLessThanOrEqual(80);
  });
});

describe("lerpBbox", () => {
  it("returns the endpoints and the midpoint", () => {
    const a: Bbox = [0, 0, 10, 10];
    const b: Bbox = [10, 20, 20, 40];
    expect(lerpBbox(a, b, 0)).toEqual(a);
    expect(lerpBbox(a, b, 1)).toEqual(b);
    expect(lerpBbox(a, b, 0.5)).toEqual([5, 10, 15, 25]);
  });
});

describe("projectionFor", () => {
  const corners = (bbox: Bbox): [number, number][] => [
    [bbox[0], bbox[1]], [bbox[2], bbox[1]], [bbox[2], bbox[3]], [bbox[0], bbox[3]],
  ];
  it("fits the box: corners land inside it and one dimension fills it", () => {
    const projection = projectionFor(MED, MAP_BOX);
    const pts = corners(MED).map((c) => projection(c) as [number, number]);
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(MAP_BOX.left - 0.5);
      expect(x).toBeLessThanOrEqual(MAP_BOX.right + 0.5);
      expect(y).toBeGreaterThanOrEqual(MAP_BOX.top - 0.5);
      expect(y).toBeLessThanOrEqual(MAP_BOX.bottom + 0.5);
    }
    const width = Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]));
    const height = Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1]));
    const fillsWidth = Math.abs(width - (MAP_BOX.right - MAP_BOX.left)) < 1;
    const fillsHeight = Math.abs(height - (MAP_BOX.bottom - MAP_BOX.top)) < 1;
    expect(fillsWidth || fillsHeight).toBe(true);
  });
  it("never returns NaN for tall, wide or near-polar boxes", () => {
    for (const bbox of [[-5, -60, 5, 70], [-170, 0, 170, 10], [10, 70, 40, 80]] as Bbox[]) {
      const p = projectionFor(bbox, MAP_BOX)([(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]) as [number, number];
      expect(Number.isFinite(p[0]) && Number.isFinite(p[1])).toBe(true);
    }
  });
});

describe("visibleBbox", () => {
  it("covers at least the focus box (the other dimension shows extra land)", () => {
    const [w, s, e, n] = visibleBbox(projectionFor(MED, MAP_BOX), MAP_BOX);
    expect(w).toBeLessThanOrEqual(-12 + 1e-6);
    expect(e).toBeGreaterThanOrEqual(45 - 1e-6);
    expect(s).toBeLessThanOrEqual(28 + 1e-6);
    expect(n).toBeGreaterThanOrEqual(56 - 1e-6);
  });
});

describe("review fixes: zoom direction, antimeridian, labels", () => {
  it("the wide view always contains the focus, even at the latitude limit", () => {
    for (const focus of [[0, 70, 10, 80], [-180, -80, 180, 80], [150, -50, 180, 50], [-12, 28, 45, 56]] as Bbox[]) {
      const [w, s, e, n] = wideBbox(focus);
      expect(w).toBeLessThanOrEqual(focus[0]);
      expect(s).toBeLessThanOrEqual(focus[1]);
      expect(e).toBeGreaterThanOrEqual(focus[2]);
      expect(n).toBeGreaterThanOrEqual(focus[3]);
    }
  });
  it("the projection scale never decreases while zooming in", () => {
    for (const focus of [[0, 70, 10, 80], [110, -48, 180, -8], [-12, 28, 45, 56]] as Bbox[]) {
      let prev = 0;
      for (let t = 0; t <= 1.0001; t += 0.1) {
        const scale = projectionFor(lerpBbox(wideBbox(focus), focus, Math.min(1, t)), MAP_BOX).scale();
        expect(scale).toBeGreaterThanOrEqual(prev - 1e-6);
        prev = scale;
      }
    }
  });
  it("the schema rejects focus latitudes the camera cannot honor", () => {
    const sb = (focus: number[]) => parseStoryboard({
      schemaVersion: 1, meta: { title: "t", theme: "bold-flat", voice: "v" }, audio: { music: null },
      scenes: [{ id: "m", type: "map", narration: "x", cues: [{ atWord: "x", do: "emphasize", text: "Italy" }], props: { title: "T", regions: ["Italy"], focus, factId: "f" } }],
    });
    expect(() => sb([0, 70, 10, 80])).not.toThrow();
    expect(() => sb([0, 70, 10, 85])).toThrow(StoryboardError);
  });
  it("a Pacific focus keeps its background countries at every zoom step (no antimeridian cull)", () => {
    const focus: Bbox = [110, -48, 180, -8];
    for (const t of [0, 0.5, 1]) {
      const projection = projectionFor(lerpBbox(wideBbox(focus), focus, t), MAP_BOX);
      const [w, , e] = visibleBbox(projection, MAP_BOX);
      expect(w).toBeLessThanOrEqual(e);
      const names = visibleCountries(visibleBbox(projection, MAP_BOX)).map((c) => c.properties.name);
      for (const n of ["Australia", "Indonesia", "New Zealand"]) expect(names).toContain(n);
    }
  });
  it("labels sit on the mainland polygon and inside the map box for every country", () => {
    const projection = projectionFor(MED, MAP_BOX);
    const path = geoPath(projection);
    const france = labelPosition(path, COUNTRY_BY_NAME.get("France")!, MAP_BOX);
    const paris = projection([2.5, 46.5]) as [number, number];
    expect(Math.hypot(france[0] - paris[0], france[1] - paris[1])).toBeLessThan(40);
    for (const c of COUNTRIES) {
      const [x, y] = labelPosition(path, c, MAP_BOX);
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(MAP_BOX.left);
      expect(x).toBeLessThanOrEqual(MAP_BOX.right);
      expect(y).toBeGreaterThanOrEqual(MAP_BOX.top);
      expect(y).toBeLessThanOrEqual(MAP_BOX.bottom);
    }
  });
});
