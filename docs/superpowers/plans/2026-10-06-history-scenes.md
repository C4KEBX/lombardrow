# Motion Explainers: Plan 5 (History Scenes: Timeline and Map) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give history videos their two signature scenes: a `timeline` whose spine draws to each event as it is spoken, and a `map` that zooms into a region and lights up countries on their spoken names. Also close the Plan 4 review carry-overs.

**Architecture:** Both scenes reuse the narration-pacing machinery from Plan 4: a shared `pacedKnots` helper (extracted from `drawPlan`) turns `(cue frame, progress)` anchors into a monotone schedule, and the existing `emphasize` cue (text names an on-screen word) becomes the "reveal this item now" cue, with one cue required per timeline event and per map region. The map is pure SVG from `world-atlas` 110m country shapes projected with `d3-geo` (Mercator, fitted to a lon/lat box); the camera animates between a wide box and the focus box as a pure function of the frame. Facts trace both scenes: the fact's `dataset` must deep-equal the events (timeline) or the region name list (map).

**Tech Stack:** Existing stack plus `d3-geo` ^3.1.1, `topojson-client` ^3.1.0 and `world-atlas` 2.0.2 (ISC license, Natural Earth public-domain data; installed as data, no network at render time) with their `@types`.

**Spec:** `docs/superpowers/specs/2026-10-05-motion-explainers-design.md` (sections 4, 8 milestone 5). Previous plans: `2026-10-06-foundation-and-spikes.md` through `2026-10-06-pacing-transitions-text-scenes.md`. Brief: `spikes/RESULTS.md` ("Inputs for Plan 5").

**Scope note:** Not in this plan: the Claude Code skill (Plan 6); map markers/cities, historical borders (the atlas is modern borders and the scene says so on screen), animated routes, parallel scene rendering. Region reveal order follows the narration, not the storyboard list order.

## Verified before writing this plan

- `npm view`: `world-atlas` 2.0.2 (ISC), `d3-geo` 3.1.1, `topojson-client` 3.1.0 exist; `@types/d3-scale`, `@types/d3-shape` are already installed so `@types/d3-geo` fits the pattern.
- `emphasisTarget(items, text)` (Plan 4) already resolves a cue word to `{ line, word }`; for timeline/map the `line` index is the event/region index.
- `drawPlan` (Plan 4) contains the knot-building logic this plan extracts; its tests pin the behavior.
- d3 spherical polygons need a specific winding, so the camera fits a `MultiPoint` of the box corners instead (bounds of points are winding-free; Mercator meridians are straight, so corners define the box).
- The Plan 4 review left these Minors; Task 1 and Task 2 close the cheap ones: a second emphasize cue on the same word is silently ignored, quote gap/fit mismatch (0.3em rendered vs 0.15em assumed), substring-only quote match, same-frame cue tie ordering.

## Global Constraints

- Everything from Plans 1 to 4 still applies: 1080x1920 @ 30fps; all `remotion*` pinned `4.0.533`; zod pinned `4.5.4`; data eases with no overshoot; springs only for objects (clamped with `Math.min(1, ...)` where overshoot would leave a mask or lane); files < 800 lines; immutable data; zero paid services; TDD with 80% coverage on non-visual logic; system ffmpeg only; render tests run serially.
- Scene content stays above `CAPTION_LANE.top` (1340). The map box is y 300 to 1300; the timeline's lowest row ends by y 1220.
- Every number and name on screen traces to a sourced fact: `timeline.events` deep-equal the fact's `dataset`; `map.regions` (array of country names) deep-equal the fact's `dataset`.
- Map data is modern country borders. The scene always draws the footnote "Modern borders, approximate". The script step must not claim historical borders.
- A scene whose reveal cannot finish before its exit fade is rejected with a clear error (`assertSceneTiming`), never clipped.
- Case-insensitive filesystem: never name two files that differ only by case (Plan 4 hit this).
- **No git commits unless the user explicitly asks.** Each "Checkpoint" step names the intended message; run it only if asked. Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

Failure modes the spec implies but happy-path tests would miss, most likely first. Each has a pinning test in the task named.

1. A region name that is not in the atlas ("United States" vs "United States of America", "Czech Republic" vs "Czechia"): loud error that suggests close matches. Two regions sharing a cue word ("United Kingdom", "United States"): the untargeted one is a loud error (Tasks 2, 4).
2. Timeline events spoken out of chronological order, or an event with no cue, or two cues on one event: loud errors, never a silently skipped reveal (Task 2).
3. Years: BC (negative), AD under 1000, no year 0, strictly increasing; the label formatting for each (Task 2).
4. Fact tracing: timeline events (year and label) and map regions deep-equal the fact dataset; a stale fact is rejected (Tasks 2, 4).
5. Map camera: boxes near the poles or antimeridian, extreme aspect ratios, and a focus box inside the clamps never yield NaN or an off-box projection; antimeridian countries (Russia, Fiji) are never culled wrongly (Task 3).
6. Render cost of 177 country paths per frame stays within the existing budget (about 0.06 s/frame; Task 5 measures it).
7. Timeline layout for 2 to 6 events stays inside the lane; map labels never leave the map box (Tasks 2, 4).
8. Known gap, not tested: taste and the on-screen readability of small countries' labels; the user should watch the ancient demo.

## File Structure

```
package.json                          modify: d3-geo, topojson-client, world-atlas, @types
vitest.config.ts                      modify: coverage globs (src/map/**)
src/charts/schedule.ts                modify: Anchor, pacedKnots
src/charts/timing.ts                  modify: drawPlan uses pacedKnots
src/design/layout.ts                  modify: export TITLE_WORD_GAP_EM, add formatYear
src/design/tokens.ts                  modify: MAP_BOX
src/schema/emphasis.ts                modify: itemCueFrames
src/schema/storyboard.ts              modify: attribution cap; timeline + map schemas and types
src/schema/validate.ts                modify: word-bounded quote match, emphasis generalization, timeline/map tracing, region names
src/pipeline/assertSceneTiming.ts     modify: timeline and map reveal checks
src/map/atlas.ts                      create: COUNTRIES, names, suggestions, culling
src/map/camera.ts                     create: bbox math and projection
src/scenes/timeline/{Timeline.tsx,timing.ts,layout.ts}   create
src/scenes/map/{MapScene.tsx,timing.ts}                   create
src/scenes/quote/Quote.tsx            modify: gap matches the fit check
src/compose/Video.tsx                 modify: new scene cases
src/Root.tsx                          modify: AncientDemo
fixtures/ancient.{storyboard,facts}.json   create
tests/unit/*, tests/render/*               see tasks
```

---

### Task 1: Plan 4 carry-overs (quote fit, emphasis duplicates, quote trace)

**Files:**
- Modify: `src/schema/validate.ts`, `src/schema/storyboard.ts`, `src/design/layout.ts`, `src/scenes/quote/Quote.tsx`
- Test: `tests/unit/kineticText.test.ts`, `tests/unit/quote.test.ts`, `tests/unit/layoutTitle.test.ts`

**Interfaces:**
- Produces: `TITLE_WORD_GAP_EM` exported from `src/design/layout.ts`; quote `attribution` max 28 characters; two emphasize cues on one on-screen word are rejected; the quote trace is word-bounded and normalizes dash and ellipsis variants.

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/kineticText.test.ts` inside `describe("kinetic-text cue rules", ...)`:

```ts
  it("rejects two emphasize cues that resolve to the same on-screen word", () => {
    const cues = [emphasize("enemy", "debt"), emphasize("enemy")];
    expect(() => assertCuesSupported(board(kinetic({}, cues)))).toThrow(/"k".*same word/);
  });
