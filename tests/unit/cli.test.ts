import { describe, expect, it } from "vitest";
import { parseArgs } from "../../src/pipeline/cli";

const base = ["--storyboard", "s.json", "--facts", "f.json", "--out", "out/x"];

describe("parseArgs", () => {
  it("applies defaults", () => {
    expect(parseArgs(base)).toMatchObject({
      storyboardPath: "s.json", factsPath: "f.json", outDir: "out/x", voice: "edge", enforceLength: true, remix: false,
    });
  });
  it("reads optional flags", () => {
    const o = parseArgs([...base, "--voice", "standin", "--no-enforce-length", "--music-dir", "m", "--sfx-dir", "x", "--cache-dir", "c", "--remix"]);
    expect(o).toMatchObject({ voice: "standin", enforceLength: false, musicDir: "m", sfxDir: "x", cacheDir: "c", remix: true });
  });
  it("rejects missing required flags, bad voices, unknown flags and missing values", () => {
    expect(() => parseArgs(["--facts", "f.json", "--out", "o"])).toThrow(/--storyboard/);
    expect(() => parseArgs([...base, "--voice", "robot"])).toThrow(/--voice/);
    expect(() => parseArgs([...base, "--bogus"])).toThrow(/Unknown flag/);
    expect(() => parseArgs([...base, "--voice"])).toThrow(/needs a value/);
  });
});
