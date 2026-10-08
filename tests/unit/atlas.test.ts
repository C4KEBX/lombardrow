import { describe, expect, it } from "vitest";
import { geoBounds } from "d3-geo";
import { COUNTRIES, COUNTRY_BY_NAME, COUNTRY_NAMES, regionTouchesBbox, suggestCountries, visibleCountries } from "../../src/map/atlas";

describe("atlas", () => {
  it("loads the 110m countries with names", () => {
    expect(COUNTRIES.length).toBeGreaterThan(170);
    for (const name of ["Italy", "Spain", "France", "Greece", "Turkey", "Egypt", "Russia"]) {
      expect(COUNTRY_NAMES.has(name)).toBe(true);
      expect(COUNTRY_BY_NAME.get(name)?.properties.name).toBe(name);
    }
  });
  it("has unique names", () => {
    expect(COUNTRY_NAMES.size).toBe(COUNTRIES.length);
  });
  it("suggests close names for a near miss", () => {
    expect(suggestCountries("United States")).toContain("United States of America");
    expect(suggestCountries("czech").map((n) => n.toLowerCase()).join(" ")).toContain("czech");
    expect(suggestCountries("zzzz")).toEqual([]);
  });
});

describe("visibleCountries", () => {
  const MED: [number, number, number, number] = [-12, 28, 45, 56];
  it("keeps countries inside the box and drops far ones", () => {
    const names = visibleCountries(MED).map((c) => c.properties.name);
    expect(names).toContain("Italy");
    expect(names).toContain("Egypt");
    expect(names).not.toContain("Australia");
  });
  it("treats countries whose bounds cross the antimeridian by the side they actually cover", () => {
    const names = (box: [number, number, number, number]) => new Set(visibleCountries(box).map((c) => c.properties.name));
    expect(names(MED).has("Russia")).toBe(true); // Russia spans 19E..180
    expect(names(MED).has("Fiji")).toBe(false);
    expect(names([170, -25, 180, -10]).has("Fiji")).toBe(true);
    expect(names([-180, -25, -170, -10]).has("Fiji")).toBe(true);
  });
});

describe("regionTouchesBbox", () => {
  it("is true when the country overlaps the box and false when it does not", () => {
    expect(regionTouchesBbox("Italy", [-12, 28, 45, 56])).toBe(true);
    expect(regionTouchesBbox("Japan", [-12, 28, 45, 56])).toBe(false);
  });
});