```

Append to `tests/unit/quote.test.ts`:

```ts
describe("quote trace and limits (Plan 4 review carry-overs)", () => {
  it("does not accept a quote that only matches inside a longer word", () => {
    expect(() => assertFactsTraceable(board(quote({ quote: "eat" })), facts("A great leader."))).toThrow(/does not appear/);
  });
  it("accepts a quote bounded by punctuation or spaces", () => {
    expect(() => assertFactsTraceable(board(quote({ quote: "eat" })), facts("Men eat, then sleep."))).not.toThrow();
  });
  it("normalizes dash and ellipsis variants on both sides", () => {
    expect(() => assertFactsTraceable(board(quote({ quote: "Wait... go - now" })), facts("He said: Wait… go – now"))).not.toThrow();
  });
  it("caps the attribution at 28 characters so it cannot wrap", () => {
    expect(() => board(quote({ attribution: "a".repeat(28) }))).not.toThrow();
    expect(() => board(quote({ attribution: "a".repeat(29) }))).toThrow(StoryboardError);
  });
});
```

Append to `tests/unit/layoutTitle.test.ts` (add `TITLE_WORD_GAP_EM` to its import from `../../src/design/layout`):

```ts
describe("word gap shared by fit and render", () => {
  it("is exported so every scene that wraps title-style text renders the gap the fit check assumed", () => {
    expect(TITLE_WORD_GAP_EM).toBe(0.15);
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npx vitest run tests/unit/kineticText.test.ts tests/unit/quote.test.ts tests/unit/layoutTitle.test.ts`
Expected: FAIL on the five new tests (no duplicate rejection, "eat" accepted, dashes unmatched, 29-char attribution accepted, `TITLE_WORD_GAP_EM` not exported).

- [ ] **Step 3: Implement**

`src/design/layout.ts`: change `const TITLE_WORD_GAP_EM = 0.15;` to `export const TITLE_WORD_GAP_EM = 0.15;`.

`src/scenes/quote/Quote.tsx`: import `TITLE_WORD_GAP_EM` from `../../design/layout` (extend the existing `fitTitleFontSize` import) and change the words container `gap: "0 0.3em"` to ``gap: `0 ${TITLE_WORD_GAP_EM}em` ``. Also add `whiteSpace: "nowrap"` to the attribution `<div>`.

`src/schema/storyboard.ts`: in `QuoteSceneSchema` change `attribution: z.string().min(1).max(40)` to `.max(28)`.

`src/schema/validate.ts`:
- replace `normalizeQuote` and its use with:

```ts
const normalizeQuote = (s: string): string =>
  s
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim();

const WORD_CHAR = "[\\p{L}\\p{N}]";

/** The quote must appear in the claim bounded by non-word characters, so "eat" does not match "great". */
function quoteInClaim(claim: string, quote: string): boolean {
  const escaped = normalizeQuote(quote).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<!${WORD_CHAR})${escaped}(?!${WORD_CHAR})`, "u").test(normalizeQuote(claim));
}
```

and in the `quote` tracing case use `if (!quoteInClaim(fact.claim, scene.props.quote)) {`.
- in `assertEmphasis`, track targets: before the loop `const seen = new Set<string>();`; after the "not a word on screen" check add:

```ts
    const target = emphasisTarget(scene.props.lines, text) as { line: number; word: number };
    const key = `${target.line}:${target.word}`;
    if (seen.has(key)) {
      throw new StoryboardError(`Scene "${scene.id}": emphasize cue "${text}" targets the same word as an earlier cue`);
    }
    seen.add(key);
```

- [ ] **Step 4: Run to verify GREEN and regenerate the quote golden**

Run: `npm run typecheck && npx vitest run tests/unit`
Expected: clean, all PASS.

Run: `UPDATE_SNAPSHOTS=1 npx vitest run tests/render/history.snapshot.test.ts --testTimeout=240000 --no-file-parallelism`, then Read `tests/render/golden/history-quote-end.png` and confirm the quote text still wraps inside the lane (the words are closer together now) and the attribution is on one line.
Expected: PASS; image as described.

- [ ] **Step 5: Checkpoint (only if asked)**

`git add -A && git commit -m "fix: close plan 4 review carry-overs (quote fit and trace, duplicate emphasis)"`

---

### Task 2: Shared pacing helper and the `timeline` scene

**Files:**
- Create: `src/scenes/timeline/{timing.ts,layout.ts,Timeline.tsx}`, `tests/unit/timeline.test.ts`
- Modify: `src/charts/schedule.ts`, `src/charts/timing.ts`, `src/design/layout.ts`, `src/schema/emphasis.ts`, `src/schema/storyboard.ts`, `src/schema/validate.ts`, `src/pipeline/assertSceneTiming.ts`, `src/compose/Video.tsx`, `tests/unit/drawPlan.test.ts`, `vitest.config.ts` (nothing new: `src/scenes/**/{timing,layout}.ts` are already included)

**Interfaces:**
- Produces:
  - `type Anchor = { frame: number; progress: number }`, `pacedKnots(anchors, { startFrame, defaultEnd, minSegment, orderError }): { knots: Knot[]; frames: number[] }` in `src/charts/schedule.ts` (`frames[i]` is the frame input anchor `i` is reached; anchors are ordered by frame, then progress, then input index; `orderError(index)` supplies the message of the `RangeError` thrown when progress would decrease).
  - `drawPlan` keeps its signature and behavior.
  - `formatYear(year: number): string` in `src/design/layout.ts` (`-753` to `"753 BC"`, `44` to `"AD 44"`, `476` to `"AD 476"`, `1066` to `"1066"`).
  - `itemCueFrames(items: readonly string[], cues: readonly { frame: number; do: string; text?: string }[]): number[]` in `src/schema/emphasis.ts` (frame of the emphasize cue that targets each item; throws `RangeError` naming an item with no cue).
  - Schema: scene `type: "timeline"`, `props: { title (<=32), events: { year: int in [-3000, 2100] and not 0; label 1-26 chars }[] (2-6, strictly increasing years), tone (default "highlight"), factId }`; `TimelineProps`.
  - `TIMELINE = { start: 12, share: 0.7, minFrames: 30, minSegment: 6, settle: 14 }`, `timelinePlan(cueFrames: readonly number[], durationFrames: number): { knots; frames }`, in `src/scenes/timeline/timing.ts`; `TIMELINE_LAYOUT`, `timelinePitch(n)`, `timelineRowY(i, n)` in `layout.ts`.
  - Cue rules: on `timeline`, exactly one `emphasize` cue per event, each `text` a single word of its event label, no two cues on one event; `MAX_CALLOUTS.timeline = 0`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/drawPlan.test.ts`:

```ts
describe("drawPlan ordering of same-frame cues", () => {
  it("orders cues spoken on the same frame by x so a feasible order is not rejected", () => {
    const plan = drawPlan([{ frame: 50, x: 2020 }, { frame: 50, x: 2010 }], points, DURATION);
    expect(plan.appear[1]).toBe(50);
    expect(plan.appear[0]).toBe(50 + LINE_DRAW_MIN_SEGMENT);
  });
});
```

Create `tests/unit/timeline.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cursorX } from "../../src/charts/geometry";
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

void cursorX;

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
    meta: { title: "t", theme: "bold-flat", voice: "v" },
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
    const rushed = {
      ...timeline(),
      narration: "Founded, assassinated, emperor, falls.",
    };
    expect(() => buildVideo(board(rushed), facts(EVENTS), words, 30)).toThrow(/"t".*too short/);
  });
  it("rejects events spoken out of order with the scene id", () => {
    const swapped = timeline({}, [cue("assassinated", "Caesar"), cue("founded"), cue("emperor"), cue("falls")]);
    expect(() => buildVideo(board(swapped), facts(EVENTS), words, 30)).toThrow(/"t".*chronological/);
  });
});
```

(The unused `cursorX` import line is deliberate scaffolding the executor deletes along with `void cursorX;`; remove both when the file compiles.)

- [ ] **Step 2: Run to verify RED**

Run: `npx vitest run tests/unit/timeline.test.ts tests/unit/drawPlan.test.ts`
Expected: FAIL (missing modules and exports; the same-frame `drawPlan` test fails with "left to right").

- [ ] **Step 3: Extract `pacedKnots` and rebuild `drawPlan` on it**

Append to `src/charts/schedule.ts`:

```ts
export type Anchor = { frame: number; progress: number };
export type PacedKnots = { knots: Knot[]; frames: number[] };

/**
 * Knots for a cursor that must stand at `progress` on `frame` for every anchor. Anchors are taken in
 * time order (ties by progress, then input order), pushed at least `minSegment` frames apart, and
 * the path is closed at progress 1. `frames[i]` is the frame input anchor `i` is reached.
 */
