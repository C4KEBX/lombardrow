import { geoArea, geoMercator, type GeoPath, type GeoProjection } from "d3-geo";
import type { Feature, Geometry, Polygon } from "geojson";

export type Bbox = readonly [west: number, south: number, east: number, north: number];
type Box = { left: number; top: number; right: number; bottom: number };

export const WIDE_FACTOR = 2.4;
const MAX_LON = 180;
const MAX_LAT = 80; // Mercator stretches without bound towards the poles

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** The zoomed-out starting view: the focus box scaled about its center, clamped to the valid map range. */
export function wideBbox(focus: Bbox, factor = WIDE_FACTOR): Bbox {
  const [w, s, e, n] = focus;
  const [cx, cy] = [(w + e) / 2, (s + n) / 2];
  const [hx, hy] = [((e - w) / 2) * factor, ((n - s) / 2) * factor];
  return [
    clamp(cx - hx, -MAX_LON, MAX_LON),
    clamp(cy - hy, -MAX_LAT, MAX_LAT),
    clamp(cx + hx, -MAX_LON, MAX_LON),
    clamp(cy + hy, -MAX_LAT, MAX_LAT),
  ];
}

export function lerpBbox(a: Bbox, b: Bbox, t: number): Bbox {
  const mix = (i: 0 | 1 | 2 | 3): number => a[i] + (b[i] - a[i]) * t;
  return [mix(0), mix(1), mix(2), mix(3)];
}

/** Mercator projection that fits the lon/lat box inside `box` (corner bounds, so no polygon winding issues). */
export function projectionFor(bbox: Bbox, box: Box): GeoProjection {
  const [w, s, e, n] = bbox;
  return geoMercator().fitExtent(
    [[box.left, box.top], [box.right, box.bottom]],
    { type: "MultiPoint", coordinates: [[w, s], [e, s], [e, n], [w, n]] },
  );
}

/** The lon/lat window actually visible in `box` (larger than the fitted bbox along its non-binding axis). */
export function visibleBbox(projection: GeoProjection, box: Box): Bbox {
  const topLeft = projection.invert?.([box.left, box.top]) as [number, number];
  const bottomRight = projection.invert?.([box.right, box.bottom]) as [number, number];
  // d3 wraps inverted longitudes into [-180, 180]; a window that runs past the antimeridian then reads west > east.
  if (topLeft[0] > bottomRight[0]) return [-MAX_LON, bottomRight[1], MAX_LON, topLeft[1]];
  return [topLeft[0], bottomRight[1], bottomRight[0], topLeft[1]];
}

/** The polygons of a country (a MultiPolygon yields one feature per part). */
function polygonsOf(country: Feature<Geometry>): Feature<Polygon>[] {
  const g = country.geometry;
  if (g.type === "Polygon") return [{ type: "Feature", properties: {}, geometry: g }];
  if (g.type === "MultiPolygon") {
    return g.coordinates.map((coordinates) => ({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates } }));
  }
  return [];
}

/**
 * Where a country's label goes: the centroid of its largest polygon (so overseas territories and
 * outlying islands do not drag it off the mainland), clamped into the map box.
 */
export function labelPosition(path: GeoPath, country: Feature<Geometry>, box: Box): [number, number] {
  const parts = polygonsOf(country);
  const largest = parts.reduce((best, part) => (geoArea(part) > geoArea(best) ? part : best), parts[0] ?? country);
  const [x, y] = path.centroid(largest as Feature<Geometry>);
  const pad = 40;
  const fx = Number.isFinite(x) ? x : (box.left + box.right) / 2;
  const fy = Number.isFinite(y) ? y : (box.top + box.bottom) / 2;
  return [clamp(fx, box.left + pad, box.right - pad), clamp(fy, box.top + pad, box.bottom - pad)];
}
