import { describe, expect, it } from "vitest";
import { parseFacts } from "../../src/schema/facts";

const withUrl = (url: string) => ({
  facts: [{ id: "f1", claim: "c", source: { name: "n", url } }],
});

describe("fact source urls", () => {
  it("accepts http and https", () => {
    expect(() => parseFacts(withUrl("https://example.com/a"))).not.toThrow();
    expect(() => parseFacts(withUrl("http://example.com/a"))).not.toThrow();
  });
  it("rejects javascript:, file: and data: urls", () => {
    for (const bad of ["javascript:alert(1)", "file:///etc/passwd", "data:text/html,hi"]) {
      expect(() => parseFacts(withUrl(bad))).toThrow(/http/);
    }
  });
});