export function pacedKnots(
  anchors: readonly Anchor[],
  opts: { startFrame: number; defaultEnd: number; minSegment: number; orderError: (index: number) => string },
): PacedKnots {
  const ordered = anchors
    .map((a, index) => ({ ...a, index }))
    .sort((a, b) => a.frame - b.frame || a.progress - b.progress || a.index - b.index);
  const knots: Knot[] = [{ frame: opts.startFrame, progress: 0 }];
  const frames = new Array<number>(anchors.length);
  for (const a of ordered) {
    const prev = knots[knots.length - 1];
    if (a.progress < prev.progress) throw new RangeError(opts.orderError(a.index));
    const frame = Math.max(a.frame, prev.frame + opts.minSegment);
    knots.push({ frame, progress: a.progress });
    frames[a.index] = frame;
  }
  const last = knots[knots.length - 1];
  const tail = last.progress < 1 ? Math.max(opts.defaultEnd, last.frame + opts.minSegment) : opts.defaultEnd;
  if (tail > last.frame) knots.push({ frame: tail, progress: 1 });
  return { knots, frames };
}
```

In `src/charts/timing.ts` import `pacedKnots` (`import { pacedKnots, type Knot } from "./schedule";`) and replace the body of `drawPlan` with:

```ts
  const first = points[0].x;
  const span = points[points.length - 1].x - first;
  const { knots, frames } = pacedKnots(
    callouts.map((c) => ({ frame: c.frame, progress: (c.x - first) / span })),
    {
      startFrame: LINE_DRAW.start,
      defaultEnd: LINE_DRAW.start + lineDrawFrames(durationFrames),
      minSegment: LINE_DRAW_MIN_SEGMENT,
      orderError: (i) =>
        `callout cues must run left to right in spoken order (x ${callouts[i].x} is spoken after a callout further right)`,
    },
  );
  return { knots, appear: frames };
```

Run: `npx vitest run tests/unit/drawPlan.test.ts tests/unit/schedule.test.ts tests/unit/chartTiming.test.ts`
Expected: PASS (all Plan 4 pacing tests unchanged, plus the same-frame test).

- [ ] **Step 4: Implement `formatYear`, `itemCueFrames`, the schema and validation**

`src/design/layout.ts` append:

```ts
/** Display form of a historical year: negative years are BC, years below 1000 are AD-prefixed. */
export function formatYear(year: number): string {
  if (year < 0) return `${-year} BC`;
  return year < 1000 ? `AD ${year}` : String(year);
}
```

`src/schema/emphasis.ts` append:

```ts
/** Frame of the emphasize cue that targets each item, in item order. Throws if an item has no cue. */
export function itemCueFrames(
  items: readonly string[],
  cues: readonly { frame: number; do: string; text?: string }[],
): number[] {
  const frames = new Array<number | undefined>(items.length).fill(undefined);
  for (const cue of cues) {
    if (cue.do !== "emphasize" || cue.text === undefined) continue;
    const target = emphasisTarget(items, cue.text);
    if (target) frames[target.line] = cue.frame;
  }
  const missing = frames.findIndex((f) => f === undefined);
  if (missing >= 0) throw new RangeError(`"${items[missing]}" has no emphasize cue`);
  return frames as number[];
}
```

`src/schema/storyboard.ts`: add before `SceneSchema`, add to the union, and export the type:

```ts
const TimelineEventSchema = z.strictObject({
  year: z.number().int().min(-3000).max(2100).refine((y) => y !== 0, "there is no year 0"),
  label: z.string().min(1).max(26),
});

const TimelineSceneSchema = z.strictObject({
  ...sceneBase,
  type: z.literal("timeline"),
  props: z
    .strictObject({
      title: z.string().min(1).max(32),
      events: z.array(TimelineEventSchema).min(2).max(6),
      tone: z.enum(TONES).default("highlight"),
      factId: z.string().min(1),
    })
    .superRefine((props, ctx) => {
      props.events.forEach((event, i) => {
        if (i > 0 && event.year <= props.events[i - 1].year) {
          ctx.addIssue({ code: "custom", path: ["events", i, "year"], message: "event years must be strictly increasing" });
        }
      });
    }),
});
// union: add TimelineSceneSchema; export type TimelineProps = Extract<Scene, { type: "timeline" }>["props"];
```

`src/schema/validate.ts`:
- `MAX_CALLOUTS` gains `timeline: 0`.
- add the tracing case `case "timeline": assertTimelineFact(scene, lookup(scene.id, scene.props.factId)); break;` with

```ts
function assertTimelineFact(scene: Extract<Scene, { type: "timeline" }>, fact: Fact): void {
  if (fact.dataset === undefined) {
    throw new StoryboardError(`Scene "${scene.id}": fact "${fact.id}" has no dataset to verify the timeline against`);
  }
  if (!deepEqual(fact.dataset, scene.props.events)) {
    throw new StoryboardError(`Scene "${scene.id}": timeline events do not match the dataset of fact "${fact.id}"`);
  }
}
```
- generalize the emphasis rules: replace `assertEmphasis` and its call sites with

```ts
type EmphasisScene = Extract<Scene, { type: "kinetic-text" | "timeline" }>;
const isEmphasisScene = (scene: Scene): scene is EmphasisScene => scene.type === "kinetic-text" || scene.type === "timeline";

/** What an emphasize cue can point at, and whether every item needs exactly one cue. */
function emphasisItems(scene: EmphasisScene): { items: string[]; noun: string; exact: boolean } {
  return scene.type === "kinetic-text"
    ? { items: scene.props.lines, noun: "line", exact: false }
    : { items: scene.props.events.map((e) => e.label), noun: "event", exact: true };
}

function assertEmphasis(scene: EmphasisScene, cues: Scene["cues"]): void {
  const { items, noun, exact } = emphasisItems(scene);
  if (!exact && cues.length > MAX_EMPHASIS) {
    throw new StoryboardError(`Scene "${scene.id}" (${scene.type}) supports at most ${MAX_EMPHASIS} emphasize cues; got ${cues.length}`);
  }
  if (exact && cues.length !== items.length) {
    throw new StoryboardError(
      `Scene "${scene.id}" (${scene.type}) needs exactly one emphasize cue per ${noun} (${items.length}); got ${cues.length}`,
    );
  }
  const seen = new Set<string>();
  for (const cue of cues) {
    const text = cue.text as string;
    if (/\s/.test(text.trim())) {
      throw new StoryboardError(`Scene "${scene.id}": emphasize cue "${text}" must name a single word`);
    }
    const target = emphasisTarget(items, text);
    if (target === null) {
      throw new StoryboardError(`Scene "${scene.id}": emphasize cue "${text}" is not a word on screen`);
    }
    const key = exact ? `${target.line}` : `${target.line}:${target.word}`;
    if (seen.has(key)) {
      throw new StoryboardError(`Scene "${scene.id}": emphasize cue "${text}" targets the same ${exact ? noun : "word"} as an earlier cue`);
    }
    seen.add(key);
  }
}
```
and in `assertCuesSupported`:

```ts
    if (!isEmphasisScene(scene) && emphasize.length > 0) {
      throw new StoryboardError(`Scene "${scene.id}" (${scene.type}) cannot render "emphasize" cues`);
    }
    if (isEmphasisScene(scene)) assertEmphasis(scene, emphasize);
```
(Task 1's `kinetic` duplicate check moves into this shared function: delete the Task 1 version of the loop so there is one implementation, keeping its tests.)

- [ ] **Step 5: Implement timing and layout**

`src/scenes/timeline/timing.ts`:

```ts
import { pacedKnots, type PacedKnots } from "../../charts/schedule";
import { itemCueFrames } from "../../schema/emphasis";

export const TIMELINE = { start: 12, share: 0.7, minFrames: 30, minSegment: 6, settle: 14 } as const;

const defaultEnd = (durationFrames: number): number =>
  TIMELINE.start + Math.max(TIMELINE.minFrames, Math.round(durationFrames * TIMELINE.share) - TIMELINE.start);

/** Spine schedule: the cursor stands on event i on that event's cue frame. Events must be spoken in order. */
export function timelinePlan(cueFrames: readonly number[], durationFrames: number): PacedKnots {
  const n = cueFrames.length;
  return pacedKnots(
    cueFrames.map((frame, i) => ({ frame, progress: i / (n - 1) })),
    {
      startFrame: TIMELINE.start,
      defaultEnd: defaultEnd(durationFrames),
      minSegment: TIMELINE.minSegment,
      orderError: (i) => `events must be spoken in chronological order (event ${i + 1} is spoken before an earlier one)`,
    },
  );
}

export const eventCueFramesFor = (
  events: readonly { label: string }[],
  cues: readonly { frame: number; do: string; text?: string }[],
): number[] => itemCueFrames(events.map((e) => e.label), cues);
```

`src/scenes/timeline/layout.ts`:

```ts
export const TIMELINE_LAYOUT = { spineX: 130, top: 340, maxPitch: 220, span: 750, rowHeight: 130 } as const;

/** Row spacing: roomy for few events, compressed so six still end above the caption lane. */
export const timelinePitch = (n: number): number => Math.min(TIMELINE_LAYOUT.maxPitch, TIMELINE_LAYOUT.span / (n - 1));

