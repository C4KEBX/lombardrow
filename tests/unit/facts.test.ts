import { describe, expect, it } from "vitest";
import { parseFacts } from "../../src/schema/facts";
import { StoryboardError } from "../../src/schema/storyboard";

const fact = (id: string) => ({
  id, claim: "c", value: 57, source: { name: "S&P DJI", url: "https://www.spglobal.com/" },
});

describe("parseFacts", () => {
  it("accepts valid facts", () => {
    expect(parseFacts({ facts: [fact("f1"), fact("f2")] }).facts).toHaveLength(2);
  });
  it("rejects duplicate fact ids", () => {
    expect(() => parseFacts({ facts: [fact("f1"), fact("f1")] })).toThrow(StoryboardError);
  });
  it("rejects a fact without a valid source url", () => {
    const bad = { ...fact("f1"), source: { name: "x", url: "not a url" } };
    expect(() => parseFacts({ facts: [bad] })).toThrow(StoryboardError);
  });
  it("rejects an empty facts list", () => {
    expect(() => parseFacts({ facts: [] })).toThrow(StoryboardError);
  });
});
