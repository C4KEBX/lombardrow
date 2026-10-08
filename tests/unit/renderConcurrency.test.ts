import { describe, expect, it } from "vitest";
import { renderConcurrency } from "../../src/pipeline/bundle";

describe("renderConcurrency", () => {
  it("uses every core but one by default", () => {
    expect(renderConcurrency(8, undefined)).toBe(7);
    expect(renderConcurrency(1, undefined)).toBe(1);
  });
  it("takes a count or a percentage from RENDER_CONCURRENCY", () => {
    expect(renderConcurrency(8, "4")).toBe(4);
    expect(renderConcurrency(8, "50%")).toBe("50%");
  });
});
