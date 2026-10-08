import { describe, expect, it } from "vitest";
import { namePrompt } from "../../src/qa/whisper";
import { DRIFT_MS, expectedWords, listenBack, parseWhisperJson, renderListenBack, spokenWords } from "../../src/qa/listenBack";

const scenes = [
  { id: "venice", narration: "It shows up in a book printed in Venice in 1494." },
  { id: "rule", narration: "Divide 72 by the rate." },
];
/** One caption word per written token, 400 ms apart. */
const captions = scenes.flatMap((s) => s.narration.split(/\s+/)).map((text, i) => ({ text, startMs: i * 400 }));
const expected = expectedWords(scenes, captions, "Lombard Row.");

/** What a perfect transcript would hear: each spoken word at its caption's time. */
function perfect(): { text: string; startMs: number; endMs: number }[] {
  return expected.map((e, i) => ({ text: e.word, startMs: e.captionMs ?? 9000 + i * 300, endMs: (e.captionMs ?? 9000) + 250 }));
}

describe("spokenWords", () => {
  it("spells numbers as the voice says them and splits hyphens", () => {
    expect(spokenWords("Venice in 1494.")).toEqual(["venice", "in", "fourteen", "ninety", "four"]);
    expect(spokenWords("$1,000")).toEqual(["one", "thousand", "dollars"]);
    expect(spokenWords("seventy-two")).toEqual(["seventy", "two"]);
  });
});

describe("parseWhisperJson", () => {
  it("reads one word per segment, skipping blanks and bracketed noise", () => {
    const words = parseWhisperJson({
      transcription: [
        { timestamps: { from: "00:00:00,000", to: "00:00:00,320" }, offsets: { from: 0, to: 320 }, text: " Divide" },
        { timestamps: { from: "00:00:01,500", to: "00:00:01,900" }, text: " 72" },
        { offsets: { from: 2000, to: 2100 }, text: " [MUSIC]" },
        { offsets: { from: 2100, to: 2200 }, text: " " },
      ],
    });
    expect(words).toEqual([{ text: "Divide", startMs: 0, endMs: 320 }, { text: "72", startMs: 1500, endMs: 1900 }]);
  });
  it("rejects output that is not whisper.cpp JSON", () => {
    expect(() => parseWhisperJson({})).toThrow(/no transcription/);
    expect(() => parseWhisperJson({ transcription: [{ text: "x", timestamps: { from: "bad", to: "bad" } }] })).toThrow(/hh:mm:ss/);
  });
});

describe("parseWhisperJson with DTW token times", () => {
  it("joins tokens into words and times each from its first token (centiseconds)", () => {
    const words = parseWhisperJson({
      transcription: [{
        offsets: { from: 0, to: 5000 }, text: " Lenders in 1494.",
        tokens: [
          { text: "[_BEG_]", t_dtw: -1 }, { text: " L", t_dtw: 498 }, { text: "enders", t_dtw: 514 },
          { text: " in", t_dtw: 600 }, { text: " 14", t_dtw: 700 }, { text: "94", t_dtw: 720 }, { text: ".", t_dtw: 800 }, { text: "[_TT_250]", t_dtw: -1 },
        ],
      }],
    });
    expect(words.map((w) => [w.text, w.startMs])).toEqual([["Lenders", 4980], ["in", 6000], ["1494.", 7000]]);
  });
});

describe("namePrompt", () => {
  it("collects capitalized words that do not start a sentence", () => {
    expect(namePrompt(["It shows up in Venice. Luca Pacioli set it down.", "The rule says nine."])).toBe("Venice, Pacioli");
  });
});

describe("listenBack", () => {
  it("finds nothing when the voice says the script on cue", () => {
    expect(listenBack(expected, perfect())).toMatchObject({ mismatches: [], drift: [] });
  });
  it("accepts a transcript that writes numbers as digits", () => {
    const heard = perfect();
    const at = expected.findIndex((e) => e.word === "fourteen");
    heard.splice(at, 3, { text: "1494.", startMs: heard[at].startMs, endMs: heard[at].endMs });
    expect(listenBack(expected, heard).mismatches).toEqual([]);
  });
  it("flags a misheard number and says which scene", () => {
    const heard = perfect().map((w) => (w.text === "ninety" ? { ...w, text: "eighty" } : w));
    const { mismatches } = listenBack(expected, heard);
    expect(mismatches).toEqual([expect.objectContaining({ sceneId: "venice", expected: "ninety", heard: "eighty", number: true })]);
  });
  it("flags missing and extra words", () => {
    const heard = perfect().filter((w) => w.text !== "printed");
    heard.splice(1, 0, { text: "really", startMs: 410, endMs: 500 });
    const { mismatches } = listenBack(expected, heard);
    expect(mismatches.map((m) => [m.expected, m.heard, m.number])).toEqual([["", "really", false], ["printed", "", false]]);
  });
  it("flags captions more than the drift limit from the voice, once per caption word", () => {
    const heard = perfect().map((w) => (w.text === "divide" || w.text === "seventy" ? { ...w, startMs: w.startMs + DRIFT_MS + 100 } : w));
    const { drift } = listenBack(expected, heard);
    expect(drift.map((d) => [d.sceneId, d.word])).toEqual([["rule", "Divide"], ["rule", "72"]]);
  });
  it("hears \"a thousand\" as \"one thousand\" without a mismatch", () => {
    const exp = expectedWords([{ id: "g", narration: "A thousand dollars." }], [{ text: "A", startMs: 0 }, { text: "thousand", startMs: 300 }, { text: "dollars.", startMs: 700 }], "");
    expect(listenBack(exp, [{ text: "1000", startMs: 0, endMs: 600 }, { text: "dollars", startMs: 700, endMs: 900 }]).mismatches).toEqual([]);
  });
  it("removes the transcript's steady offset before judging drift", () => {
    const late = perfect().map((w) => ({ ...w, startMs: w.startMs + 300 }));
    const report = listenBack(expected, late);
    expect(report.offsetMs).toBe(300);
    expect(report.drift).toEqual([]);
  });
  it("times only the first spoken word of a number heard as digits", () => {
    const heard = perfect();
    const at = expected.findIndex((e) => e.word === "fourteen");
    heard.splice(at, 3, { text: "1494.", startMs: heard[at].startMs, endMs: heard[at].endMs });
    expect(listenBack(expected, heard).drift).toEqual([]);
  });
  it("renders a readable report", () => {
    const heard = perfect().map((w) => (w.text === "ninety" ? { ...w, text: "eighty" } : w));
    const md = renderListenBack(listenBack(expected, heard));
    expect(md).toContain('venice **number**: script "ninety", heard "eighty"');
    expect(md).toContain(`## Captions out of sync by more than ${DRIFT_MS} ms (0)`);
    expect(md).toContain("typical offset of 0 ms");
  });
});
