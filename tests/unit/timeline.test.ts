import { describe, expect, it } from "vitest";
import { scheduleProgress } from "../../src/charts/schedule";
import { formatYear } from "../../src/design/layout";
import { buildVideo } from "../../src/pipeline/buildVideo";
import { TIMELINE, eventCueFramesFor, timelinePlan } from "../../src/scenes/timeline/timing";
import { TIMELINE_LAYOUT, timelinePitch, timelineRowY } from "../../src/scenes/timeline/layout";
import { itemCueFrames } from "../../src/schema/emphasis";
import { parseFacts } from "../../src/schema/facts";
import { parseStoryboard, StoryboardError } from "../../src/schema/storyboard";
import { assertCuesSupported, assertFactsTraceable } from "../../src/schema/validate";
import { synthWords } from "../../src/voice/synthWords";

const EVENTS = [
  { year: -753, label: "Rome is founded" },
  { year: -44, label: "Caesar is assassinated" },
  { year: -27, label: "Augustus becomes emperor" },
  { year: 476, label: "Western empire falls" },
];
const NARRATION =
  "Rome was founded, legend says, in seven fifty three BC. Caesar was assassinated in forty four BC, and Augustus became emperor soon after. The western empire finally falls in four seventy six.";
const cue = (atWord: string, text: string = atWord) => ({ atWord, do: "emphasize", text });
const CUES = [cue("founded"), cue("assassinated"), cue("emperor"), cue("falls")];
const timeline = (props: Record<string, unknown> = {}, cues: unknown[] = CUES) => ({
  id: "t", type: "timeline", narration: NARRATION, cues,
  props: { title: "Rome in four dates", events: EVENTS, factId: "f-t", ...props },
});
const board = (...scenes: unknown[]) =>
  parseStoryboard({
    schemaVersion: 1,
    meta: { title: "t", theme: "lombard-row", doorNo: 1, series: "How it works", voice: "v" },
    audio: { music: null },
    scenes,
  });
const facts = (dataset?: unknown) =>
  parseFacts({
    facts: [{ id: "f-t", claim: "c", ...(dataset === undefined ? {} : { dataset }), source: { name: "n", url: "https://example.com/" } }],
  });
const words = (sb: { scenes: { id: string; narration: string }[] }) =>
  Object.fromEntries(sb.scenes.map((s) => [s.id, synthWords(s.narration)]));

describe("formatYear", () => {
  it("formats BC, AD under 1000 and plain years", () => {
    expect(formatYear(-753)).toBe("753 BC");
    expect(formatYear(44)).toBe("AD 44");
    expect(formatYear(476)).toBe("AD 476");
    expect(formatYear(1066)).toBe("1066");
    expect(formatYear(1999)).toBe("1999");
  });
});

describe("timeline schema", () => {
  it("accepts 2 to 6 increasing events and defaults the tone", () => {
    expect(board(timeline()).scenes[0]).toMatchObject({ props: { tone: "highlight" } });
  });
  it("rejects year 0, non-increasing years, too few or too many events, and a long label", () => {
    expect(() => board(timeline({ events: [{ year: -1, label: "a" }, { year: 0, label: "b" }] }))).toThrow(StoryboardError);
    expect(() => board(timeline({ events: [{ year: 5, label: "a" }, { year: 5, label: "b" }] }))).toThrow(/increasing/);
    expect(() => board(timeline({ events: [{ year: 5, label: "a" }] }))).toThrow(StoryboardError);
    const seven = Array.from({ length: 7 }, (_, i) => ({ year: 100 + i, label: `e${i}` }));
    expect(() => board(timeline({ events: seven }))).toThrow(StoryboardError);
    expect(() => board(timeline({ events: [{ year: 1, label: "x".repeat(27) }, { year: 2, label: "b" }] }))).toThrow(StoryboardError);
  });
});

describe("timeline fact tracing", () => {
  it("passes when the dataset equals the events", () => {
    expect(() => assertFactsTraceable(board(timeline()), facts(EVENTS))).not.toThrow();
  });
  it("rejects a changed year or label, and a fact without a dataset", () => {
    const changed = EVENTS.map((e, i) => (i === 1 ? { ...e, year: -43 } : e));
    expect(() => assertFactsTraceable(board(timeline()), facts(changed))).toThrow(/"t".*dataset of fact "f-t"/);
    const relabeled = EVENTS.map((e, i) => (i === 0 ? { ...e, label: "Rome begins" } : e));
    expect(() => assertFactsTraceable(board(timeline()), facts(relabeled))).toThrow(/dataset/);
    expect(() => assertFactsTraceable(board(timeline()), facts())).toThrow(/no dataset/);
  });
});

