import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderSheet } from "../../src/skill/sheetRender";

describe("renderSheet (history demo)", () => {
  it("writes a self-contained review.html with one embedded still per scene", async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "sheet-"));
    const file = await renderSheet({
      storyboardPath: path.resolve("fixtures/history.storyboard.json"),
      factsPath: path.resolve("fixtures/history.facts.json"),
      outDir: out,
    });
    const html = fs.readFileSync(file, "utf-8");
    expect(path.basename(file)).toBe("review.html");
    expect((html.match(/<img /g) ?? []).length).toBe(5);
    expect(html).toContain("data:image/png;base64,");
    expect(html).not.toMatch(/<script/i);
    for (const id of ["intro", "east-west", "people", "census", "veni"]) expect(html).toContain(id);
  }, 240000);
});