export const timelineRowY = (i: number, n: number): number => TIMELINE_LAYOUT.top + i * timelinePitch(n);
```

`src/pipeline/assertSceneTiming.ts`: add

```ts
    if (scene.type === "timeline") {
      let done: number;
      try {
        const plan = timelinePlan(eventCueFramesFor(scene.props.events, composed.cues), composed.durationFrames);
        done = Math.max(plan.knots[plan.knots.length - 1].frame, Math.max(...plan.frames) + TIMELINE.settle);
      } catch (error) {
        if (error instanceof RangeError) throw new StoryboardError(`Scene "${scene.id}": ${error.message}`);
        throw error;
      }
      if (done > limit) {
        throw new StoryboardError(
          `Scene "${scene.id}" is too short (${composed.durationFrames} frames): the timeline cannot reach its last event before the scene exits; lengthen the narration`,
        );
      }
    }
```
with imports from `../scenes/timeline/timing`.

- [ ] **Step 6: Run to verify GREEN (logic)**

Run: `npx vitest run tests/unit/timeline.test.ts tests/unit/drawPlan.test.ts tests/unit/kineticText.test.ts`
Expected: PASS. Then delete the scaffolding `import { cursorX }` and `void cursorX;` lines from the test file.

- [ ] **Step 7: Implement the component and wire it**

`src/scenes/timeline/Timeline.tsx`:

```tsx
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { scheduleProgress } from "../../charts/schedule";
import { EXIT_FRAMES } from "../../charts/timing";
import { BODY_FONT, DISPLAY_FONT } from "../../design/fonts";
import { formatYear } from "../../design/layout";
import { popIn, sustainDrift } from "../../design/motion";
import { PALETTE, SAFE, VIDEO } from "../../design/tokens";
import type { TimelineProps } from "../../schema/storyboard";
import type { SceneRenderProps } from "../types";
import { TIMELINE_LAYOUT, timelineRowY } from "./layout";
import { TIMELINE, eventCueFramesFor, timelinePlan } from "./timing";

/** A vertical spine that draws down to each event as it is spoken; the newest event is bright, older ones dim. */
export const Timeline: React.FC<SceneRenderProps<TimelineProps>> = ({ props, cues, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tone = PALETTE[props.tone];
  const { events } = props;
  const n = events.length;
  const plan = timelinePlan(eventCueFramesFor(events, cues), durationFrames);
  const progress = scheduleProgress(frame, plan.knots);
  const topY = timelineRowY(0, n);
  const tipY = topY + progress * (timelineRowY(n - 1, n) - topY);
  const { spineX } = TIMELINE_LAYOUT;
  const titleIn = Math.min(1, popIn(frame, fps, 0));
  const tipIn = Math.min(1, popIn(frame, fps, TIMELINE.start));
  const exit = interpolate(frame, [durationFrames - EXIT_FRAMES, durationFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: PALETTE.ground, opacity: exit }}>
      <svg width={VIDEO.width} height={VIDEO.height} style={{ position: "absolute", inset: 0 }}>
        <text x={SAFE.side} y={SAFE.top + 52} fontFamily={BODY_FONT} fontSize={52} fill={PALETTE.ink} fillOpacity={0.85 * titleIn}>
          {props.title}
        </text>
        <line x1={spineX} x2={spineX} y1={topY} y2={timelineRowY(n - 1, n)} stroke={PALETTE.ink} strokeOpacity={0.14} strokeWidth={10} strokeLinecap="round" />
        <line x1={spineX} x2={spineX} y1={topY} y2={tipY} stroke={tone} strokeWidth={10} strokeLinecap="round" />
        {events.map((event, i) => {
          const y = timelineRowY(i, n);
          const pop = Math.min(1, popIn(frame, fps, plan.frames[i]));
          const older = i < n - 1 && frame >= plan.frames[i + 1];
          return (
            <g key={`${event.year}-${event.label}`} opacity={pop * (older ? 0.55 : 1)} transform={`translate(${(1 - pop) * 30} 0)`}>
              <circle cx={spineX} cy={y} r={24 * pop} fill={PALETTE.ink} />
              <circle cx={spineX} cy={y} r={11 * pop} fill={tone} />
              <text x={spineX + 56} y={y + 8} fontFamily={DISPLAY_FONT} fontSize={72} fill={tone}>
                {formatYear(event.year)}
              </text>
              <text x={spineX + 56} y={y + 66} fontFamily={BODY_FONT} fontSize={44} fill={PALETTE.ink}>
                {event.label}
              </text>
            </g>
          );
        })}
        <g transform={`translate(${spineX} ${tipY})`} opacity={tipIn}>
          <circle r={34 + sustainDrift(frame, 6, 30)} fill="none" stroke={tone} strokeWidth={6} strokeOpacity={0.5} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
```

Add `case "timeline": return <Timeline props={scene.props} cues={cues} durationFrames={durationFrames} />;` (with import) to `src/compose/Video.tsx`.

- [ ] **Step 8: Run all suites**

Run: `npm run typecheck && npx vitest run tests/unit`
Expected: clean, all PASS.

- [ ] **Step 9: Checkpoint (only if asked)**

`git add -A && git commit -m "feat: timeline scene paced to the narration"`

---

### Task 3: Map data and camera (pure logic)

**Files:**
- Create: `src/map/atlas.ts`, `src/map/camera.ts`, `tests/unit/atlas.test.ts`, `tests/unit/mapCamera.test.ts`
- Modify: `package.json` (via npm), `src/design/tokens.ts`, `vitest.config.ts`, `tests/unit/tokens.test.ts`

**Interfaces:**
- Produces:
  - `MAP_BOX = { left: 60, right: 1020, top: 300, bottom: 1300 }` in `tokens.ts`.
  - `type Country = Feature<Geometry, { name: string }>`; `COUNTRIES: readonly Country[]`; `COUNTRY_BY_NAME: ReadonlyMap<string, Country>`; `COUNTRY_NAMES: ReadonlySet<string>`; `suggestCountries(name: string, limit?: number): string[]`; `visibleCountries(bbox: Bbox): Country[]` in `src/map/atlas.ts`.
  - `type Bbox = readonly [west: number, south: number, east: number, north: number]`; `WIDE_FACTOR = 2.4`; `wideBbox(focus: Bbox): Bbox`; `lerpBbox(a: Bbox, b: Bbox, t: number): Bbox`; `projectionFor(bbox: Bbox, box: { left; top; right; bottom }): GeoProjection`; `visibleBbox(projection: GeoProjection, box): Bbox` in `src/map/camera.ts`.

- [ ] **Step 1: Install the data and types**

Run: `npm install --save-exact world-atlas@2.0.2 && npm install d3-geo@^3.1.1 topojson-client@^3.1.0 && npm install -D @types/d3-geo @types/topojson-client @types/geojson`
Expected: installs succeed; `package.json` lists the four packages. (`@types/topojson-specification` arrives with `@types/topojson-client`.) If `@types/geojson` is already present, npm leaves it.

Add `"src/map/**"` to `coverage.include` in `vitest.config.ts`.

- [ ] **Step 2: Write the failing tests**

`tests/unit/atlas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { geoBounds } from "d3-geo";
import { COUNTRIES, COUNTRY_BY_NAME, COUNTRY_NAMES, suggestCountries, visibleCountries } from "../../src/map/atlas";

describe("atlas", () => {
  it("loads the 110m countries with names", () => {
    expect(COUNTRIES.length).toBeGreaterThan(170);
    for (const name of ["Italy", "Spain", "France", "Greece", "Turkey", "Egypt", "Russia"]) {
      expect(COUNTRY_NAMES.has(name)).toBe(true);
      expect(COUNTRY_BY_NAME.get(name)?.properties.name).toBe(name);
    }
  });
  it("has unique names", () => {
    expect(COUNTRY_NAMES.size).toBe(COUNTRIES.length);
  });
  it("suggests close names for a near miss", () => {
    expect(suggestCountries("United States")).toContain("United States of America");
    expect(suggestCountries("czech").map((n) => n.toLowerCase()).join(" ")).toContain("czech");
    expect(suggestCountries("zzzz")).toEqual([]);
  });
});

describe("visibleCountries", () => {
  const MED: [number, number, number, number] = [-12, 28, 45, 56];
  it("keeps countries inside the box and drops far ones", () => {
    const names = visibleCountries(MED).map((c) => c.properties.name);
    expect(names).toContain("Italy");
    expect(names).toContain("Egypt");
    expect(names).not.toContain("Australia");
  });
  it("always keeps countries whose bounds cross the antimeridian", () => {
    const crossing = COUNTRIES.filter((c) => {
      const [[west], [east]] = geoBounds(c);
      return west > east;
    });
    expect(crossing.length).toBeGreaterThan(0);
    const names = new Set(visibleCountries(MED).map((c) => c.properties.name));
    for (const c of crossing) expect(names.has(c.properties.name)).toBe(true);
  });
});
```

`tests/unit/mapCamera.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { WIDE_FACTOR, lerpBbox, projectionFor, visibleBbox, wideBbox, type Bbox } from "../../src/map/camera";
import { MAP_BOX } from "../../src/design/tokens";

const MED: Bbox = [-12, 28, 45, 56];

describe("wideBbox", () => {
  it("contains the focus and is WIDE_FACTOR times larger around the same center", () => {
    const [w, s, e, n] = wideBbox(MED);
    expect(w).toBeLessThan(-12);
    expect(e).toBeGreaterThan(45);
    expect(s).toBeLessThan(28);
    expect(n).toBeGreaterThan(56);
    expect(e - w).toBeCloseTo((45 + 12) * WIDE_FACTOR, 9);
    expect((w + e) / 2).toBeCloseTo((-12 + 45) / 2, 9);
  });
  it("clamps to the map's valid range near the poles and antimeridian", () => {
    const [w, s, e, n] = wideBbox([-170, -60, 170, 75]);
    expect(w).toBeGreaterThanOrEqual(-180);
    expect(e).toBeLessThanOrEqual(180);
    expect(s).toBeGreaterThanOrEqual(-80);
    expect(n).toBeLessThanOrEqual(80);
  });
});

describe("lerpBbox", () => {
  it("returns the endpoints and the midpoint", () => {
    const a: Bbox = [0, 0, 10, 10];
    const b: Bbox = [10, 20, 20, 40];
    expect(lerpBbox(a, b, 0)).toEqual(a);
    expect(lerpBbox(a, b, 1)).toEqual(b);
    expect(lerpBbox(a, b, 0.5)).toEqual([5, 10, 15, 25]);
  });
});

describe("projectionFor", () => {
  const corners = (bbox: Bbox): [number, number][] => [
    [bbox[0], bbox[1]], [bbox[2], bbox[1]], [bbox[2], bbox[3]], [bbox[0], bbox[3]],
  ];
  it("fits the box: corners land inside it and one dimension fills it", () => {
    const projection = projectionFor(MED, MAP_BOX);
    const pts = corners(MED).map((c) => projection(c) as [number, number]);
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(MAP_BOX.left - 0.5);
      expect(x).toBeLessThanOrEqual(MAP_BOX.right + 0.5);
      expect(y).toBeGreaterThanOrEqual(MAP_BOX.top - 0.5);
      expect(y).toBeLessThanOrEqual(MAP_BOX.bottom + 0.5);
    }
    const width = Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]));
    const height = Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1]));
    const fillsWidth = Math.abs(width - (MAP_BOX.right - MAP_BOX.left)) < 1;
    const fillsHeight = Math.abs(height - (MAP_BOX.bottom - MAP_BOX.top)) < 1;
    expect(fillsWidth || fillsHeight).toBe(true);
  });
  it("never returns NaN for tall, wide or near-polar boxes", () => {
    for (const bbox of [[-5, -60, 5, 70], [-170, 0, 170, 10], [10, 70, 40, 80]] as Bbox[]) {
      const p = projectionFor(bbox, MAP_BOX)([(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]) as [number, number];
      expect(Number.isFinite(p[0]) && Number.isFinite(p[1])).toBe(true);
    }
  });
});

