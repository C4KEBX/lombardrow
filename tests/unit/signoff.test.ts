import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { brandSignoff, voiceSignoff } from "../../src/voice/signoff";
import type { VoiceProvider } from "../../src/voice/types";

describe("brand sign-off", () => {
  it("has an approved take for the brand voice, read in one breath", () => {
    const take = brandSignoff("en-GB-RyanNeural")!;
    expect(fs.existsSync(take.audioPath)).toBe(true);
    expect(take.words.map((w) => w.text).join(" ")).toBe("Lombard Row, how money got this way!");
    expect(take.audioMs).toBeGreaterThan(take.words[take.words.length - 1].endMs);
  });
  it("falls back to reading the text for a voice without a take", async () => {
    const calls: string[] = [];
    const provider: VoiceProvider = async (text) => {
      calls.push(text);
      return { audioPath: "/x.mp3", audioMs: 1, words: [{ text: "x", startMs: 0, endMs: 1 }] };
    };
    await voiceSignoff(provider, "en-GB-ThomasNeural");
    expect(calls).toEqual(["Lombard Row, how money got this way!"]);
  });
});
