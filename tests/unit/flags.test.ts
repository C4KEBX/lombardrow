import { describe, expect, it } from "vitest";
import { parseFlags } from "../../src/skill/flags";

describe("parseFlags", () => {
  const spec = { values: ["--storyboard", "--facts"], booleans: ["--json"] };
  it("reads value flags and boolean flags", () => {
    const r = parseFlags(["--storyboard", "a.json", "--json", "--facts", "b.json"], spec);
    expect(r.values.get("--storyboard")).toBe("a.json");
    expect(r.values.get("--facts")).toBe("b.json");
    expect(r.flags.has("--json")).toBe(true);
  });
  it("rejects unknown flags and a missing or flag-like value", () => {
    expect(() => parseFlags(["--nope"], spec)).toThrow(/Unknown flag --nope/);
    expect(() => parseFlags(["--storyboard"], spec)).toThrow(/needs a value/);
    expect(() => parseFlags(["--storyboard", "--facts"], spec)).toThrow(/needs a value/);
  });
});
