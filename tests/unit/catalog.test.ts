import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SCENE_TYPES } from "../../src/schema/storyboard";
import { buildCatalog } from "../../src/skill/catalog";

const SCHEMA_FILE = path.resolve(".claude/skills/make-explainer/storyboard.schema.json");

describe("SCENE_TYPES", () => {
  it("lists every scene type the renderer supports", () => {
    expect([...SCENE_TYPES].sort()).toEqual(
      ["archival", "bar-race", "big-number", "compare", "flow-diagram", "kinetic-text", "ledger-page", "line-chart", "map", "quote", "timeline", "title"],
    );
  });
});

describe("buildCatalog", () => {
  const catalog = JSON.parse(buildCatalog());
  const text = buildCatalog();

  it("is valid JSON Schema text that names every scene type and the strictness of the contract", () => {
    for (const type of SCENE_TYPES) expect(text).toContain(`"${type}"`);
    expect(text).toContain('"additionalProperties": false');
    expect(catalog.type).toBe("object");
    expect(text.endsWith("\n")).toBe(true);
  });

  it("matches the committed file exactly, so schema changes must be regenerated with `npm run catalog`", () => {
    expect(fs.existsSync(SCHEMA_FILE)).toBe(true);
    expect(fs.readFileSync(SCHEMA_FILE, "utf-8")).toBe(buildCatalog());
  });
});
