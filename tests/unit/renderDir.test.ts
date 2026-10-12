import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseArgs } from "../../src/pipeline/cli";
import { doorFolder, outDirFor, renderDir, rendersRoot } from "../../src/pipeline/renderDir";

const sb = (doorNo: unknown) => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "rd-")), "storyboard.json");
  fs.writeFileSync(file, JSON.stringify({ meta: { doorNo } }));
  return file;
};

describe("render folders", () => {
  it("keeps one folder per video, named by door number", () => {
    expect(doorFolder(2)).toBe("no-002");
    expect(renderDir(12, "factcheck", "/r")).toBe(path.join("/r", "no-012", "factcheck"));
  });
  it("roots at renders/ unless LOMBARD_RENDERS_DIR says otherwise", () => {
    expect(rendersRoot({})).toBe(path.resolve("renders"));
    expect(rendersRoot({ LOMBARD_RENDERS_DIR: "/shared/renders" })).toBe("/shared/renders");
  });
  it("defaults --out to the storyboard's final/ folder, and an explicit --out wins", () => {
    expect(outDirFor(sb(2), undefined, "/r")).toBe(path.join("/r", "no-002", "final"));
    expect(outDirFor(sb(2), "out/x")).toBe("out/x");
    expect(() => outDirFor(sb("two"))).toThrow(/meta.doorNo/);
  });
  it("lets produce run without --out", () => {
    expect(parseArgs(["--storyboard", sb(3), "--facts", "f.json"]).outDir).toBe(renderDir(3, "final"));
  });
});
