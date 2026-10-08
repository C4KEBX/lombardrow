import { describe, expect, it } from "vitest";
import { parseFacts } from "../../src/schema/facts";
import { factTokens, htmlToText, isBlockedAddress, isBlockedUrl, verifyFact as verifyFactReal, verifyFacts as verifyFactsReal } from "../../src/skill/verifyFacts";

const PUBLIC = async () => ["93.184.216.34"];
type Opts = Parameters<typeof verifyFactReal>[2];
const verifyFact = (f: Parameters<typeof verifyFactReal>[0], fetchImpl: typeof fetch, opts: Opts = {}) => verifyFactReal(f, fetchImpl, { resolve: PUBLIC, ...opts });
const verifyFacts = (facts: Parameters<typeof verifyFactsReal>[0], fetchImpl: typeof fetch) => verifyFactsReal(facts, fetchImpl, { resolve: PUBLIC });

const fact = (extra: Record<string, unknown>, url = "https://example.org/page") =>
  parseFacts({ facts: [{ id: "f", claim: "c", source: { name: "n", url }, ...extra }] }).facts[0];

const page = (body: string, init: ResponseInit = {}) =>
  new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" }, ...init });
const fetchOf = (...responses: (Response | Error)[]): typeof fetch => {
  const queue = [...responses];
  return (async () => {
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return next ?? page("");
  }) as unknown as typeof fetch;
};

describe("isBlockedUrl", () => {
  it("blocks non-http schemes, localhost, private, link-local and shared ranges", () => {
    for (const url of [
      "file:///etc/passwd", "ftp://example.org/x", "http://localhost/x", "http://api.localhost/", "http://printer.local/",
      "http://service.internal/", "http://127.0.0.1/", "http://10.1.2.3/", "http://172.16.0.1/", "http://172.31.255.255/",
      "http://192.168.1.1/", "http://169.254.169.254/latest/meta-data", "http://100.64.0.1/", "http://0.0.0.0/",
      "http://[::1]/", "http://[fd00::1]/", "http://[fe80::1]/", "http://2130706433/", "http://0x7f000001/",
    ]) {
      expect(isBlockedUrl(url), url).toBe(true);
    }
  });
  it("allows ordinary public https hosts, and 172.32 which is outside the private block", () => {
    expect(isBlockedUrl("https://www.bls.gov/cpi/")).toBe(false);
    expect(isBlockedUrl("https://en.wikipedia.org/wiki/Han_dynasty")).toBe(false);
    expect(isBlockedUrl("http://172.32.0.1/")).toBe(false);
  });
});

describe("isBlockedUrl: bypasses found in review", () => {
  it("blocks IPv4-mapped, compatible and NAT64 IPv6, trailing-dot names, and multicast/broadcast/benchmark ranges", () => {
    for (const url of [
      "http://[::ffff:127.0.0.1]/", "http://[::ffff:10.0.0.1]/", "http://[::127.0.0.1]/", "http://[64:ff9b::7f00:1]/",
      "http://localhost./", "http://foo.localhost./", "http://metadata.google.internal./", "http://224.0.0.1/",
      "http://255.255.255.255/", "http://198.18.0.1/",
    ]) {
      expect(isBlockedUrl(url), url).toBe(true);
    }
    expect(isBlockedUrl("http://[::ffff:8.8.8.8]/")).toBe(false);
  });
});

describe("DNS resolution", () => {
  it("blocks a public-looking name that resolves to a private address, without fetching", async () => {
    let called = false;
    const spy = (async () => { called = true; return page(""); }) as unknown as typeof fetch;
    const r = await verifyFactReal(fact({ value: 5 }, "https://rebind.example.org/"), spy, { resolve: async () => ["10.0.0.5"] });
    expect(r.status).toBe("blocked");
    expect(r.detail).toMatch(/resolves to/);
    expect(called).toBe(false);
  });
  it("blocks when any one of several addresses is private, and re-resolves every redirect hop", async () => {
    const r = await verifyFactReal(fact({ value: 5 }, "https://multi.example.org/"), fetchOf(page("5")), { resolve: async () => ["93.184.216.34", "127.0.0.1"] });
    expect(r.status).toBe("blocked");
    const hops: string[] = [];
    const resolve = async (host: string) => { hops.push(host); return host === "b.example.org" ? ["169.254.169.254"] : ["93.184.216.34"]; };
    const redirect = new Response(null, { status: 302, headers: { location: "https://b.example.org/x" } });
    const r2 = await verifyFactReal(fact({ value: 5 }, "https://a.example.org/"), fetchOf(redirect), { resolve });
    expect(r2.status).toBe("blocked");
    expect(hops).toEqual(["a.example.org", "b.example.org"]);
  });
  it("is unreachable when the name does not resolve", async () => {
    const r = await verifyFactReal(fact({ value: 5 }), fetchOf(page("5")), { resolve: async () => { throw new Error("ENOTFOUND"); } });
    expect(r.status).toBe("unreachable");
  });
});