describe("visibleBbox", () => {
  it("covers at least the focus box (the other dimension shows extra land)", () => {
    const [w, s, e, n] = visibleBbox(projectionFor(MED, MAP_BOX), MAP_BOX);
    expect(w).toBeLessThanOrEqual(-12 + 1e-6);
    expect(e).toBeGreaterThanOrEqual(45 - 1e-6);
    expect(s).toBeLessThanOrEqual(28 + 1e-6);
    expect(n).toBeGreaterThanOrEqual(56 - 1e-6);
  });
});
```

Add to `tests/unit/tokens.test.ts`:

```ts
describe("map box", () => {
  it("sits between the title and the caption lane, inside the side gutters", async () => {
    const { MAP_BOX } = await import("../../src/design/tokens");
    expect(MAP_BOX.left).toBe(SAFE.side);
    expect(MAP_BOX.right).toBe(VIDEO.width - SAFE.side);
    expect(MAP_BOX.top).toBeGreaterThan(SAFE.top + 100);
    expect(MAP_BOX.bottom).toBeLessThan(CAPTION_LANE.top);
  });
});
```

- [ ] **Step 3: Run to verify RED**

Run: `npx vitest run tests/unit/atlas.test.ts tests/unit/mapCamera.test.ts tests/unit/tokens.test.ts`
Expected: FAIL (missing modules and token).

- [ ] **Step 4: Implement**

`src/design/tokens.ts` append:

```ts
/** The map's drawing area: below the title and footnote, above the caption lane. */
export const MAP_BOX = { left: SAFE.side, right: VIDEO.width - SAFE.side, top: 300, bottom: 1300 } as const;
```

`src/map/atlas.ts`:

```ts
import { geoBounds } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import world from "world-atlas/countries-110m.json";
import type { Bbox } from "./camera";

export type Country = Feature<Geometry, { name: string }>;

const topology = world as unknown as Topology;
export const COUNTRIES: readonly Country[] = (
  feature(topology, topology.objects.countries as GeometryCollection) as FeatureCollection<Geometry, { name: string }>
).features;

export const COUNTRY_BY_NAME: ReadonlyMap<string, Country> = new Map(COUNTRIES.map((c) => [c.properties.name, c]));
export const COUNTRY_NAMES: ReadonlySet<string> = new Set(COUNTRY_BY_NAME.keys());

/** Names that contain, or are contained in, the query (case-insensitive): hints for a near-miss region name. */
export function suggestCountries(name: string, limit = 3): string[] {
  const q = name.trim().toLowerCase();
  if (q === "") return [];
  return [...COUNTRY_NAMES]
    .filter((n) => n.toLowerCase().includes(q) || q.includes(n.toLowerCase()))
    .slice(0, limit);
}

const BOUNDS = new Map(COUNTRIES.map((c) => [c.properties.name, geoBounds(c)]));

/** Countries whose bounding box touches `bbox`. Boxes that wrap the antimeridian are always kept. */
export function visibleCountries(bbox: Bbox): Country[] {
  const [w, s, e, n] = bbox;
  return COUNTRIES.filter((c) => {
    const [[cw, cs], [ce, cn]] = BOUNDS.get(c.properties.name) as [[number, number], [number, number]];
    if (cw > ce) return true;
    return cw <= e && ce >= w && cs <= n && cn >= s;
  });
}
```

(If TypeScript rejects the JSON import specifier, add `"world-atlas/countries-110m.json"` handling by `resolveJsonModule` (already on); if the package has no `exports` entry for that path, import it as `world-atlas/countries-110m.json` via the path `../../node_modules/world-atlas/countries-110m.json` and record a ruling.)

`src/map/camera.ts`:

```ts
import { geoMercator, type GeoProjection } from "d3-geo";

export type Bbox = readonly [west: number, south: number, east: number, north: number];
type Box = { left: number; top: number; right: number; bottom: number };

export const WIDE_FACTOR = 2.4;
const MAX_LON = 180;
const MAX_LAT = 80; // Mercator stretches without bound towards the poles

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** The zoomed-out starting view: the focus box scaled about its center, clamped to the valid map range. */
export function wideBbox(focus: Bbox, factor = WIDE_FACTOR): Bbox {
  const [w, s, e, n] = focus;
  const [cx, cy] = [(w + e) / 2, (s + n) / 2];
  const [hx, hy] = [((e - w) / 2) * factor, ((n - s) / 2) * factor];
  return [
    clamp(cx - hx, -MAX_LON, MAX_LON),
    clamp(cy - hy, -MAX_LAT, MAX_LAT),
    clamp(cx + hx, -MAX_LON, MAX_LON),
    clamp(cy + hy, -MAX_LAT, MAX_LAT),
  ];
}

export function lerpBbox(a: Bbox, b: Bbox, t: number): Bbox {
  const mix = (i: 0 | 1 | 2 | 3): number => a[i] + (b[i] - a[i]) * t;
  return [mix(0), mix(1), mix(2), mix(3)];
}

/** Mercator projection that fits the lon/lat box inside `box` (the corners' bounds, so no polygon winding issues). */
export function projectionFor(bbox: Bbox, box: Box): GeoProjection {
  const [w, s, e, n] = bbox;
  return geoMercator().fitExtent(
    [[box.left, box.top], [box.right, box.bottom]],
    { type: "MultiPoint", coordinates: [[w, s], [e, s], [e, n], [w, n]] },
  );
}