describe("timeline cue rules", () => {
  it("accepts exactly one emphasize cue per event", () => {
    expect(() => assertCuesSupported(board(timeline()))).not.toThrow();
  });
  it("rejects too few cues, a callout cue, a word not on screen and two cues on one event", () => {
    expect(() => assertCuesSupported(board(timeline({}, CUES.slice(0, 3))))).toThrow(/exactly one emphasize cue per event/);
    expect(() => assertCuesSupported(board(timeline({}, [...CUES, { atWord: "falls", do: "callout", text: "x" }])))).toThrow(/at most 0 callout/);
    expect(() => assertCuesSupported(board(timeline({}, [cue("founded", "banana"), ...CUES.slice(1)])))).toThrow(/not a word on screen/);
    expect(() => assertCuesSupported(board(timeline({}, [cue("founded"), cue("assassinated", "Caesar"), cue("emperor", "assassinated"), cue("falls")])))).toThrow(/same event/);
  });
});

describe("itemCueFrames", () => {
  const labels = EVENTS.map((e) => e.label);
  it("returns the frame of the cue that targets each item, in item order", () => {
    const cues = [
      { frame: 90, do: "emphasize", text: "emperor" },
      { frame: 30, do: "emphasize", text: "founded" },
      { frame: 60, do: "emphasize", text: "assassinated" },
      { frame: 120, do: "emphasize", text: "falls" },
    ];
    expect(itemCueFrames(labels, cues)).toEqual([30, 60, 90, 120]);
  });
  it("throws a RangeError naming an item with no cue", () => {
    expect(() => itemCueFrames(labels, [{ frame: 30, do: "emphasize", text: "founded" }])).toThrow(/Caesar is assassinated/);
  });
});

describe("timelinePlan", () => {
  it("puts the spine on each event on its cue frame", () => {
    const frames = [40, 80, 120, 160];
    const plan = timelinePlan(frames, 400);
    expect(plan.frames).toEqual(frames);
    frames.forEach((f, i) => expect(scheduleProgress(f, plan.knots)).toBeCloseTo(i / 3, 9));
  });
  it("pushes an early first cue to start + the minimum segment", () => {
    expect(timelinePlan([2, 60, 100, 140], 400).frames[0]).toBe(TIMELINE.start + TIMELINE.minSegment);
  });
  it("rejects events spoken out of chronological order", () => {
    expect(() => timelinePlan([40, 120, 80, 160], 400)).toThrow(/chronological/);
  });
  it("eventCueFramesFor wires labels and resolved cues through itemCueFrames", () => {
    const cues = CUES.map((c, i) => ({ frame: 30 + i * 30, do: c.do as string, text: c.text }));
    expect(eventCueFramesFor(EVENTS, cues)).toEqual([30, 60, 90, 120]);
  });
});

describe("timeline layout", () => {
  it("keeps every row inside the lane for 2 to 6 events", () => {
    for (let n = 2; n <= 6; n += 1) {
      const bottom = timelineRowY(n - 1, n) + TIMELINE_LAYOUT.rowHeight;
      expect(timelineRowY(0, n)).toBeGreaterThanOrEqual(TIMELINE_LAYOUT.top);
      expect(bottom).toBeLessThanOrEqual(1240);
      expect(timelinePitch(n)).toBeLessThanOrEqual(TIMELINE_LAYOUT.maxPitch);
    }
  });
});

describe("timeline in buildVideo", () => {
  it("accepts a normal scene and rejects one that exits before the last event lands", () => {
    expect(() => buildVideo(board(timeline()), facts(EVENTS), words, 30)).not.toThrow();
    const tiny = [{ year: 1, label: "Rome" }, { year: 2, label: "Gaul" }];
    const rushed = timeline({ events: tiny }, [cue("Rome"), cue("Gaul")]);
    expect(() => buildVideo(board({ ...rushed, narration: "Rome Gaul." }), facts(tiny), words, 30)).toThrow(/"t".*too short/);
  });
  it("rejects events spoken out of order with the scene id", () => {
    const swapped = timeline({}, [cue("founded", "Caesar"), cue("assassinated", "founded"), cue("emperor"), cue("falls")]);
    expect(() => buildVideo(board(swapped), facts(EVENTS), words, 30)).toThrow(/"t".*chronological/);
  });
});
