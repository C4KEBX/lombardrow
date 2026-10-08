import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { meanVolumeDb, probeDurationMs } from "../../src/audio/probe";
import { makeStandinProvider, standinArgs, standinGate, synthWords } from "../../src/voice/standin";
import { makeVoiceProvider } from "../../src/voice/index";

describe("standinGate", () => {
  it("has one between() term per word", () => {
    const words = synthWords("one two three");
    const gate = standinGate(words);
    expect(gate.match(/between\(/g)).toHaveLength(3);
    expect(gate.startsWith("min(1,")).toBe(true);
  });
  it("uses seconds with millisecond precision", () => {
    expect(standinGate([{ text: "a", startMs: 1234, endMs: 2000 }])).toContain("between(t,1.234,2.000)");
  });
});

describe("standinArgs", () => {
  it("builds a pink-noise lavfi command writing the given path", () => {
    const args = standinArgs(synthWords("hi there"), "/t/out.wav");
    expect(args.join(" ")).toMatch(/anoisesrc=color=pink:duration=/);
    expect(args[args.length - 1]).toBe("/t/out.wav");
  });
});

describe("makeStandinProvider", () => {
  it("makes audible audio only while words are spoken and reuses the cache", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "standin-"));
    const provider = makeStandinProvider(dir);
    const result = await provider("Stocks fell sharply today.", "v");
    const last = result.words[result.words.length - 1];
    expect(result.audioMs).toBeCloseTo(last.endMs + 200, -2);
    expect(await probeDurationMs(result.audioPath)).toBeCloseTo(result.audioMs, -2);
    const first = result.words[0];
    expect(await meanVolumeDb(result.audioPath, first.startMs / 1000, (first.endMs - first.startMs) / 1000)).toBeGreaterThan(-45);
    const gapStartSec = (result.words[0].endMs + 5) / 1000; // inside the 40 ms gap before the next word
    expect(await meanVolumeDb(result.audioPath, gapStartSec, 0.03)).toBeLessThan(-60);
    const again = await provider("Stocks fell sharply today.", "v");
    expect(again.audioPath).toBe(result.audioPath);
  });
  it("selects providers by mode", () => {
    expect(typeof makeVoiceProvider("standin", "/tmp/x")).toBe("function");
    expect(typeof makeVoiceProvider("edge", "/tmp/x")).toBe("function");
    expect(() => makeVoiceProvider("nope" as never, "/tmp/x")).toThrow(/voice mode/i);
  });
});
