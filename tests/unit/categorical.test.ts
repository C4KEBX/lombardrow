import { describe, expect, it } from "vitest";
import { CATEGORICAL, PALETTE } from "../../src/design/tokens";

describe("CATEGORICAL palette", () => {
  it("has 8 distinct hex colors", () => {
    expect(CATEGORICAL).toHaveLength(8);
    expect(new Set(CATEGORICAL).size).toBe(8);
    for (const c of CATEGORICAL) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
  });
  it("never reuses the semantic gain/loss colors", () => {
    expect(CATEGORICAL).not.toContain(PALETTE.positive);
    expect(CATEGORICAL).not.toContain(PALETTE.negative);
  });
});
