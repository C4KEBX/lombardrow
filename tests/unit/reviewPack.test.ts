import { describe, expect, it } from "vitest";
import { frameName, parseSceneCuts, parseSilences, renderReviewPack, reviewFrameTimes, transcriptLines } from "../../src/qa/reviewPack";

describe("review pack", () => {
  it("samples every 0.25 s for the first 5 s, then every 2 s", () => {
    const times = reviewFrameTimes(12);
    expect(times.slice(0, 3)).toEqual([0, 0.25, 0.5]);
    expect(times.filter((t) => t < 5)).toHaveLength(20);
    expect(times.slice(20)).toEqual([6, 8, 10]);
    expect(frameName(2.25)).toBe("t-002.25s.jpg");
  });

  it("reads cuts and silences from ffmpeg's output", () => {
    expect(parseSceneCuts("[Parsed_showinfo_1] n:0 pts:108 pts_time:3.6 pos\n... pts_time:6.8 ...")).toEqual([3.6, 6.8]);
    expect(parseSilences("[silencedetect] silence_start: 71.2\n[silencedetect] silence_end: 71.6 | silence_duration: 0.4")).toEqual([{ start: 71.2, end: 71.6 }]);
  });

  it("writes the narration in timed lines and the measured facts", () => {
    const words = ["Every", "mortgage", "payment", "pays", "off"].map((text, i) => ({ text, startMs: i * 700 }));
    expect(transcriptLines(words)).toEqual(["0.0 s: Every mortgage payment", "2.1 s: pays off"]);
    const md = renderReviewPack({ durationS: 60, width: 1080, height: 1920, loudnessLufs: -14, cuts: [3, 6], silences: [], words, frames: [] });
    expect(md).toMatch(/Hard cuts detected: 2 \(2\.0 a minute\), first at 3\.0 s/);
    expect(md).toMatch(/- 0\.0 s: Every mortgage payment/);
  });
});
