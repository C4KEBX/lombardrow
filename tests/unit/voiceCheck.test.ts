import { describe, expect, it } from "vitest";
import { formatVoiceReport, voiceCheck } from "../../src/pipeline/voiceCheck";
import { synthWords } from "../../src/voice/synthWords";
import type { VoiceProvider } from "../../src/voice/types";

const SB = "fixtures/no-004/rule-of-72.storyboard.json";
const FACTS = "fixtures/no-004/rule-of-72.facts.json";

/** A fake voice that speaks at `scale` times the synthetic pace. */
const fakeVoice = (scale: number, calls: string[] = []): VoiceProvider => async (narration) => {
  calls.push(narration);
  const words = synthWords(narration).map((w) => ({ ...w, startMs: w.startMs * scale, endMs: w.endMs * scale }));
  return { audioPath: "/dev/null", words, audioMs: words[words.length - 1].endMs + 200 };
};

describe("voiceCheck", () => {
  it("voices every scene plus the sign-off and reports the laid-out length", async () => {
    const calls: string[] = [];
    const report = await voiceCheck(SB, FACTS, fakeVoice(0.95, calls));
    expect(calls).toHaveLength(report.scenes.length + 1);
    expect(calls[calls.length - 1]).toMatch(/^Lombard\. Row\./);
    const sum = report.scenes.reduce((a, x) => a + x.sceneMs, 0) + report.closeMs;
    expect(report.totalMs).toBeCloseTo(sum, 0);
    // A scene holds its last word plus the short tail; the clip's trailing silence plays under the next scene.
    for (const scene of report.scenes) expect(scene.sceneMs).toBeGreaterThanOrEqual(scene.voiceMs - 200 - 34);
    expect(report.withinGate).toBe(report.totalMs >= 55_000 && report.totalMs <= 70_000);
  });
  it("flags a read that runs long", async () => {
    const report = await voiceCheck(SB, FACTS, fakeVoice(1.3));
    expect(report.withinGate).toBe(false);
    expect(formatVoiceReport(report)).toMatch(/LONG by \d+\.\ds/);
  });
  it("flags a read that runs short", async () => {
    const report = await voiceCheck(SB, FACTS, fakeVoice(0.6));
    expect(report.withinGate).toBe(false);
    expect(formatVoiceReport(report)).toMatch(/SHORT by/);
  });
  it("lists every scene with its voice and on-screen time", async () => {
    const report = await voiceCheck(SB, FACTS, fakeVoice(0.95));
    const text = formatVoiceReport(report);
    for (const scene of report.scenes) expect(text).toContain(scene.id);
    expect(text).toMatch(/^\(door\)/m);
    expect(text).toMatch(/Total \d+\.\ds \(gate 55-70s\)/);
  });
});
