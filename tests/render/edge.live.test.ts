import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveCue } from "../../src/schema/timing";
import { makeEdgeProvider } from "../../src/voice/edge";

const narration = "Between 2007 and 2009, the S&P 500 lost more than half of its value.";

describe.skipIf(process.env.RUN_NETWORK_TESTS !== "1")("Edge TTS live", () => {
  it("synthesizes, aligns every narration token and resolves cues on digit tokens", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "edge-live-"));
    const voice = await makeEdgeProvider(dir)(narration, "en-US-AndrewNeural");
    expect(voice.words.map((w) => w.text)).toEqual(narration.split(" "));
    expect(resolveCue(voice.words, "2007")).toBeLessThan(resolveCue(voice.words, "2009"));
    expect(Math.abs(voice.words[voice.words.length - 1].endMs - voice.audioMs)).toBeLessThan(1000);
    console.log(JSON.stringify(voice.words.map((w) => [w.text, Math.round(w.startMs), Math.round(w.endMs)])));
  }, 60000);
});