/** The lon/lat window actually visible in `box` (larger than the fitted bbox along its non-binding axis). */
export function visibleBbox(projection: GeoProjection, box: Box): Bbox {
  const topLeft = projection.invert?.([box.left, box.top]) as [number, number];
  const bottomRight = projection.invert?.([box.right, box.bottom]) as [number, number];
  return [topLeft[0], bottomRight[1], bottomRight[0], topLeft[1]];
}
```

- [ ] **Step 5: Run to verify GREEN**

Run: `npm run typecheck && npx vitest run tests/unit`
Expected: clean, all PASS. The atlas test loading 177 shapes takes well under a second.

- [ ] **Step 6: Check the data loads outside the bundler**

Run: `npx tsx -e "import('./src/map/atlas.ts').then(m=>console.log(m.COUNTRIES.length, m.COUNTRY_NAMES.has('Italy')))"`
Expected: prints `177 true` (or the atlas's count) with no error. This proves `tsx` (used by `npm run produce`) can import the JSON. If it fails with a JSON import error, add `with { type: "json" }` handling or read the file with `fs` in `atlas.ts` behind a Remotion-safe guard, and ledger the ruling before continuing.

- [ ] **Step 7: Checkpoint (only if asked)**

`git add -A && git commit -m "feat: world atlas data and map camera math"`

---

### Task 4: The `map` scene

**Files:**
- Create: `src/scenes/map/{timing.ts,MapScene.tsx}`, `tests/unit/mapScene.test.ts`
- Modify: `src/schema/storyboard.ts`, `src/schema/validate.ts`, `src/pipeline/buildVideo.ts`, `src/pipeline/assertSceneTiming.ts`, `src/compose/Video.tsx`

**Interfaces:**
- Consumes: `COUNTRY_BY_NAME`, `COUNTRY_NAMES`, `suggestCountries`, `visibleCountries` (Task 3); `wideBbox`, `lerpBbox`, `projectionFor`, `visibleBbox`, `Bbox` (Task 3); `itemCueFrames`, the generalized emphasis rules and `isEmphasisScene` (Task 2).
- Produces: scene `type: "map"`, `props: { title (<=32), regions: string[] (1-6 distinct, each 1-40 chars, atlas country names), focus: [west, south, east, north] (lon in [-180, 180], lat in [-85, 85], west < east, south < north), tone (default "highlight"), factId }`; `MapProps`; `MAP = { zoomFrames: 70, settle: 12 }` and `regionCueFrames(regions, cues)` in `src/scenes/map/timing.ts`; `assertMapRegions(sb)` in `validate.ts`; `MAX_CALLOUTS.map = 0`; map joins `EmphasisScene` with `exact: true`, noun "region".

- [ ] **Step 1: Write the failing tests**

`tests/unit/mapScene.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildVideo } from "../../src/pipeline/buildVideo";
import { parseFacts } from "../../src/schema/facts";
import { parseStoryboard, StoryboardError } from "../../src/schema/storyboard";
import { assertCuesSupported, assertFactsTraceable, assertMapRegions } from "../../src/schema/validate";
import { MAP, regionCueFrames } from "../../src/scenes/map/timing";
import { synthWords } from "../../src/voice/synthWords";

const REGIONS = ["Italy", "Spain", "France", "Greece", "Turkey", "Egypt"];
const NARRATION = "At its height Rome reached from Italy to Spain, France, Greece, Turkey and Egypt, a very large stretch of the world.";
const cue = (name: string) => ({ atWord: name, do: "emphasize", text: name });
const CUES = REGIONS.map(cue);
const map = (props: Record<string, unknown> = {}, cues: unknown[] = CUES) => ({
  id: "m", type: "map", narration: NARRATION, cues,
  props: { title: "The Roman world", regions: REGIONS, focus: [-12, 28, 45, 56], factId: "f-m", ...props },
});
const board = (...scenes: unknown[]) =>
  parseStoryboard({
    schemaVersion: 1,
    meta: { title: "t", theme: "bold-flat", voice: "v" },
    audio: { music: null },
    scenes,
  });
const facts = (dataset?: unknown) =>
  parseFacts({
    facts: [{ id: "f-m", claim: "c", ...(dataset === undefined ? {} : { dataset }), source: { name: "n", url: "https://example.com/" } }],
  });
const words = (sb: { scenes: { id: string; narration: string }[] }) =>
  Object.fromEntries(sb.scenes.map((s) => [s.id, synthWords(s.narration)]));

describe("map schema", () => {
  it("accepts regions and a focus box and defaults the tone", () => {
    expect(board(map()).scenes[0]).toMatchObject({ props: { tone: "highlight" } });
  });
  it("rejects zero or seven regions, duplicates and a long name", () => {
    expect(() => board(map({ regions: [] }))).toThrow(StoryboardError);
    expect(() => board(map({ regions: ["A", "B", "C", "D", "E", "F", "G"] }))).toThrow(StoryboardError);
    expect(() => board(map({ regions: ["Italy", "Italy"] }))).toThrow(/duplicate/);
    expect(() => board(map({ regions: ["x".repeat(41)] }))).toThrow(StoryboardError);
  });
  it("rejects an inverted or out-of-range focus box", () => {
    expect(() => board(map({ focus: [45, 28, -12, 56] }))).toThrow(StoryboardError);
    expect(() => board(map({ focus: [-12, 56, 45, 28] }))).toThrow(StoryboardError);
    expect(() => board(map({ focus: [-200, 28, 45, 56] }))).toThrow(StoryboardError);
    expect(() => board(map({ focus: [-12, 28, 45, 90] }))).toThrow(StoryboardError);
  });
});

describe("assertMapRegions", () => {
  it("accepts real atlas names", () => {
    expect(() => assertMapRegions(board(map()))).not.toThrow();
  });
  it("rejects an unknown name and suggests the atlas spelling", () => {
    const sb = board(map({ regions: ["United States"] }, [cue("United")]));
    expect(() => assertMapRegions(sb)).toThrow(/"m".*"United States".*United States of America/);
  });
});

describe("map fact tracing", () => {
  it("passes when the dataset equals the region list", () => {
    expect(() => assertFactsTraceable(board(map()), facts(REGIONS))).not.toThrow();
  });
  it("rejects a different list, a different order, and a fact without a dataset", () => {
    expect(() => assertFactsTraceable(board(map()), facts(["Italy", "Spain"]))).toThrow(/"m".*dataset of fact "f-m"/);
    expect(() => assertFactsTraceable(board(map()), facts([...REGIONS].reverse()))).toThrow(/dataset/);
    expect(() => assertFactsTraceable(board(map()), facts())).toThrow(/no dataset/);
  });
});

describe("map cue rules", () => {
  it("accepts one emphasize cue per region in any order", () => {
    expect(() => assertCuesSupported(board(map({}, [...CUES].reverse())))).not.toThrow();
  });
  it("rejects a missing cue, a callout cue and a cue word that is not a region word", () => {
    expect(() => assertCuesSupported(board(map({}, CUES.slice(1))))).toThrow(/exactly one emphasize cue per region/);
    expect(() => assertCuesSupported(board(map({}, [...CUES, { atWord: "Egypt", do: "callout", text: "x" }])))).toThrow(/at most 0 callout/);
    expect(() => assertCuesSupported(board(map({}, [{ atWord: "Italy", do: "emphasize", text: "Rome" }, ...CUES.slice(1)])))).toThrow(/not a word on screen/);
  });
  it("leaves a region untargeted when two regions share the cue word (loud, not silent)", () => {
    const regions = ["United Kingdom", "United States of America"];
    const cues = [{ atWord: "Britain", do: "emphasize", text: "United" }, { atWord: "America", do: "emphasize", text: "United" }];
    expect(() => assertCuesSupported(board(map({ regions }, cues)))).toThrow(/same region/);
  });
});

describe("regionCueFrames", () => {
  it("returns each region's cue frame in region order regardless of spoken order", () => {
    const cues = [
      { frame: 90, do: "emphasize", text: "Spain" },
      { frame: 40, do: "emphasize", text: "Italy" },
    ];
    expect(regionCueFrames(["Italy", "Spain"], cues)).toEqual([40, 90]);
  });
});

