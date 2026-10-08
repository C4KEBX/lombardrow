import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { makeEdgeProvider, parseEvents, ttsArgs, voiceCacheKey, type EdgeDeps } from "../../src/voice/edge";

describe("voiceCacheKey", () => {
  it("is stable and depends on both voice and narration", () => {
    expect(voiceCacheKey("v", "hello")).toBe(voiceCacheKey("v", "hello"));
    expect(voiceCacheKey("v", "hello")).not.toBe(voiceCacheKey("w", "hello"));
    expect(voiceCacheKey("v", "hello")).not.toBe(voiceCacheKey("v", "hello!"));
    expect(voiceCacheKey("v", "hello")).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("ttsArgs", () => {
  it("builds the python adapter argument list", () => {
    const args = ttsArgs("en-US-AndrewNeural", "/t/in.txt", "/t/out.mp3", "/t/out.json");
    expect(args.slice(1)).toEqual([
      "--voice", "en-US-AndrewNeural", "--text-file", "/t/in.txt",
      "--out-mp3", "/t/out.mp3", "--out-json", "/t/out.json",
    ]);
    expect(args[0]).toMatch(/tts\/tts\.py$/);
  });
});

describe("parseEvents", () => {
  it("parses a valid event list", () => {
    expect(parseEvents('[{"text":"Hi","startMs":0,"endMs":300}]')).toEqual([{ text: "Hi", startMs: 0, endMs: 300 }]);
  });
  it("rejects malformed JSON and wrong shapes readably", () => {
    expect(() => parseEvents("not json")).toThrow(/events/i);
    expect(() => parseEvents('[{"text":"Hi"}]')).toThrow(/events/i);
    expect(() => parseEvents('{"a":1}')).toThrow(/events/i);
  });
});

describe("makeEdgeProvider", () => {
  const fakeDeps = (calls: string[][]): EdgeDeps => ({
    runTts: async (args) => {
      calls.push(args);
      const get = (flag: string) => args[args.indexOf(flag) + 1];
      fs.writeFileSync(get("--out-mp3"), "mp3");
      fs.writeFileSync(
        get("--out-json"),
        JSON.stringify([{ text: "Hello", startMs: 100, endMs: 500 }, { text: "world", startMs: 500, endMs: 900 }]),
      );
    },
    probe: async () => 1200,
  });

  it("synthesizes once, aligns words to the narration and reuses the cache", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "edge-"));
    const calls: string[][] = [];
    const provider = makeEdgeProvider(dir, fakeDeps(calls));
    const first = await provider("Hello world.", "v");
    expect(first.words).toEqual([
      { text: "Hello", startMs: 100, endMs: 500 },
      { text: "world.", startMs: 500, endMs: 900 },
    ]);
    expect(first.audioMs).toBe(1200);
    expect(fs.existsSync(first.audioPath)).toBe(true);
    await provider("Hello world.", "v");
    expect(calls).toHaveLength(1);
  });
  it("re-synthesizes when the narration or voice changes", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "edge-"));
    const calls: string[][] = [];
    const provider = makeEdgeProvider(dir, fakeDeps(calls));
    await provider("Hello world.", "v");
    await provider("Hello world!", "v");
    await provider("Hello world.", "w");
    expect(calls).toHaveLength(3);
  });
  it("does not leave a cache entry when synthesis fails", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "edge-"));
    const failing: EdgeDeps = { runTts: async () => { throw new Error("offline"); }, probe: async () => 1 };
    const provider = makeEdgeProvider(dir, failing);
    await expect(provider("Hello world.", "v")).rejects.toThrow(/offline/);
    expect(fs.readdirSync(dir).filter((f) => f.endsWith(".mp3") || f.endsWith(".events.json"))).toEqual([]);
    const ok = makeEdgeProvider(dir, fakeDeps([]));
    await expect(ok("Hello world.", "v")).resolves.toBeDefined();
  });
  it("fails loudly when the voice words differ from the narration", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "edge-"));
    const provider = makeEdgeProvider(dir, fakeDeps([]));
    await expect(provider("Goodbye moon.", "v")).rejects.toThrow(/differ from the narration/);
  });
});
