import { geoBounds } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import world from "world-atlas/countries-110m.json";
import type { Bbox } from "./camera";

export type Country = Feature<Geometry, { name: string }>;

const topology = world as unknown as Topology;
export const COUNTRIES: readonly Country[] = (
  feature(topology, topology.objects.countries as GeometryCollection) as FeatureCollection<Geometry, { name: string }>
).features;

export const COUNTRY_BY_NAME: ReadonlyMap<string, Country> = new Map(COUNTRIES.map((c) => [c.properties.name, c]));
export const COUNTRY_NAMES: ReadonlySet<string> = new Set(COUNTRY_BY_NAME.keys());

/** Names that contain, or are contained in, the query (case-insensitive): hints for a near-miss region name. */
export function suggestCountries(name: string, limit = 3): string[] {
  const q = name.trim().toLowerCase();
  if (q === "") return [];
  return [...COUNTRY_NAMES]
    .filter((n) => n.toLowerCase().includes(q) || q.includes(n.toLowerCase()))
    .slice(0, limit);
}

const BOUNDS = new Map(COUNTRIES.map((c) => [c.properties.name, geoBounds(c)]));

/** Does the country's bounding box touch `bbox`? Bounds that wrap the antimeridian cover both ends. */
export function regionTouchesBbox(name: string, bbox: Bbox): boolean {
  const [w, s, e, n] = bbox;
  const [[cw, cs], [ce, cn]] = BOUNDS.get(name) as [[number, number], [number, number]];
  if (cs > n || cn < s) return false;
  const lonOverlap = (lo: number, hi: number): boolean => lo <= e && hi >= w;
  return cw <= ce ? lonOverlap(cw, ce) : lonOverlap(cw, 180) || lonOverlap(-180, ce);
}

/** Countries whose bounding box touches `bbox`. */
export function visibleCountries(bbox: Bbox): Country[] {
  return COUNTRIES.filter((c) => regionTouchesBbox(c.properties.name, bbox));
}