describe("map in buildVideo", () => {
  it("accepts a normal scene and rejects one that exits before the last region lights up", () => {
    expect(() => buildVideo(board(map()), facts(REGIONS), words, 30)).not.toThrow();
    const rushed = { ...map(), narration: "Italy Spain France Greece Turkey Egypt." };
    expect(() => buildVideo(board(rushed), facts(REGIONS), words, 30)).toThrow(/"m".*too short/);
  });
  it("rejects an unknown country name at build time", () => {
    const bad = map({ regions: ["Atlantis"] }, [cue("Atlantis")]);
    expect(() => buildVideo(board(bad), facts(["Atlantis"]), words, 30)).toThrow(/Atlantis/);
  });
  it("MAP.zoomFrames fits in a normal scene", () => {
    expect(MAP.zoomFrames).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npx vitest run tests/unit/mapScene.test.ts`
Expected: FAIL (unknown scene type, missing modules).

- [ ] **Step 3: Implement schema, timing and validation**

`src/schema/storyboard.ts`: add and export (also add `MapSceneSchema` to the union):

```ts
const LonSchema = z.number().min(-180).max(180);
const LatSchema = z.number().min(-85).max(85);

const MapSceneSchema = z.strictObject({
  ...sceneBase,
  type: z.literal("map"),
  props: z
    .strictObject({
      title: z.string().min(1).max(32),
      regions: z.array(z.string().min(1).max(40)).min(1).max(6),
      focus: z.tuple([LonSchema, LatSchema, LonSchema, LatSchema]),
      tone: z.enum(TONES).default("highlight"),
      factId: z.string().min(1),
    })
    .superRefine((props, ctx) => {
      const [w, s, e, n] = props.focus;
      if (w >= e || s >= n) {
        ctx.addIssue({ code: "custom", path: ["focus"], message: "focus must be [west, south, east, north] with west < east and south < north" });
      }
      const seen = new Set<string>();
      props.regions.forEach((name, i) => {
        if (seen.has(name)) ctx.addIssue({ code: "custom", path: ["regions", i], message: `duplicate region "${name}"` });
        seen.add(name);
      });
    }),
});
export type MapProps = Extract<Scene, { type: "map" }>["props"];
```

`src/scenes/map/timing.ts`:

```ts
import { itemCueFrames } from "../../schema/emphasis";

export const MAP = { zoomFrames: 70, settle: 12 } as const;

/** Frame each region lights up: the cue that names it, in region order. */
export const regionCueFrames = (
  regions: readonly string[],
  cues: readonly { frame: number; do: string; text?: string }[],
): number[] => itemCueFrames(regions, cues);
```

`src/schema/validate.ts`:
- `import { COUNTRY_NAMES, suggestCountries } from "../map/atlas";`
- `MAX_CALLOUTS` gains `map: 0`.
- extend the emphasis generalization: `EmphasisScene = Extract<Scene, { type: "kinetic-text" | "timeline" | "map" }>`; `isEmphasisScene` also accepts `"map"`; `emphasisItems` becomes a switch returning `{ items: scene.props.regions, noun: "region", exact: true }` for `map`.
- tracing case:

```ts
      case "map": {
        const fact = lookup(scene.id, scene.props.factId);
        if (fact.dataset === undefined) {
          throw new StoryboardError(`Scene "${scene.id}": fact "${fact.id}" has no dataset to verify the regions against`);
        }
        if (!deepEqual(fact.dataset, scene.props.regions)) {
          throw new StoryboardError(`Scene "${scene.id}": map regions do not match the dataset of fact "${fact.id}"`);
        }
        break;
      }
```
- region name check:

```ts
/** Every region must be a country name in the bundled atlas (modern borders). */
export function assertMapRegions(sb: Storyboard): void {
  for (const scene of sb.scenes) {
    if (scene.type !== "map") continue;
    for (const name of scene.props.regions) {
      if (COUNTRY_NAMES.has(name)) continue;
      const hint = suggestCountries(name);
      throw new StoryboardError(
        `Scene "${scene.id}": "${name}" is not a country name in the atlas${hint.length ? ` (did you mean: ${hint.join(", ")})` : ""}`,
      );
    }
  }
}
```
`src/pipeline/buildVideo.ts`: call `assertMapRegions(storyboard);` after `assertTextScenes`.

`src/pipeline/assertSceneTiming.ts`: add

```ts
    if (scene.type === "map") {
      let lastCue: number;
      try {
        lastCue = Math.max(...regionCueFrames(scene.props.regions, composed.cues));
      } catch (error) {
        if (error instanceof RangeError) throw new StoryboardError(`Scene "${scene.id}": ${error.message}`);
        throw error;
      }
      if (lastCue + MAP.settle > limit) {
        throw new StoryboardError(
          `Scene "${scene.id}" is too short (${composed.durationFrames} frames): the map cannot light its last region before the scene exits; lengthen the narration`,
        );
      }
    }
```

- [ ] **Step 4: Run to verify GREEN (logic)**

Run: `npx vitest run tests/unit/mapScene.test.ts`
Expected: PASS except the type check in `Video.tsx` (fixed in Step 5). If the "same region" test hits "not a word on screen" first, the cue word `United` resolved fine in both cues (both target region 0) so the shared check must raise "same region"; fix the code, not the test.

- [ ] **Step 5: Implement the component and wire it**

`src/scenes/map/MapScene.tsx`:

```tsx
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { geoPath } from "d3-geo";
import { EXIT_FRAMES } from "../../charts/timing";
import { BODY_FONT } from "../../design/fonts";
import { dataProgress, popIn } from "../../design/motion";
import { MAP_BOX, PALETTE, SAFE, VIDEO } from "../../design/tokens";
import { COUNTRY_BY_NAME, visibleCountries } from "../../map/atlas";
import { lerpBbox, projectionFor, visibleBbox, wideBbox, type Bbox } from "../../map/camera";
import type { MapProps } from "../../schema/storyboard";
import type { SceneRenderProps } from "../types";
import { MAP, regionCueFrames } from "./timing";

const HALO = { stroke: PALETTE.ground, strokeWidth: 10, paintOrder: "stroke", strokeLinejoin: "round" } as const;

/** Zooms from a wide view into the focus box while countries light up on their spoken names. */
export const MapScene: React.FC<SceneRenderProps<MapProps>> = ({ props, cues, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tone = PALETTE[props.tone];
  const focus = props.focus as Bbox;
  const zoom = dataProgress(frame, 0, MAP.zoomFrames);
  const projection = projectionFor(lerpBbox(wideBbox(focus), focus, zoom), MAP_BOX);
  const path = geoPath(projection);
  const countries = visibleCountries(visibleBbox(projection, MAP_BOX));
  const reveal = regionCueFrames(props.regions, cues);
  const titleIn = Math.min(1, popIn(frame, fps, 0));
  const exit = interpolate(frame, [durationFrames - EXIT_FRAMES, durationFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: PALETTE.ground, opacity: exit }}>
      <svg width={VIDEO.width} height={VIDEO.height} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <clipPath id="map-box">
            <rect x={MAP_BOX.left} y={MAP_BOX.top} width={MAP_BOX.right - MAP_BOX.left} height={MAP_BOX.bottom - MAP_BOX.top} />
          </clipPath>
        </defs>
        <text x={SAFE.side} y={SAFE.top + 52} fontFamily={BODY_FONT} fontSize={52} fill={PALETTE.ink} fillOpacity={0.85 * titleIn}>
          {props.title}
        </text>
        <text x={SAFE.side} y={SAFE.top + 104} fontFamily={BODY_FONT} fontSize={34} fill={PALETTE.ink} fillOpacity={0.5}>
          Modern borders, approximate
        </text>
        <g clipPath="url(#map-box)">
          {countries.map((c) => (
            <path key={c.properties.name} d={path(c) ?? ""} fill={PALETTE.ink} fillOpacity={0.1} stroke={PALETTE.ground} strokeWidth={2} />
          ))}
          {props.regions.map((name, i) => {
            const country = COUNTRY_BY_NAME.get(name);
            const pop = Math.min(1, popIn(frame, fps, reveal[i]));
            if (!country || pop <= 0) return null;
            return <path key={name} d={path(country) ?? ""} fill={tone} fillOpacity={pop} stroke={PALETTE.ground} strokeWidth={2} />;
          })}
          {props.regions.map((name, i) => {
            const country = COUNTRY_BY_NAME.get(name);
            const pop = Math.min(1, popIn(frame, fps, reveal[i]));
            if (!country || pop <= 0) return null;
            const [x, y] = path.centroid(country);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
            return (
              <text
                key={`${name}-label`} x={x} y={y} textAnchor="middle" opacity={pop}
                fontFamily={BODY_FONT} fontSize={38} fill={PALETTE.ink} {...HALO}
              >
                {name}
              </text>
            );
          })}
        </g>
      </svg>
    </AbsoluteFill>
  );
};
```

Add `case "map": return <MapScene props={scene.props} cues={cues} durationFrames={durationFrames} />;` (with import) to `src/compose/Video.tsx`.

- [ ] **Step 6: Run all suites**

Run: `npm run typecheck && npx vitest run tests/unit`
Expected: clean, all PASS.

- [ ] **Step 7: Checkpoint (only if asked)**

`git add -A && git commit -m "feat: map scene with narration-lit countries and zoom camera"`

---

### Task 5: Ancient demo, goldens, real voice, docs

**Files:**
- Create: `fixtures/ancient.storyboard.json`, `fixtures/ancient.facts.json`, `tests/unit/ancientDemo.test.ts`, `tests/render/ancient.snapshot.test.ts`
- Modify: `src/Root.tsx`, `docs/superpowers/specs/2026-10-05-motion-explainers-design.md`, `spikes/RESULTS.md`, `.superpowers/progress.md` (ledger, gitignored)

- [ ] **Step 1: Write the demo fixtures**

`fixtures/ancient.facts.json` (demo data, flagged for verification):

```json
{
  "facts": [
    {
      "id": "f-regions",
      "claim": "Modern countries that lie within the Roman Empire at its greatest extent, c. 117 AD (approximate; demo data, verify before publishing)",
      "dataset": ["Italy", "Spain", "France", "Greece", "Turkey", "Egypt"],
      "source": { "name": "Wikipedia: Roman Empire", "url": "https://en.wikipedia.org/wiki/Roman_Empire" }
    },
    {
      "id": "f-dates",
      "claim": "Key dates of Rome: traditional founding 753 BC; Caesar assassinated 44 BC; Augustus becomes first emperor 27 BC; Western Roman Empire ends 476 AD (demo data, verify before publishing)",
      "dataset": [
        { "year": -753, "label": "Rome is founded" },
        { "year": -44, "label": "Caesar is assassinated" },
        { "year": -27, "label": "Augustus becomes emperor" },
        { "year": 476, "label": "Western empire falls" }
      ],
      "source": { "name": "Wikipedia: Timeline of Roman history", "url": "https://en.wikipedia.org/wiki/Timeline_of_ancient_Rome" }
    }
  ]
}
```

`fixtures/ancient.storyboard.json`: four scenes of four types: `intro` title (headline "Rome in Two Minutes", kicker "HISTORY", narration "Rome, in under a minute."); `reach` map (title "The Roman world", regions the six names in the fact order, focus `[-12, 28, 45, 56]`, factId `f-regions`, narration "At its height Rome reached from Italy to Spain, France, Greece, Turkey and Egypt, a very large stretch of the world.", six emphasize cues each with `atWord` and `text` equal to the country name); `dates` timeline (title "Rome in four dates", the four events from the fact, factId `f-dates`, narration "Rome was founded, legend says, in seven fifty three BC. Caesar was assassinated in forty four BC, and Augustus became emperor soon after. The western empire finally falls in four seventy six.", cues `founded`, `assassinated`, `emperor`, `falls` each as `emphasize` with `text` equal to `atWord`); `legacy` kinetic-text (lines `["Roads, law,", "and legions"]`, narration "Its roads, its laws and its legions shaped the world that followed.", one emphasize cue `{ "atWord": "legions", "do": "emphasize", "text": "legions" }`). Meta voice `en-US-AndrewNeural`, `audio.music` null.

- [ ] **Step 2: Write the failing demo test**

`tests/unit/ancientDemo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import facts from "../../fixtures/ancient.facts.json";
import storyboard from "../../fixtures/ancient.storyboard.json";
import { cutFrames } from "../../src/compose/wipe";
import { buildVideo } from "../../src/pipeline/buildVideo";
import { synthWords } from "../../src/voice/synthWords";

const built = buildVideo(
  storyboard, facts,
  (sb) => Object.fromEntries(sb.scenes.map((s) => [s.id, synthWords(s.narration)])),
  30,
);

describe("ancient demo storyboard", () => {
  it("validates under every Plan 5 rule and has four scenes of four types", () => {
    expect(built.scenes.map((s) => s.scene.type)).toEqual(["title", "map", "timeline", "kinetic-text"]);
    expect(cutFrames(built.scenes)).toHaveLength(3);
  });
  it("resolves one cue per region and per event inside their scenes", () => {
    expect(built.scenes[1].cues).toHaveLength(6);
    expect(built.scenes[2].cues).toHaveLength(4);
    for (const s of built.scenes) for (const c of s.cues) expect(c.frame).toBeLessThan(s.durationFrames);
  });
});
```

Run: `npx vitest run tests/unit/ancientDemo.test.ts`
Expected: PASS once the fixtures exist; a failure here is a fixture or rule issue (fix the fixture, not the rule).

- [ ] **Step 3: Register the composition and add snapshots**

In `src/Root.tsx` import the two ancient fixtures, build `ancient` exactly like `history` (stand-in `synthWords`), and add `<Composition id="AncientDemo" ... defaultProps={{ scenes: ancient.scenes, captions: ancient.captions }} />`.

`tests/render/ancient.snapshot.test.ts`, modeled on `history.snapshot.test.ts` (same `expectMatchesGolden("AncientDemo", "ancient", name, frame)` helper), with targets: `map-mid` (scene start + the frame of the third region cue + 6), `map-end` (scene end minus 10), `timeline-mid` (scene start + the second event cue frame + 6), `timeline-end` (scene end minus 10).

Run: `UPDATE_SNAPSHOTS=1 npx vitest run tests/render/ancient.snapshot.test.ts --testTimeout=240000 --no-file-parallelism`
Expected: PASS and four goldens written. Read each and confirm by eye, recording in the ledger: the map is inside its box and does not touch the caption lane, the highlighted countries are exactly the lit ones and their names are legible, the "Modern borders, approximate" footnote is visible, Russia and other large shapes have no smear across the frame; the timeline spine ends on the latest event, older events are dimmed, years read "753 BC" / "44 BC" / "27 BC" / "AD 476", and nothing crosses y 1340. Fix and re-run if any fails.

- [ ] **Step 4: Measure render cost and produce with the real voice**

Run: `time npx remotion render src/index.ts AncientDemo out/ancient-frames --sequence --image-format=jpeg` and divide by the frame count printed by the composition. Record seconds per frame in the ledger.
Expected: at most about 0.15 s/frame for the map scene (the finance demo is about 0.06). If the map scene is much slower, profile `visibleCountries` and path generation before accepting; a ruling with the measured number is required either way.

Run: `npm run produce -- --storyboard fixtures/ancient.storyboard.json --facts fixtures/ancient.facts.json --out out/ancient-edge --no-enforce-length`
Expected: `final.mp4` produced, loudness within -14 +/- 1 LUFS and true peak <= -1.5 dBTP (the produce gate enforces it). Extract frames from the mp4 with ffmpeg at the "Greece" cue (+4 frames) and at the "assassinated" cue (+4 frames), using the cue frames in `out/ancient-edge/manifest.json`, and Read them: the highlighted country and the caption word match, and the spine sits on the event being spoken.

- [ ] **Step 5: Full verification**

Run: `npm run typecheck && npm run test:cov && npm run test:render`
Expected: typecheck clean; unit tests PASS with coverage >= 80% on every included glob (including `src/map/**`); render tests PASS serially. Report exact counts.

- [ ] **Step 6: Update the docs**

- Spec section 4: add a "Plan 5 decisions" block (timeline: 2-6 events, spine paced to cues, one emphasize cue per event, events deep-equal a fact dataset, BC/AD formatting; map: modern borders with an on-screen footnote, regions are atlas country names, one emphasize cue per region, zoom from a 2.4x wider view, regions deep-equal a fact dataset; `pacedKnots` is the shared pacing primitive); update the scene library list and milestone 5 status to done.
- `spikes/RESULTS.md`: "Plan 5 results" (render cost per frame for the map scene, eye-review findings, atlas name gotchas such as "United States of America") and "Inputs for Plan 6" (the Claude Code skill: topic to `facts.json` with sources to script to storyboard JSON, using `fixtures/*.storyboard.json` as few-shot examples; validate and repair loop driven by the existing `StoryboardError` messages; review sheet of stills per scene; human review gate before `npm run produce`; carried gaps: title numbers and callout text not fact-traced, fonts load from Google at render time, stand-in voice is noise, single-process render, quote truncation is not detected by the substring trace).
- Ledger lines for each task and every ruling.

- [ ] **Step 7: Checkpoint (only if asked)**

`git add -A && git commit -m "feat: ancient demo with map and timeline verified end to end"`