describe("factTokens", () => {
  it("uses the value in plain and comma forms", () => {
    expect(factTokens(fact({ value: 1468.36 }))).toEqual(expect.arrayContaining(["1468.36", "1,468.36"]));
    expect(factTokens(fact({ value: 57 }))).toEqual(["57"]);
  });
  it("uses every number in a dataset as absolute values (BC years included), deduped", () => {
    const tokens = factTokens(fact({ dataset: [{ year: -753, label: "x" }, { year: 476, label: "y" }, { year: 476, label: "z" }] }));
    expect(tokens).toEqual(expect.arrayContaining(["753", "476"]));
    expect(new Set(tokens).size).toBe(tokens.length);
  });
  it("is empty when the fact has no numbers", () => {
    expect(factTokens(fact({ dataset: ["Italy", "Spain"] }))).toEqual([]);
  });
});

describe("isBlockedAddress", () => {
  it.each([
    "0:0:0:0:0:ffff:7f00:1", "0000:0000:0000:0000:0000:ffff:7f00:0001", "::ffff:10.0.0.1", "64:ff9b::a00:1",
    "64:ff9b:1::1", "2002:7f00:1::", "2002:a00:1::", "2002:c0a8:101::", "fec0::1", "2001:db8::1", "2001:0:4136:e378::1", "100::1",
    "192.0.0.1", "192.0.2.1", "198.51.100.1", "203.0.113.1", "192.88.99.1", "not-an-ip:::", "1:2:3:4:5:6:7:8:9",
  ])("blocks %s", (addr) => expect(isBlockedAddress(addr)).toBe(true));

  it.each(["93.184.216.34", "8.8.8.8", "2606:4700:4700::1111", "2001:4860:4860::8888", "2002:5db8:d822::1", "::ffff:8.8.8.8", "64:ff9b::808:808"])(
    "allows public %s",
    (addr) => expect(isBlockedAddress(addr)).toBe(false),
  );
});

describe("htmlToText", () => {
  it("drops scripts and styles, strips tags, decodes entities and collapses space", () => {
    const text = htmlToText("<style>a{}</style><script>var x=999;</script><p>A&nbsp;&amp;&nbsp;B <b>57.7</b></p>\n\n<p>million</p>");
    expect(text).toBe("A & B 57.7 million");
  });

  it("keeps the old behavior for unclosed and malformed markup", () => {
    expect(htmlToText("a <script>var x=1; b")).toBe("a var x=1; b"); // no </script>: only the tag is stripped
    expect(htmlToText("a <> b < 3 and 4 > 2")).toBe("a <> b 2");
    expect(htmlToText("<SCRIPT>1</SCRIPT>ok")).toBe("ok");
  });

  it("runs in linear time on pathological input", () => {
    const start = Date.now();
    htmlToText("<script ".repeat(100_000));
    htmlToText("<a".repeat(200_000));
    htmlToText("<style>".repeat(100_000) + "</style>");
    expect(Date.now() - start).toBeLessThan(1000);
  });
});

