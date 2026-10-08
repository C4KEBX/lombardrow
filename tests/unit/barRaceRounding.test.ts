import { describe, expect, it } from "vitest";
import { parseFacts } from "../../src/schema/facts";
import { parseStoryboard } from "../../src/schema/storyboard";
import { assertFactsTraceable } from "../../src/schema/validate";

const mk = (value: number, decimals?: number) => {
  const frames = [
    { label: "a", values: [{ name: "A", value }, { name: "B", value: 2 }] },
    { label: "b", values: [{ name: "A", value: 3 }, { name: "B", value: 2 }] },
  ];
  const sb = parseStoryboard({
    schemaVersion: 1,
    meta: { title: "t", theme: "lombard-row", voice: "v" },
    audio: { music: null },
    scenes: [{
      id: "r1", type: "bar-race", narration: "Race.",
      props: { title: "T", frames, factId: "f1", ...(decimals === undefined ? {} : { decimals }) },
    }],
  });
  const facts = parseFacts({
    facts: [{ id: "f1", claim: "c", dataset: frames, source: { name: "n", url: "https://example.com/" } }],
  });
  return { sb, facts };
};

describe("bar-race values must display exactly", () => {
  it("rejects a value that the decimals would round on screen", () => {
    const { sb, facts } = mk(3.456, 0);
    expect(() => assertFactsTraceable(sb, facts)).toThrow(/"r1".*would display 3 for value 3\.456/);
  });
  it("accepts values exact at the chosen decimals", () => {
    const { sb, facts } = mk(3.456, 3);
    expect(() => assertFactsTraceable(sb, facts)).not.toThrow();
    const ints = mk(7);
    expect(() => assertFactsTraceable(ints.sb, ints.facts)).not.toThrow();
  });
});