describe("verifyFact", () => {
  it("is supported when every token appears as a whole number on the page", async () => {
    const r = await verifyFact(fact({ value: 57.7 }), fetchOf(page("<p>The census recorded 57.7 million people</p>")));
    expect(r.status).toBe("supported");
    expect(r.found).toContain("57.7");
  });
  it("does not accept a token that is only part of a larger number", async () => {
    const r = await verifyFact(fact({ value: 57 }), fetchOf(page("<p>about 157 and 570 and 5.7</p>")));
    expect(r.status).toBe("not-found");
  });
  it("is partial for 60 percent or more and not-found below", async () => {
    const f = fact({ dataset: [{ x: 11, y: 12 }, { x: 13, y: 14 }, { x: 15, y: 16 }] });
    expect((await verifyFact(f, fetchOf(page("11 12 13 14")))).status).toBe("partial");
    expect((await verifyFact(f, fetchOf(page("11 12")))).status).toBe("not-found");
  });
  it("is unreachable on network errors, timeouts, non-2xx and non-text content", async () => {
    const f = fact({ value: 5 });
    expect((await verifyFact(f, fetchOf(new Error("ECONNREFUSED")))).status).toBe("unreachable");
    expect((await verifyFact(f, fetchOf(new Response("no", { status: 404 })))).status).toBe("unreachable");
    expect((await verifyFact(f, fetchOf(new Response("%PDF", { status: 200, headers: { "content-type": "application/pdf" } })))).status).toBe("unreachable");
    const slow = (async (_u: unknown, init?: RequestInit) =>
      new Promise((_r, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))))) as unknown as typeof fetch;
    expect((await verifyFact(f, slow, { timeoutMs: 20 })).status).toBe("unreachable");
  });
  it("treats the plain and comma forms of one number as a single token, so years can be supported", async () => {
    const f = fact({ dataset: [{ x: 2015, y: 0.1 }, { x: 2016, y: 1.3 }] });
    const r = await verifyFact(f, fetchOf(page("2015 0.1 2016 1.3")));
    expect(r.status).toBe("supported");
    expect(r.missing).toEqual([]);
    const big = await verifyFact(fact({ value: 1468.36 }), fetchOf(page("closed at 1,468.36")));
    expect(big.status).toBe("supported");
    expect(big.found).toEqual(["1468.36"]);
  });
  it("never fetches a blocked URL", async () => {
    let called = false;
    const spy = (async () => { called = true; return page(""); }) as unknown as typeof fetch;
    const r = await verifyFact(fact({ value: 5 }, "http://169.254.169.254/latest/meta-data"), spy);
    expect(r.status).toBe("blocked");
    expect(called).toBe(false);
  });
  it("re-checks every redirect hop and stops at three hops", async () => {
    const redirect = (to: string) => new Response(null, { status: 302, headers: { location: to } });
    const toPrivate = await verifyFact(fact({ value: 5 }), fetchOf(redirect("http://127.0.0.1/admin")));
    expect(toPrivate.status).toBe("blocked");
    const loop = await verifyFact(
      fact({ value: 5 }),
      fetchOf(redirect("https://a.test/1"), redirect("https://a.test/2"), redirect("https://a.test/3"), redirect("https://a.test/4")),
    );
    expect(loop.status).toBe("unreachable");
    expect(loop.detail).toMatch(/redirect/);
  });
  it("caps the body it reads and says nothing numeric when there is nothing to check", async () => {
    const huge = "x".repeat(3_000_000) + " 57.7";
    expect((await verifyFact(fact({ value: 57.7 }), fetchOf(page(huge)))).status).toBe("not-found");
    expect((await verifyFact(fact({ dataset: ["Italy"] }), fetchOf(page("Italy")))).detail).toMatch(/nothing numeric/);
  });
  it("never buffers a response that has no stream to cap", async () => {
    const unstreamed = {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      body: null,
      text: async () => "57.7 million",
    } as unknown as Response;
    expect((await verifyFact(fact({ value: 57.7 }), fetchOf(unstreamed))).status).toBe("not-found");
  });
});

describe("verifyFacts", () => {
  it("returns one result per fact, in order", async () => {
    const facts = parseFacts({
      facts: [
        { id: "a", claim: "c", value: 1, source: { name: "n", url: "https://example.org/a" } },
        { id: "b", claim: "c", value: 2, source: { name: "n", url: "https://example.org/b" } },
      ],
    });
    const results = await verifyFacts(facts, fetchOf(page("1"), page("nothing")));
    expect(results.map((r) => [r.factId, r.status])).toEqual([["a", "supported"], ["b", "not-found"]]);
  });
});
