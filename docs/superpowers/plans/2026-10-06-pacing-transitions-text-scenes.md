# Motion Explainers: Plan 4 (Narration Pacing, Transitions, Text Scenes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the video feel directed instead of assembled: the line chart reaches each callout's point on the spoken word, scenes are joined by flat shape wipes, chart labels stay legible, and three new scenes (`kinetic-text`, `compare`, `quote`) give finance and history videos real variety.

**Architecture:** Chart pacing becomes a pure monotone schedule through `(frame, progress)` knots taken from the callout cues, replacing the fixed-share ease. Transitions are an SVG overlay (two slanted flat color bands) drawn above the scene `Series` and below the captions at each cut, so scene durations and audio sync are untouched. New scenes follow the existing contract: a strict Zod schema, validation (fact tracing, cue rules, fit checks), a pure layout/timing module, and a Remotion component that is a pure function of the frame.

**Tech Stack:** Existing stack only (Remotion 4.0.533, React 19, Zod 4.5.4, d3-scale, vitest, system ffmpeg). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-05-motion-explainers-design.md` (sections 4, 8 milestone 4). Previous plans: `2026-10-06-foundation-and-spikes.md`, `2026-10-06-animated-charts.md`, `2026-10-06-voice-captions-audio.md`. Brief: `spikes/RESULTS.md` ("Inputs for Plan 4").

**Scope note (what moved):**
- Plan 4 (this plan): narration-paced line draw, scene wipes, label legibility, `kinetic-text`, `compare`, `quote`.
- Plan 5: `timeline` and `map` (history scenes, `world-atlas` data).
- Plan 6: the Claude Code skill (topic to facts to script to storyboard, repair loop, review sheet, human gate).
- Dropped from v1, recorded in the spec by Task 7: the chart camera push-in (scaling a chart pushes tick labels out of the safe gutters; narration-paced drawing plus wipes carries the motion instead) and matched-element transitions (revisit after real videos exist). The bar race keeps its proportional pacing; only the line chart has a spoken anchor to sync to.
- Left as is on purpose: the area fill's vertical edge at the cursor (it reads as the reveal edge).

## Verified before writing this plan

- The current `LineChart` appears callouts at `max(cueFrame, frame the eased line reaches x)`, so a callout can lag its word by seconds (finance demo: "climbed" at about frame 100, line reaches 2021 later).
- `cursorX(points, p)` is linear in `p` (`first + (last - first) * p`), so the progress for an anchor is `(x - first) / (last - first)`.
- Hermite cubic with end slope 0 and start slope `2 * secant` equals `1 - (1 - t)^2` on one segment; interior slope = harmonic mean of neighbouring secants (0 at a sign change or flat segment) keeps every segment inside the Fritsch-Carlson monotone region (alpha, beta <= 2, alpha^2 + beta^2 <= 8 < 9).
- `DEFAULT_TAIL_PAD_MS` is 400 ms (12 frames) and `EXIT_FRAMES` is 8, so a final callout knot (cue frame + 6) can never land inside the exit fade; the "too short" failure for charts comes from the default end frame.
- `spring` with a negative frame returns 0, which the scenes already rely on for delayed pops.

## Global Constraints

- Everything from Plans 1 to 3 still applies: 1080x1920 @ 30fps; all `remotion*` pinned `4.0.533`; zod pinned `4.5.4`; data eases with no overshoot (springs only for objects, clamped with `Math.min(1, ...)` when overshoot would leave a mask or lane); files < 800 lines; immutable data; zero paid services; TDD with 80% coverage on non-visual logic.
- **System ffmpeg only**; frames are JPEG sequences (unchanged).
- Scene content stays above `CAPTION_LANE.top` (1340). Transitions are the only thing allowed to cross the lane, and they sit below the captions in z-order.
- Every number on screen traces to a sourced fact: `compare` values trace to one fact per side (same exact-match rules as `big-number`); `quote` text must appear in its fact's `claim`; `kinetic-text` lines may not contain digits (use `big-number`).
- Scene durations are never lengthened by visuals: a scene whose reveal cannot finish before its exit fade is rejected with a clear error (`assertSceneTiming`).
- **No git commits unless the user explicitly asks.** Each "Checkpoint" step names the intended message; run it only if asked. Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

Failure modes the spec implies but happy-path tests would miss, most likely first. Each has a pinning test in the task named.

1. Callout cues that cannot be honored: out of left-to-right order, spoken before the line starts, or on the first x. Expected: never a teleporting line; an impossible order is a loud error naming the scene; an early cue is pushed to the earliest feasible frame (Task 1).
2. The wipe must hide the cut completely at the cut frame and leave no residue before or after, including the lagging second band (Task 2).
3. A tick label is hidden only while a badge actually overlaps it, and never the badge itself (Task 3).
4. `emphasize` cue text that is not a word on screen, is several words, or sits on a scene that cannot render it (Task 4).
5. `compare` with a zero or equal value, a huge ratio, and one side untraceable (Task 5).
6. `quote` whose text differs from the fact (curly vs straight quotes, whitespace), is too long to fit, or is read faster than it can be revealed (Task 6).
7. Narration shorter than a scene's reveal: rejected, not clipped (Tasks 4, 6).
8. Known gap, not tested: taste. Kinetic-text, compare and quote are judged by golden images the agent reviews by eye; the user should watch the history demo.

## File Structure

```
src/charts/schedule.ts            create: Knot, scheduleProgress (monotone Hermite)
src/charts/timing.ts              modify: drawPlan; remove calloutAppearFrame
src/charts/labels.ts              create: Rect, overlaps, badgeRect, tickLabelRect
src/design/motion.ts              modify: remove dataFrameAt (unused after Task 1)
src/design/tokens.ts              modify: QUOTE_LANE, KINETIC_LANE
src/compose/wipe.ts               create: WIPE, cutFrames, wipeBand, bandPoints
src/compose/Wipe.tsx              create: overlay
src/compose/Video.tsx             modify: wipes, new scene cases
src/schema/storyboard.ts          modify: cue text rule; 3 scene schemas + types
src/schema/emphasis.ts            create: emphasisTarget
src/schema/validate.ts            modify: tracing switch, cue rules, assertTextScenes
src/pipeline/assertChartTiming.ts rename to assertSceneTiming.ts; add reveal checks
src/pipeline/buildVideo.ts        modify: new asserts
src/scenes/kinetic-text/{KineticText.tsx,timing.ts}            create
src/scenes/compare/{Compare.tsx,layout.ts}                      create
src/scenes/quote/{Quote.tsx,timing.ts}                          create
src/scenes/line-chart/LineChart.tsx    modify: schedule, labels layer
src/scenes/bar-race/BarRace.tsx        modify: label layer
src/Root.tsx                           modify: HistoryDemo
fixtures/history.{storyboard,facts}.json   create
tests/unit/*, tests/render/*               see tasks
vitest.config.ts                           modify: coverage globs
```

---

### Task 1: Narration-paced line draw

**Files:**
- Create: `src/charts/schedule.ts`, `tests/unit/schedule.test.ts`, `tests/unit/drawPlan.test.ts`
- Modify: `src/charts/timing.ts`, `src/scenes/line-chart/LineChart.tsx`, `src/design/motion.ts`, `tests/unit/motionChart.test.ts`, `tests/unit/chartTiming.test.ts`
- Rename: `src/pipeline/assertChartTiming.ts` to `src/pipeline/assertSceneTiming.ts` (function `assertSceneTiming`); update `src/pipeline/buildVideo.ts`

**Interfaces:**
- Produces: `type Knot = { frame: number; progress: number }`; `scheduleProgress(frame: number, knots: readonly Knot[]): number`; `drawPlan(callouts: readonly { frame: number; x: number }[], points: readonly DataPoint[], durationFrames: number): { knots: Knot[]; appear: number[] }` (`appear[i]` is the frame callout `i` of the input appears, input order); `LINE_DRAW_MIN_SEGMENT = 6`; `assertSceneTiming(scenes: readonly ComposedScene[]): void`.
- Removes: `calloutAppearFrame`, `dataFrameAt`.

- [ ] **Step 1: Write the failing schedule tests**

`tests/unit/schedule.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { scheduleProgress, type Knot } from "../../src/charts/schedule";

const knots: Knot[] = [
  { frame: 14, progress: 0 },
  { frame: 30, progress: 0.1 },
  { frame: 90, progress: 0.8 },
  { frame: 120, progress: 0.8 }, // flat segment
  { frame: 150, progress: 1 },
];

describe("scheduleProgress", () => {
  it("passes exactly through every knot", () => {
    for (const k of knots) expect(scheduleProgress(k.frame, knots)).toBeCloseTo(k.progress, 12);
  });
  it("holds the first value before the start and the last value after the end", () => {
    expect(scheduleProgress(-5, knots)).toBe(0);
    expect(scheduleProgress(500, knots)).toBe(1);
  });
  it("never moves backwards and never leaves [0, 1] (sampled every frame)", () => {
    let prev = 0;
    for (let f = 0; f <= 160; f += 1) {
      const p = scheduleProgress(f, knots);
      expect(p).toBeGreaterThanOrEqual(prev - 1e-12);
      expect(p).toBeLessThanOrEqual(1);
      prev = p;
    }
  });
  it("stays flat across a flat segment", () => {
    expect(scheduleProgress(105, knots)).toBeCloseTo(0.8, 12);
  });
  it("has continuous speed through an interior knot (no jolt at a callout)", () => {
    const e = 1e-4;
    const left = (scheduleProgress(30, knots) - scheduleProgress(30 - e, knots)) / e;
    const right = (scheduleProgress(30 + e, knots) - scheduleProgress(30, knots)) / e;
    expect(Math.abs(left - right)).toBeLessThan(1e-3);
  });
  it("is an ease-out (1 - (1 - t)^2) on a single segment and settles with zero speed", () => {
    const one: Knot[] = [{ frame: 10, progress: 0 }, { frame: 50, progress: 1 }];
    for (const t of [0.1, 0.25, 0.5, 0.9]) {
      expect(scheduleProgress(10 + 40 * t, one)).toBeCloseTo(1 - (1 - t) ** 2, 10);
    }
    expect(scheduleProgress(50, one) - scheduleProgress(49.999, one)).toBeLessThan(1e-4);
  });
  it("rejects fewer than two knots, repeated frames and falling progress", () => {
    expect(() => scheduleProgress(1, [{ frame: 1, progress: 0 }])).toThrow(RangeError);
    expect(() => scheduleProgress(1, [{ frame: 1, progress: 0 }, { frame: 1, progress: 1 }])).toThrow(RangeError);
    expect(() => scheduleProgress(1, [{ frame: 1, progress: 0.5 }, { frame: 9, progress: 0.2 }])).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npx vitest run tests/unit/schedule.test.ts`
Expected: FAIL, cannot resolve `../../src/charts/schedule`.

- [ ] **Step 3: Implement `src/charts/schedule.ts`**

```ts
export type Knot = { frame: number; progress: number };

/**
 * Per-knot slope (progress per frame). Interior knots use the harmonic mean of the neighbouring
 * secants (0 where the direction changes or a segment is flat), the start launches at twice its
 * secant and the end settles at 0. Every segment stays inside the monotone region, so the cursor
 * never overshoots or backtracks while its speed stays continuous through callouts.
 */
function slopes(knots: readonly Knot[]): number[] {
  const secants = knots.slice(1).map((k, i) => (k.progress - knots[i].progress) / (k.frame - knots[i].frame));
  return knots.map((_, i) => {
    if (i === 0) return 2 * secants[0];
    if (i === knots.length - 1) return 0;
    const [a, b] = [secants[i - 1], secants[i]];
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b);
  });
}

function assertKnots(knots: readonly Knot[]): void {
  if (knots.length < 2) throw new RangeError("a schedule needs at least two knots");
  knots.forEach((k, i) => {
    if (i === 0) return;
    if (k.frame <= knots[i - 1].frame) throw new RangeError("knot frames must strictly increase");
    if (k.progress < knots[i - 1].progress) throw new RangeError("knot progress must not decrease");
  });
}

/** Draw progress at `frame`: a monotone cubic Hermite curve through the knots. */
export function scheduleProgress(frame: number, knots: readonly Knot[]): number {
  assertKnots(knots);
  const first = knots[0];
  const last = knots[knots.length - 1];
  if (frame <= first.frame) return first.progress;
  if (frame >= last.frame) return last.progress;
  const i = knots.findIndex((_, idx) => idx < knots.length - 1 && frame < knots[idx + 1].frame);
  const [a, b] = [knots[i], knots[i + 1]];
  const m = slopes(knots);
  const h = b.frame - a.frame;
  const t = (frame - a.frame) / h;
  const value =
    (2 * t ** 3 - 3 * t ** 2 + 1) * a.progress +
    (t ** 3 - 2 * t ** 2 + t) * h * m[i] +
    (-2 * t ** 3 + 3 * t ** 2) * b.progress +
    (t ** 3 - t ** 2) * h * m[i + 1];
  return Math.min(last.progress, Math.max(first.progress, value));
}
```

- [ ] **Step 4: Run to verify GREEN**

Run: `npx vitest run tests/unit/schedule.test.ts`
Expected: PASS 7/7.

- [ ] **Step 5: Write the failing draw-plan tests**

`tests/unit/drawPlan.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cursorX } from "../../src/charts/geometry";
import { scheduleProgress } from "../../src/charts/schedule";
import { LINE_DRAW, LINE_DRAW_MIN_SEGMENT, drawPlan, lineDrawFrames } from "../../src/charts/timing";

const points = Array.from({ length: 17 }, (_, i) => ({ x: 2007 + i, y: i }));
const DURATION = 300;

describe("drawPlan", () => {
  it("without callouts is one segment from the draw start to the default end", () => {
    const plan = drawPlan([], points, DURATION);
    expect(plan.knots).toEqual([
      { frame: LINE_DRAW.start, progress: 0 },
      { frame: LINE_DRAW.start + lineDrawFrames(DURATION), progress: 1 },
    ]);
    expect(plan.appear).toEqual([]);
  });

  it("puts the cursor exactly on each callout's x on the frame the callout appears", () => {
    const callouts = [{ frame: 60, x: 2008 }, { frame: 150, x: 2021 }];
    const plan = drawPlan(callouts, points, DURATION);
    expect(plan.appear).toEqual([60, 150]);
    callouts.forEach((c, i) => {
      const at = cursorX(points, scheduleProgress(plan.appear[i], plan.knots));
      expect(at).toBeCloseTo(c.x, 9);
    });
  });

  it("keeps appear in input order even when cues are listed out of time order", () => {
    const plan = drawPlan([{ frame: 150, x: 2021 }, { frame: 60, x: 2008 }], points, DURATION);
    expect(plan.appear).toEqual([150, 60]);
  });

  it("pushes a cue spoken before the line can get there to the earliest feasible frame", () => {
    const plan = drawPlan([{ frame: 3, x: 2010 }], points, DURATION);
    expect(plan.appear[0]).toBe(LINE_DRAW.start + LINE_DRAW_MIN_SEGMENT);
  });

  it("keeps two close cues at least a minimum segment apart", () => {
    const plan = drawPlan([{ frame: 40, x: 2009 }, { frame: 42, x: 2012 }], points, DURATION);
    expect(plan.appear[1] - plan.appear[0]).toBeGreaterThanOrEqual(LINE_DRAW_MIN_SEGMENT);
  });

  it("rejects callouts whose spoken order runs right to left", () => {
    expect(() => drawPlan([{ frame: 50, x: 2020 }, { frame: 90, x: 2010 }], points, DURATION)).toThrow(/left to right/);
  });

  it("does not add a second final knot when the last callout is the last point", () => {
    const plan = drawPlan([{ frame: 400, x: 2023 }], points, 520);
    const frames = plan.knots.map((k) => k.frame);
    expect(new Set(frames).size).toBe(frames.length);
    expect(plan.knots[plan.knots.length - 1].progress).toBe(1);
  });

  it("the cursor never moves left across the whole scene", () => {
    const plan = drawPlan([{ frame: 40, x: 2008 }, { frame: 120, x: 2021 }], points, DURATION);
    let prev = -Infinity;
    for (let f = 0; f <= DURATION; f += 1) {
      const x = cursorX(points, scheduleProgress(f, plan.knots));
      expect(x).toBeGreaterThanOrEqual(prev);
      prev = x;
    }
  });
});
```

- [ ] **Step 6: Run to verify RED**

Run: `npx vitest run tests/unit/drawPlan.test.ts`
Expected: FAIL, `drawPlan` / `LINE_DRAW_MIN_SEGMENT` not exported.

- [ ] **Step 7: Implement `drawPlan` in `src/charts/timing.ts`**

Replace the imports and `calloutAppearFrame` (delete it) so the file reads:

```ts
import type { DataPoint } from "./geometry";
import type { Knot } from "./schedule";

/** Frames at the end of every scene used by the exit fade. */
export const EXIT_FRAMES = 8;

export const LINE_DRAW = { start: 14, share: 0.7, minFrames: 30 } as const;
export const RACE_RUN = { start: 10, share: 0.8, minFrames: 40 } as const;
/** Least frames the line may spend travelling between two callouts (prevents a teleporting cursor). */
export const LINE_DRAW_MIN_SEGMENT = 6;

export const lineDrawFrames = (durationFrames: number): number =>
  Math.max(LINE_DRAW.minFrames, Math.round(durationFrames * LINE_DRAW.share) - LINE_DRAW.start);

export const raceRunFrames = (durationFrames: number): number =>
  Math.max(RACE_RUN.minFrames, Math.round(durationFrames * RACE_RUN.share) - RACE_RUN.start);

export type CalloutAnchor = { frame: number; x: number };
export type DrawPlan = { knots: Knot[]; appear: number[] };

/**
 * Pacing for a line draw: the cursor sits on each callout's x on the frame that callout appears,
 * which is its cue frame (pushed later only when the line could not otherwise get there without
 * jumping). `appear[i]` belongs to `callouts[i]`. Callouts must run left to right in spoken order.
 */
export function drawPlan(
  callouts: readonly CalloutAnchor[],
  points: readonly DataPoint[],
  durationFrames: number,
): DrawPlan {
  const first = points[0].x;
  const span = points[points.length - 1].x - first;
  const ordered = callouts
    .map((c, index) => ({ ...c, index }))
    .sort((a, b) => a.frame - b.frame || a.index - b.index);
  const knots: Knot[] = [{ frame: LINE_DRAW.start, progress: 0 }];
  const appear = new Array<number>(callouts.length);
  for (const c of ordered) {
    const prev = knots[knots.length - 1];
    const progress = (c.x - first) / span;
    if (progress < prev.progress) {
      throw new RangeError(`callout cues must run left to right in spoken order (x ${c.x} is spoken after a callout further right)`);
    }
    const frame = Math.max(c.frame, prev.frame + LINE_DRAW_MIN_SEGMENT);
    knots.push({ frame, progress });
    appear[c.index] = frame;
  }
  const last = knots[knots.length - 1];
  const defaultEnd = LINE_DRAW.start + lineDrawFrames(durationFrames);
  const tail = last.progress < 1 ? Math.max(defaultEnd, last.frame + LINE_DRAW_MIN_SEGMENT) : defaultEnd;
  if (tail > last.frame) knots.push({ frame: tail, progress: 1 });
  return { knots, appear };
}
```

- [ ] **Step 8: Run to verify GREEN**

Run: `npx vitest run tests/unit/drawPlan.test.ts tests/unit/schedule.test.ts`
Expected: PASS. (`tests/unit/motionChart.test.ts` and other files that import `calloutAppearFrame`/`dataFrameAt` are fixed in Step 12.)

- [ ] **Step 9: Write the failing scene-timing integration tests**

Append to `tests/unit/chartTiming.test.ts` (inside the existing file, reuse its helpers `facts`, `board`, `words`, `points`):

```ts
describe("line-chart callout pacing is validated against the narration", () => {
  const longPoints = [{ x: 1, y: 1 }, { x: 2, y: 5 }, { x: 3, y: 2 }];
  const scene = (cues: unknown[]) => ({
    id: "c", type: "line-chart",
    narration: "Prices rose steadily and then fell sharply before settling down for the rest of the long year.",
    props: { title: "T", points: longPoints, factId: "f1" },
    cues,
  });
  it("rejects callouts spoken right to left", () => {
    const cues = [
      { atWord: "rose", do: "callout", text: "Up", x: 3 },
      { atWord: "fell", do: "callout", text: "Down", x: 2 },
    ];
    expect(() => buildVideo(board(scene(cues)), facts(longPoints), words, 30)).toThrow(/"c".*left to right/);
  });
  it("accepts callouts spoken left to right", () => {
    const cues = [
      { atWord: "rose", do: "callout", text: "Up", x: 2 },
      { atWord: "fell", do: "callout", text: "Down", x: 3 },
    ];
    expect(() => buildVideo(board(scene(cues)), facts(longPoints), words, 30)).not.toThrow();
  });
});
```

- [ ] **Step 10: Run to verify RED**

Run: `npx vitest run tests/unit/chartTiming.test.ts`
Expected: the "right to left" test FAILS (build currently accepts it); the existing `too short` tests still pass.

- [ ] **Step 11: Rename and rewrite the timing assertion**

`git mv src/pipeline/assertChartTiming.ts src/pipeline/assertSceneTiming.ts` and replace its contents:

```ts
import { RACE_RUN, raceRunFrames, drawPlan, EXIT_FRAMES } from "../charts/timing";
import { StoryboardError } from "../schema/storyboard";
import type { ComposedScene } from "./resolveScene";

/** A scene must finish animating before its exit fade, or its callouts and final value are lost. */
export function assertSceneTiming(scenes: readonly ComposedScene[]): void {
  for (const composed of scenes) {
    const limit = composed.durationFrames - EXIT_FRAMES;
    const { scene } = composed;
    if (scene.type === "line-chart") {
      const callouts = composed.cues
        .filter((c) => c.do === "callout" && c.x !== undefined)
        .map((c) => ({ frame: c.frame, x: c.x as number }));
      let end: number;
      try {
        const { knots } = drawPlan(callouts, scene.props.points, composed.durationFrames);
        end = knots[knots.length - 1].frame;
      } catch (error) {
        if (error instanceof RangeError) throw new StoryboardError(`Scene "${scene.id}": ${error.message}`);
        throw error;
      }
      if (end > limit) {
        throw new StoryboardError(
          `Scene "${scene.id}" is too short (${composed.durationFrames} frames): the line chart cannot finish drawing before the scene exits; lengthen the narration`,
        );
      }
    }
    if (scene.type === "bar-race" && RACE_RUN.start + raceRunFrames(composed.durationFrames) > limit) {
      throw new StoryboardError(
        `Scene "${scene.id}" is too short (${composed.durationFrames} frames): the bar race cannot finish before the scene exits; lengthen the narration`,
      );
    }
  }
}
```

In `src/pipeline/buildVideo.ts` change the import to `import { assertSceneTiming } from "./assertSceneTiming";` and the call to `assertSceneTiming(scenes);`.

- [ ] **Step 12: Use the plan in `LineChart`, delete dead code**

In `src/scenes/line-chart/LineChart.tsx`:
- imports: replace the `timing` import with `import { EXIT_FRAMES, LINE_DRAW, drawPlan } from "../../charts/timing";`, add `import { scheduleProgress } from "../../charts/schedule";`, and drop `dataProgress` from the `motion` import.
- replace `const progress = dataProgress(...)` with:

```tsx
  const calloutCues = cues.filter((c) => c.do === "callout" && c.text !== undefined && c.x !== undefined);
  const plan = drawPlan(
    calloutCues.map((c) => ({ frame: c.frame, x: c.x as number })),
    points,
    durationFrames,
  );
  const progress = scheduleProgress(frame, plan.knots);
```

- replace the whole `cues.filter(...).map(...)` callout block with:

```tsx
        {calloutCues.map((c, i) => {
          if (frame < plan.appear[i]) return null;
          const anchorXValue = c.x as number;
          const ax = sx(anchorXValue);
          const ay = sy(valueAtX(points, anchorXValue));
          return (
            <CalloutBadge
              key={`${c.frame}-${c.x}`} badge={placeBadge(ax, ay, c.text as string)} text={c.text as string}
              anchorX={ax} anchorY={ay} scale={popIn(frame, fps, plan.appear[i])} color={tone}
            />
          );
        })}
```

In `src/design/motion.ts` delete `dataFrameAt`; in `tests/unit/motionChart.test.ts` delete the `dataFrameAt` describe block and drop it from the import. Run `grep -rn "calloutAppearFrame\|dataFrameAt" src tests` and update any remaining test that referenced `calloutAppearFrame` to assert through `drawPlan` instead (the behavior it pinned, "after cue word and once the line reaches x", is replaced by "cursor is on x at the cue frame", already covered in `drawPlan.test.ts`; delete the obsolete assertions).

- [ ] **Step 13: Run the suites**

Run: `npm run typecheck && npx vitest run tests/unit`
Expected: typecheck clean; all unit tests PASS (count rises from 280). The finance render goldens are now stale (the line paces differently); they are regenerated and reviewed in Task 3 Step 7, so do not run `test:render` before then.

- [ ] **Step 14: Real-timing check on the finance demo**

Run: `npx tsx -e "import('./src/pipeline/buildVideo.ts').then(async ({buildVideo})=>{const fs=await import('node:fs');const {synthWords}=await import('./src/voice/synthWords.ts');const {drawPlan}=await import('./src/charts/timing.ts');const b=buildVideo(JSON.parse(fs.readFileSync('fixtures/finance.storyboard.json','utf8')),JSON.parse(fs.readFileSync('fixtures/finance.facts.json','utf8')),sb=>Object.fromEntries(sb.scenes.map(s=>[s.id,synthWords(s.narration)])),30);for(const s of b.scenes){if(s.scene.type!=='line-chart')continue;const c=s.cues.filter(q=>q.do==='callout').map(q=>({frame:q.frame,x:q.x}));console.log(s.id,c,drawPlan(c,s.scene.props.points,s.durationFrames).appear)}})"`
Expected: for each line-chart scene, `appear` equals the cue frames (or the cue frame pushed to 20), and no error.

- [ ] **Step 15: Checkpoint (only if asked)**

`git add -A && git commit -m "feat: pace line-chart drawing to the narration cues"`

---

### Task 2: Scene wipe transitions

**Files:**
- Create: `src/compose/wipe.ts`, `src/compose/Wipe.tsx`, `tests/unit/wipe.test.ts`
- Modify: `src/compose/Video.tsx`, `vitest.config.ts`

**Interfaces:**
- Consumes: `ComposedScene.startFrame` (Plan 3), `easeInOutCubic`, `VIDEO`, `PALETTE`.
- Produces: `WIPE = { frames: 14, slant: 280, lag: 3 }`; `cutFrames(scenes): number[]` (start frames of every scene after the first); `wipeBand(frame, cutFrame, lagFrames?): Band | null` where `Band = { trail: number; lead: number }` are the band's top-edge x positions; `bandPoints(band): string` (SVG polygon points).

- [ ] **Step 1: Write the failing tests**

`tests/unit/wipe.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { WIPE, bandPoints, cutFrames, wipeBand } from "../../src/compose/wipe";
import { VIDEO } from "../../src/design/tokens";

const CUT = 200;
const HALF = WIPE.frames / 2;

describe("cutFrames", () => {
  it("returns the start frame of every scene after the first", () => {
    expect(cutFrames([{ startFrame: 0 }, { startFrame: 90 }, { startFrame: 210 }])).toEqual([90, 210]);
  });
  it("returns nothing for a single scene", () => {
    expect(cutFrames([{ startFrame: 0 }])).toEqual([]);
  });
});

describe("wipeBand", () => {
  it("draws nothing outside its window (no residue before or after the cut)", () => {
    expect(wipeBand(CUT - HALF, CUT)).toBeNull();
    expect(wipeBand(CUT - HALF - 30, CUT)).toBeNull();
    expect(wipeBand(CUT + HALF, CUT)).toBeNull();
    expect(wipeBand(CUT + HALF + 30, CUT)).toBeNull();
  });
  it("covers the whole frame on the cut frame, slanted edges included", () => {
    const band = wipeBand(CUT, CUT);
    expect(band).not.toBeNull();
    const { trail, lead } = band!;
    expect(trail).toBeLessThanOrEqual(0); // top edge
    expect(lead).toBeGreaterThanOrEqual(VIDEO.width);
    expect(trail - WIPE.slant).toBeLessThanOrEqual(0); // bottom edge
    expect(lead - WIPE.slant).toBeGreaterThanOrEqual(VIDEO.width);
  });
  it("sweeps left to right: both edges never move left", () => {
    let prev: { trail: number; lead: number } | null = null;
    for (let f = CUT - HALF + 1; f < CUT + HALF; f += 1) {
      const band = wipeBand(f, CUT)!;
      if (prev) {
        expect(band.lead).toBeGreaterThanOrEqual(prev.lead);
        expect(band.trail).toBeGreaterThanOrEqual(prev.trail);
      }
      prev = band;
    }
  });
  it("a lagging band starts and ends later by the lag", () => {
    expect(wipeBand(CUT - HALF + 1, CUT, WIPE.lag)).toBeNull();
    expect(wipeBand(CUT + HALF, CUT, WIPE.lag)).not.toBeNull();
    expect(wipeBand(CUT + HALF + WIPE.lag, CUT, WIPE.lag)).toBeNull();
  });
});

describe("bandPoints", () => {
  it("builds a slanted four-point polygon", () => {
    expect(bandPoints({ trail: 10, lead: 500 })).toBe(
      `10,0 500,0 ${500 - WIPE.slant},${VIDEO.height} ${10 - WIPE.slant},${VIDEO.height}`,
    );
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npx vitest run tests/unit/wipe.test.ts`
Expected: FAIL, cannot resolve `../../src/compose/wipe`.

- [ ] **Step 3: Implement `src/compose/wipe.ts`**

```ts
import { easeInOutCubic } from "../design/motion";
import { VIDEO } from "../design/tokens";

/** frames: total sweep length; slant: horizontal lean of the band edges in px; lag: the second band's delay. */
export const WIPE = { frames: 14, slant: 280, lag: 3 } as const;

export type Band = { trail: number; lead: number };

/** Frames where a scene starts after another scene: the cuts the wipes hide. */
export const cutFrames = (scenes: readonly { startFrame: number }[]): number[] =>
  scenes.slice(1).map((scene) => scene.startFrame);

/**
 * A band sweeps left to right across `[cutFrame - frames/2, cutFrame + frames/2)`, fully covering
 * the frame exactly on the cut. Edges are the top-edge x positions; the bottom edge leans left by
 * `slant`. Returns null when the band is off screen.
 */
export function wipeBand(frame: number, cutFrame: number, lagFrames = 0): Band | null {
  const t = (frame - (cutFrame - WIPE.frames / 2 + lagFrames)) / WIPE.frames;
  if (t <= 0 || t >= 1) return null;
  const travel = VIDEO.width + 2 * WIPE.slant;
  const at = (u: number) => -WIPE.slant + travel * easeInOutCubic(u);
  return { lead: at(2 * t), trail: at(2 * t - 1) };
}

export const bandPoints = ({ trail, lead }: Band): string =>
  `${trail},0 ${lead},0 ${lead - WIPE.slant},${VIDEO.height} ${trail - WIPE.slant},${VIDEO.height}`;
```

- [ ] **Step 4: Run to verify GREEN**

Run: `npx vitest run tests/unit/wipe.test.ts`
Expected: PASS 7/7.

- [ ] **Step 5: Add the overlay and wire it in**

`src/compose/Wipe.tsx`:

```tsx
import React from "react";
import { useCurrentFrame } from "remotion";
import { PALETTE, VIDEO } from "../design/tokens";
import { WIPE, bandPoints, wipeBand } from "./wipe";

/** Lagging highlight band under a neutral lead band: two overlapping flat blocks, no gradients. */
const LAYERS = [
  { lag: WIPE.lag, color: PALETTE.highlight },
  { lag: 0, color: PALETTE.neutral },
] as const;

export const Wipe: React.FC<{ cuts: readonly number[] }> = ({ cuts }) => {
  const frame = useCurrentFrame();
  return (
    <svg width={VIDEO.width} height={VIDEO.height} style={{ position: "absolute", inset: 0 }}>
      {cuts.flatMap((cut) =>
        LAYERS.map(({ lag, color }) => {
          const band = wipeBand(frame, cut, lag);
          return band ? <polygon key={`${cut}-${lag}`} points={bandPoints(band)} fill={color} /> : null;
        }),
      )}
    </svg>
  );
};
```

In `src/compose/Video.tsx` add `import { Wipe } from "./Wipe";` and `import { cutFrames } from "./wipe";`, and render `<Wipe cuts={cutFrames(scenes)} />` between `</Series>` and `<Captions chunks={captions} />` so captions stay above the wipe.

In `vitest.config.ts` add `"src/compose/wipe.ts"` to `coverage.include`.

- [ ] **Step 6: Run the suites and a visual check**

Run: `npm run typecheck && npx vitest run tests/unit`
Expected: clean, all PASS.

Run: `npx remotion still src/index.ts FinanceDemo out/wipe-cut.png --frame=<first cut frame>` where the cut frame is the first value from `cutFrames` for the finance demo (print it with the Step 14 style one-liner, `b.scenes[1].startFrame`), then again with `--frame=<cut - 3>`. Read both PNGs: at the cut the frame is solid neutral blue with no scene visible; at cut-3 a slanted band covers part of the scene with the yellow band trailing. Captions stay above the band.
Expected: both as described. If the cut frame shows scene content at the corners, the slant math is wrong; fix before continuing.

- [ ] **Step 7: Checkpoint (only if asked)**

`git add -A && git commit -m "feat: slanted two-band scene wipes at every cut"`

---

### Task 3: Label legibility

**Files:**
- Create: `src/charts/labels.ts`, `tests/unit/chartLabels.test.ts`
- Modify: `src/scenes/line-chart/LineChart.tsx`, `src/scenes/bar-race/BarRace.tsx`, `vitest.config.ts` (nothing new: `src/charts/**/*.ts` is already covered)

**Interfaces:**
- Consumes: `PlacedBadge`, `BADGE`, `CHART_BOX` from `src/charts/layout.ts`.
- Produces: `type Rect = { x; y; width; height }`; `overlaps(a, b): boolean` (touching edges do not overlap); `badgeRect(badge: PlacedBadge): Rect` (includes the 8px hard shadow and tilt margin); `tickLabelRect(y: number, text: string): Rect`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/chartLabels.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { badgeRect, overlaps, tickLabelRect } from "../../src/charts/labels";
import { BADGE, CHART_BOX, placeBadge } from "../../src/charts/layout";

describe("overlaps", () => {
  const a = { x: 0, y: 0, width: 10, height: 10 };
  it("is true for intersecting rects and false for disjoint ones", () => {
    expect(overlaps(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
    expect(overlaps(a, { x: 20, y: 0, width: 5, height: 5 })).toBe(false);
  });
  it("treats rects that only touch as not overlapping", () => {
    expect(overlaps(a, { x: 10, y: 0, width: 5, height: 5 })).toBe(false);
  });
});

describe("badgeRect", () => {
  it("contains the badge body and its hard shadow", () => {
    const badge = { x: 500, y: 400, width: 300, above: true };
    const r = badgeRect(badge);
    expect(r.x).toBeLessThan(500 - 150);
    expect(r.x + r.width).toBeGreaterThan(500 + 150 + 8);
    expect(r.y).toBeLessThan(400 - BADGE.heightPx / 2);
    expect(r.y + r.height).toBeGreaterThan(400 + BADGE.heightPx / 2 + 8);
  });
});

describe("tick labels vs badges", () => {
  it("a badge anchored near the left edge covers the tick label above its gridline", () => {
    const badge = placeBadge(CHART_BOX.left + 40, 900, "2008: 903");
    const tick = tickLabelRect(900 - 120, "1,000"); // a gridline just above the anchor
    expect(overlaps(badgeRect(badge), tick)).toBe(true);
  });
  it("a badge far from the label does not hide it", () => {
    const badge = placeBadge(800, 900, "2008: 903");
    expect(overlaps(badgeRect(badge), tickLabelRect(1100, "1,000"))).toBe(false);
  });
  it("the label box is anchored at the chart's left edge and scales with its text", () => {
    const short = tickLabelRect(800, "0");
    const long = tickLabelRect(800, "4,000");
    expect(short.x).toBe(CHART_BOX.left);
    expect(long.width).toBeGreaterThan(short.width);
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npx vitest run tests/unit/chartLabels.test.ts`
Expected: FAIL, cannot resolve `../../src/charts/labels`.

- [ ] **Step 3: Implement `src/charts/labels.ts`**

```ts
import { BADGE, CHART_BOX, type PlacedBadge } from "./layout";

export type Rect = { x: number; y: number; width: number; height: number };

const SHADOW_PX = 8;
const TILT_MARGIN_PX = 4;
export const TICK_FONT_PX = 38;
const TICK_CHAR_EM = 0.6;

export const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** The badge's body, its hard shadow and a margin for its tilt. */
export const badgeRect = (badge: PlacedBadge): Rect => ({
  x: badge.x - badge.width / 2 - TILT_MARGIN_PX,
  y: badge.y - BADGE.heightPx / 2 - TILT_MARGIN_PX,
  width: badge.width + SHADOW_PX + 2 * TILT_MARGIN_PX,
  height: BADGE.heightPx + SHADOW_PX + 2 * TILT_MARGIN_PX,
});

/** A y tick label sits at the chart's left edge, just above its gridline (baseline y - 12). */
export const tickLabelRect = (gridY: number, text: string): Rect => ({
  x: CHART_BOX.left,
  y: gridY - 12 - TICK_FONT_PX,
  width: text.length * TICK_CHAR_EM * TICK_FONT_PX,
  height: TICK_FONT_PX + 12,
});
```

- [ ] **Step 4: Run to verify GREEN**

Run: `npx vitest run tests/unit/chartLabels.test.ts`
Expected: PASS 6/6.

- [ ] **Step 5: Apply to the line chart**

In `src/scenes/line-chart/LineChart.tsx`:
- import `{ badgeRect, overlaps, tickLabelRect, TICK_FONT_PX } from "../../charts/labels"`.
- Build the callouts once, before the `return`, replacing the inline `calloutCues.map` computations:

```tsx
  const callouts = calloutCues.map((c, i) => {
    const ax = sx(c.x as number);
    const ay = sy(valueAtX(points, c.x as number));
    return { c, appear: plan.appear[i], ax, ay, badge: placeBadge(ax, ay, c.text as string) };
  });
  const shown = callouts.filter((k) => frame >= k.appear);
  const covered = shown.map((k) => badgeRect(k.badge));
```

- Split gridlines from labels. In the `yTicks.map` keep only the `<line>` inside the `<g opacity={fade}>` (keep `fade` computed per tick), and render the labels in a second layer placed after the `<g clipPath>` (area + line) and before the dot:

```tsx
        {yTicks.map((t, i) => {
          const y = sy(t);
          const text = fmt(t, yTickDecimals);
          if (covered.some((r) => overlaps(r, tickLabelRect(y, text)))) return null;
          const fade =
            Math.min(1, Math.max(0, (y - CHART_BOX.top) / 60)) * Math.min(1, popIn(frame, fps, staggerDelay(i, 3)));
          return (
            <text
              key={t} x={CHART_BOX.left} y={y - 12} opacity={fade}
              fontFamily={BODY_FONT} fontSize={TICK_FONT_PX} fill={PALETTE.ink} fillOpacity={0.55}
              stroke={PALETTE.ground} strokeWidth={10} paintOrder="stroke" strokeLinejoin="round"
            >
              {text}
            </text>
          );
        })}
```

- Render badges from `shown`:

```tsx
        {shown.map(({ c, appear, ax, ay, badge }) => (
          <CalloutBadge
            key={`${c.frame}-${c.x}`} badge={badge} text={c.text as string}
            anchorX={ax} anchorY={ay} scale={popIn(frame, fps, appear)} color={tone}
          />
        ))}
```

(The halo keeps the "0%" tick readable where the line starts; hidden-under-badge labels no longer collide.)

- [ ] **Step 6: Apply to the bar race**

In `src/scenes/bar-race/BarRace.tsx` replace the single `state.bars.map` with two passes inside the `<svg>`: first the bar groups (shadow rect + color rect only, same transform and opacity), then a second `state.bars.map` rendering the name and value `<text>` elements for each bar in an identical `<g key={`${bar.name}-label`} opacity={bar.opacity} transform=...>`, each text with `stroke={PALETTE.ground} strokeWidth={10} paintOrder="stroke" strokeLinejoin="round"`. Names and values then always sit above every bar, so a mid-swap crossing no longer cuts them.

- [ ] **Step 7: Run suites, regenerate goldens, review by eye**

Run: `npm run typecheck && npx vitest run tests/unit`
Expected: clean, PASS.

Run: `UPDATE_SNAPSHOTS=1 npx vitest run tests/render/finance.snapshot.test.ts --testTimeout=240000`
Expected: PASS (goldens rewritten). Then Read `tests/render/golden/finance-sp500-mid.png`, `finance-sp500-end.png`, `finance-race-mid.png`, `finance-cpi-end.png` and confirm: tick labels have a dark halo and stay readable where the line crosses; no tick label sits under a badge; bar names and values are on top of the bars during the swap; callout badges appear with the cursor on their anchor. Record what you saw in the ledger.

- [ ] **Step 8: Checkpoint (only if asked)**

`git add -A && git commit -m "fix: keep chart tick and bar labels legible under lines and badges"`

---

### Task 4: Cue rules and the `kinetic-text` scene

**Files:**
- Create: `src/schema/emphasis.ts`, `src/scenes/kinetic-text/{timing.ts,KineticText.tsx}`, `tests/unit/emphasis.test.ts`, `tests/unit/kineticText.test.ts`
- Modify: `src/schema/storyboard.ts`, `src/schema/validate.ts`, `src/design/tokens.ts`, `src/pipeline/buildVideo.ts`, `src/pipeline/assertSceneTiming.ts`, `src/compose/Video.tsx`, `tests/unit/schemaStrictness.test.ts` (message), `tests/unit/tokens.test.ts`, `vitest.config.ts`

**Interfaces:**
- Produces:
  - Schema: scene `type: "kinetic-text"`, `props: { lines: string[] (1-4 lines, each 1-14 chars), tone: Tone (default "highlight") }`; `KineticTextProps`. Cue rule: a `callout` or `emphasize` cue requires `text`.
  - `emphasisTarget(lines: readonly string[], text: string): { line: number; word: number } | null` (first on-screen word whose `normalizeWord` equals the cue text's; null if none or `text` normalizes to empty).
  - `KINETIC_LANE = { width, height, maxFont }` in `tokens.ts`; `kineticFontSize(lines): number`; `kineticRevealFrames(lineCount): number` (`KINETIC = { firstDelay: 4, lineGap: 8, settle: 18 }`).
  - Validation: `assertCuesSupported` allows up to 2 `emphasize` cues on `kinetic-text` only, each naming a single on-screen word; `assertTextScenes(sb)` rejects digits in kinetic lines; `MAX_CALLOUTS["kinetic-text"] = 0`.
  - `assertSceneTiming` rejects a kinetic scene shorter than `kineticRevealFrames(lines) + EXIT_FRAMES`.

- [ ] **Step 1: Write the failing emphasis tests**

`tests/unit/emphasis.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { emphasisTarget } from "../../src/schema/emphasis";

const lines = ["Debt is", "not the", "enemy, Risk is"];

describe("emphasisTarget", () => {
  it("finds the first matching word with its line and index", () => {
    expect(emphasisTarget(lines, "not")).toEqual({ line: 1, word: 0 });
    expect(emphasisTarget(lines, "risk")).toEqual({ line: 2, word: 2 });
  });
  it("ignores case and punctuation on either side", () => {
    expect(emphasisTarget(lines, "ENEMY")).toEqual({ line: 2, word: 0 });
    expect(emphasisTarget(["Hello, world!"], "world.")).toEqual({ line: 0, word: 1 });
  });
  it("returns the first occurrence when a word repeats", () => {
    expect(emphasisTarget(["is it", "it is"], "it")).toEqual({ line: 0, word: 1 });
  });
  it("returns null for a word that is not on screen or that normalizes to nothing", () => {
    expect(emphasisTarget(lines, "banana")).toBeNull();
    expect(emphasisTarget(lines, "—")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npx vitest run tests/unit/emphasis.test.ts`
Expected: FAIL, cannot resolve `../../src/schema/emphasis`.

- [ ] **Step 3: Implement `src/schema/emphasis.ts`**

```ts
import { normalizeWord } from "./timing";

export type EmphasisTarget = { line: number; word: number };

/** The on-screen word an `emphasize` cue points at: the first word of the lines that matches `text`. */
export function emphasisTarget(lines: readonly string[], text: string): EmphasisTarget | null {
  const want = normalizeWord(text);
  if (want === "") return null;
  for (let line = 0; line < lines.length; line += 1) {
    const word = lines[line].split(/\s+/).filter(Boolean).findIndex((w) => normalizeWord(w) === want);
    if (word >= 0) return { line, word };
  }
  return null;
}
```

Run: `npx vitest run tests/unit/emphasis.test.ts` → Expected: PASS 4/4.

- [ ] **Step 4: Write the failing schema, validation and timing tests**

`tests/unit/kineticText.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildVideo } from "../../src/pipeline/buildVideo";
import { parseStoryboard, StoryboardError } from "../../src/schema/storyboard";
import { assertCuesSupported, assertTextScenes } from "../../src/schema/validate";
import { KINETIC, kineticFontSize, kineticRevealFrames } from "../../src/scenes/kinetic-text/timing";
import { synthWords } from "../../src/voice/synthWords";

const kinetic = (props: Record<string, unknown> = {}, cues: unknown[] = []) => ({
  id: "k", type: "kinetic-text", narration: "Debt is not the enemy, risk is the real enemy.", cues,
  props: { lines: ["Debt is", "not the", "enemy"], ...props },
});
const board = (...scenes: unknown[]) =>
  parseStoryboard({
    schemaVersion: 1,
    meta: { title: "t", theme: "bold-flat", voice: "v" },
    audio: { music: null },
    scenes,
  });
const emphasize = (text: string, atWord = "enemy") => ({ atWord, do: "emphasize", text });
const words = (sb: { scenes: { id: string; narration: string }[] }) =>
  Object.fromEntries(sb.scenes.map((s) => [s.id, synthWords(s.narration)]));
const noFacts = { facts: [{ id: "f", claim: "c", value: 1, source: { name: "n", url: "https://example.com/" } }] };

describe("kinetic-text schema", () => {
  it("accepts 1 to 4 short lines and defaults the tone", () => {
    expect(board(kinetic()).scenes[0]).toMatchObject({ props: { tone: "highlight" } });
  });
  it("rejects zero lines, five lines and a line over 14 characters", () => {
    expect(() => board(kinetic({ lines: [] }))).toThrow(StoryboardError);
    expect(() => board(kinetic({ lines: ["a", "b", "c", "d", "e"] }))).toThrow(StoryboardError);
    expect(() => board(kinetic({ lines: ["fifteen letters!"] }))).toThrow(StoryboardError);
  });
  it("requires text on an emphasize cue", () => {
    expect(() => board(kinetic({}, [{ atWord: "enemy", do: "emphasize" }]))).toThrow(/requires text/);
  });
});

describe("kinetic-text cue rules", () => {
  it("accepts up to two emphasize cues that name a word on screen", () => {
    expect(() => assertCuesSupported(board(kinetic({}, [emphasize("debt", "debt"), emphasize("enemy")])))).not.toThrow();
  });
  it("rejects an emphasize cue for a word that is not on screen", () => {
    expect(() => assertCuesSupported(board(kinetic({}, [emphasize("banana")])))).toThrow(/"k".*"banana".*not a word/);
  });
  it("rejects an emphasize cue naming several words", () => {
    expect(() => assertCuesSupported(board(kinetic({}, [emphasize("not the")])))).toThrow(/single word/);
  });
  it("rejects a third emphasize cue and any callout cue", () => {
    const three = [emphasize("debt", "debt"), emphasize("not", "not"), emphasize("enemy")];
    expect(() => assertCuesSupported(board(kinetic({}, three)))).toThrow(/at most 2/);
    expect(() => assertCuesSupported(board(kinetic({}, [{ atWord: "enemy", do: "callout", text: "x" }])))).toThrow(/at most 0 callout/);
  });
  it("still rejects emphasize cues on scenes that cannot render them", () => {
    const big = {
      id: "n", type: "big-number", narration: "Num.", props: { value: 1, label: "l", factId: "f" },
      cues: [{ atWord: "num", do: "emphasize", text: "x" }],
    };
    expect(() => assertCuesSupported(board(big))).toThrow(/cannot render "emphasize"/);
  });
});

describe("assertTextScenes", () => {
  it("rejects digits in kinetic lines (numbers must come from facts via big-number)", () => {
    expect(() => assertTextScenes(board(kinetic({ lines: ["Up 40%"] })))).toThrow(/"k".*digit/);
  });
  it("accepts spelled-out numbers", () => {
    expect(() => assertTextScenes(board(kinetic({ lines: ["Forty percent"] })))).not.toThrow();
  });
});

describe("kinetic layout and timing", () => {
  it("fits the widest line to the lane width and never exceeds the max font", () => {
    expect(kineticFontSize(["Hi"])).toBe(190);
    const wide = kineticFontSize(["abcdefghijklmn"]);
    expect(wide).toBeGreaterThanOrEqual(90);
    expect(wide).toBeLessThan(190);
  });
  it("keeps four lines inside the lane height", () => {
    expect(kineticFontSize(["a", "b", "c", "d"]) * 4 * 1.08).toBeLessThanOrEqual(1066);
  });
  it("reveal time grows with the number of lines", () => {
    expect(kineticRevealFrames(1)).toBe(KINETIC.firstDelay + KINETIC.settle);
    expect(kineticRevealFrames(4)).toBe(KINETIC.firstDelay + 3 * KINETIC.lineGap + KINETIC.settle);
  });
  it("buildVideo rejects a scene shorter than its reveal and accepts a normal one", () => {
    const short = { ...kinetic({ lines: ["a", "b", "c", "d"] }), narration: "Go." };
    expect(() => buildVideo(board(short), noFacts, words, 30)).toThrow(/"k".*too short/);
    expect(() => buildVideo(board(kinetic()), noFacts, words, 30)).not.toThrow();
  });
});
```

Also update `tests/unit/schemaStrictness.test.ts` line 43 test name/regex only if it asserts the exact message "a callout cue requires text"; it uses `/text/`, so no change.

- [ ] **Step 5: Run to verify RED**

Run: `npx vitest run tests/unit/kineticText.test.ts`
Expected: FAIL (unknown scene type, missing modules).

- [ ] **Step 6: Implement the schema**

In `src/schema/storyboard.ts` replace the cue refine so both kinds need text:

```ts
export const CueSchema = z.strictObject({
  atWord: z.string().min(1),
  occurrence: z.number().int().min(1).default(1),
  do: z.enum(["callout", "emphasize"]),
  text: z.string().min(1).max(24).optional(),
  x: z.number().optional(),
}).refine((cue) => cue.text !== undefined, {
  message: "a callout or emphasize cue requires text",
  path: ["text"],
});
```

Add the scene schema before `SceneSchema` and include it in the union; export the type:

```ts
const KineticTextSceneSchema = z.strictObject({
  ...sceneBase,
  type: z.literal("kinetic-text"),
  props: z.strictObject({
    lines: z.array(z.string().min(1).max(14)).min(1).max(4),
    tone: z.enum(TONES).default("highlight"),
  }),
});
// SceneSchema = z.discriminatedUnion("type", [Title..., BigNumber..., LineChart..., BarRace..., KineticTextSceneSchema])
export type KineticTextProps = Extract<Scene, { type: "kinetic-text" }>["props"];
```

- [ ] **Step 7: Implement tokens, layout, timing**

`src/design/tokens.ts` append:

```ts
/** Space for stacked kinetic lines: safe top to the caption lane, minus breathing room. */
export const KINETIC_LANE = {
  width: VIDEO.width - 2 * SAFE.side,
  height: CAPTION_LANE.top - SAFE.top - 120,
  maxFont: 190,
} as const;
```

`src/scenes/kinetic-text/timing.ts`:

```ts
import { fitFontSize } from "../../design/layout";
import { KINETIC_LANE } from "../../design/tokens";

export const KINETIC = { firstDelay: 4, lineGap: 8, settle: 18, lineHeight: 1.08 } as const;

/** Frames until the last line has settled. */
export const kineticRevealFrames = (lineCount: number): number =>
  KINETIC.firstDelay + (lineCount - 1) * KINETIC.lineGap + KINETIC.settle;

/** One font size for all lines: the widest line fills the lane width, all lines fit its height. */
export function kineticFontSize(lines: readonly string[]): number {
  const widest = lines.reduce((a, l) => (l.length > a.length ? l : a), "");
  const byWidth = fitFontSize(widest, KINETIC_LANE.width, KINETIC_LANE.maxFont);
  const byHeight = Math.floor(KINETIC_LANE.height / (lines.length * KINETIC.lineHeight));
  return Math.min(byWidth, byHeight);
}
```

(Layout and timing share one module, `timing.ts`; the test imports `kineticFontSize`, `kineticRevealFrames` and `KINETIC` from it.)

Add a `tokens.test.ts` assertion that `KINETIC_LANE.height + SAFE.top + 120 === CAPTION_LANE.top` and `KINETIC_LANE.width === VIDEO.width - 2 * SAFE.side` (RED then GREEN with the token).

- [ ] **Step 8: Implement validation**

In `src/schema/validate.ts`:
- add `import { emphasisTarget } from "./emphasis";`.
- `MAX_CALLOUTS` gains `"kinetic-text": 0` (and later tasks add `compare` and `quote`; add them with their tasks).
- In `assertCuesSupported` replace the `emphasize` block with:

```ts
    const emphasize = scene.cues.filter((cue) => cue.do === "emphasize");
    if (scene.type !== "kinetic-text" && emphasize.length > 0) {
      throw new StoryboardError(`Scene "${scene.id}" (${scene.type}) cannot render "emphasize" cues`);
    }
    if (scene.type === "kinetic-text") assertEmphasis(scene, emphasize);
```

and add:

```ts
const MAX_EMPHASIS = 2;

function assertEmphasis(scene: Extract<Scene, { type: "kinetic-text" }>, cues: Scene["cues"]): void {
  if (cues.length > MAX_EMPHASIS) {
    throw new StoryboardError(`Scene "${scene.id}" (kinetic-text) supports at most ${MAX_EMPHASIS} emphasize cues; got ${cues.length}`);
  }
  for (const cue of cues) {
    const text = cue.text as string;
    if (/\s/.test(text.trim())) {
      throw new StoryboardError(`Scene "${scene.id}": emphasize cue "${text}" must name a single word`);
    }
    if (emphasisTarget(scene.props.lines, text) === null) {
      throw new StoryboardError(`Scene "${scene.id}": emphasize cue "${text}" is not a word on screen`);
    }
  }
}

/** Content rules for text scenes. Numbers must reach the screen through facts, so lines carry none. */
export function assertTextScenes(sb: Storyboard): void {
  for (const scene of sb.scenes) {
    if (scene.type === "kinetic-text" && scene.props.lines.some((line) => /\d/.test(line))) {
      throw new StoryboardError(`Scene "${scene.id}" (kinetic-text) shows a digit; spell it out or use a big-number scene tied to a fact`);
    }
  }
}
```

(The existing title special case in `assertCuesSupported` stays; Task 6 generalizes it.)

In `src/pipeline/buildVideo.ts` call `assertTextScenes(storyboard);` after `assertHeadlinesFit`. In `assertSceneTiming.ts` add:

```ts
    if (scene.type === "kinetic-text" && kineticRevealFrames(scene.props.lines.length) > limit) {
      throw new StoryboardError(
        `Scene "${scene.id}" is too short (${composed.durationFrames} frames): the kinetic text cannot finish revealing before the scene exits; lengthen the narration`,
      );
    }
```
with `import { kineticRevealFrames } from "../scenes/kinetic-text/timing";`.

- [ ] **Step 9: Run to verify GREEN**

Run: `npx vitest run tests/unit/kineticText.test.ts tests/unit/emphasis.test.ts tests/unit/tokens.test.ts`
Expected: PASS. Then `npm run typecheck`: it fails only in `Video.tsx` (`SceneSwitch` unhandled `kinetic-text`) until Step 10.

- [ ] **Step 10: Implement the component and wire it**

`src/scenes/kinetic-text/KineticText.tsx`:

```tsx
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { EXIT_FRAMES } from "../../charts/timing";
import { DISPLAY_FONT } from "../../design/fonts";
import { popIn, sustainDrift } from "../../design/motion";
import { CAPTION_LANE, PALETTE, SAFE, VIDEO } from "../../design/tokens";
import { emphasisTarget } from "../../schema/emphasis";
import type { KineticTextProps } from "../../schema/storyboard";
import type { SceneRenderProps } from "../types";
import { KINETIC, kineticFontSize } from "./timing";

/** Stacked display lines slide up out of masks; an emphasize cue wipes a tone block behind its word. */
export const KineticText: React.FC<SceneRenderProps<KineticTextProps>> = ({ props, cues, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tone = PALETTE[props.tone];
  const size = kineticFontSize(props.lines);
  const exit = interpolate(frame, [durationFrames - EXIT_FRAMES, durationFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const emphasis = cues
    .filter((c) => c.do === "emphasize" && c.text !== undefined)
    .flatMap((c) => {
      const target = emphasisTarget(props.lines, c.text as string);
      return target ? [{ cue: c, target }] : [];
    });

  return (
    <AbsoluteFill
      style={{
        background: PALETTE.ground, opacity: exit, justifyContent: "center",
        padding: `${SAFE.top}px ${SAFE.side}px ${VIDEO.height - CAPTION_LANE.top}px`,
      }}
    >
      <div style={{ transform: `translateY(${sustainDrift(frame, 6, 90)}px)` }}>
        {props.lines.map((line, li) => {
          const rise = Math.min(1, popIn(frame, fps, KINETIC.firstDelay + li * KINETIC.lineGap));
          return (
            <div key={`${line}-${li}`} style={{ overflow: "hidden", height: size * KINETIC.lineHeight }}>
              <div
                style={{
                  display: "flex", whiteSpace: "nowrap", gap: `0 ${size * 0.18}px`,
                  transform: `translateY(${(1 - rise) * 105}%)`,
                }}
              >
                {line.split(/\s+/).filter(Boolean).map((word, wi) => {
                  const hit = emphasis.find((e) => e.target.line === li && e.target.word === wi);
                  const e = hit ? Math.min(1, popIn(frame, fps, hit.cue.frame)) : 0;
                  return (
                    <span
                      key={`${word}-${wi}`}
                      style={{
                        fontFamily: DISPLAY_FONT, fontSize: size, lineHeight: KINETIC.lineHeight,
                        color: e > 0.5 ? PALETTE.ground : PALETTE.ink,
                        backgroundImage: `linear-gradient(${tone}, ${tone})`,
                        backgroundRepeat: "no-repeat",
                        backgroundSize: `${e * 100}% 100%`,
                        padding: `0 ${size * 0.06}px`,
                      }}
                    >
                      {word}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
```

In `src/compose/Video.tsx` add the import and the case:

```tsx
    case "kinetic-text":
      return <KineticText props={scene.props} cues={cues} durationFrames={durationFrames} />;
```

Add `"src/scenes/**/timing.ts"` to `coverage.include` in `vitest.config.ts`.

- [ ] **Step 11: Run all unit tests and typecheck**

Run: `npm run typecheck && npx vitest run tests/unit`
Expected: clean, all PASS.

- [ ] **Step 12: Checkpoint (only if asked)**

`git add -A && git commit -m "feat: kinetic-text scene with word-synced emphasis"`

---

### Task 5: The `compare` scene

**Files:**
- Create: `src/scenes/compare/{Compare.tsx,layout.ts}`, `tests/unit/compare.test.ts`
- Modify: `src/schema/storyboard.ts`, `src/schema/validate.ts`, `src/compose/Video.tsx`, `vitest.config.ts`, `tests/unit/validate.test.ts` (only if it imports the changed internals)

**Interfaces:**
- Produces: scene `type: "compare"`, `props: { title (<=32), left: Side, right: Side, prefix, suffix, decimals }` with `Side = { label (1-14 chars), value (>= 0), factId }` and at least one value > 0; `CompareProps`; `barHeights(left, right): [number, number]` (taller bar is `COMPARE.maxBar`, other proportional); `COMPARE` layout constants. `MAX_CALLOUTS.compare = 1`.
- Refactors: `assertNumberFact(sceneId, { value, decimals }, fact)` shared by `big-number` and each `compare` side; `assertFactsTraceable` becomes an exhaustive `switch` over scene type (`title` and `kinetic-text` have nothing to trace).

- [ ] **Step 1: Write the failing tests**

`tests/unit/compare.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseFacts } from "../../src/schema/facts";
import { parseStoryboard, StoryboardError } from "../../src/schema/storyboard";
import { assertCuesSupported, assertFactsTraceable } from "../../src/schema/validate";
import { COMPARE, barHeights } from "../../src/scenes/compare/layout";

const side = (label: string, value: number, factId: string) => ({ label, value, factId });
const compare = (props: Record<string, unknown> = {}, cues: unknown[] = []) => ({
  id: "cmp", type: "compare", narration: "Rome versus Han China.", cues,
  props: { title: "Population, millions", left: side("Rome", 50, "f-a"), right: side("Han China", 57.7, "f-b"), decimals: 1, ...props },
});
const board = (...scenes: unknown[]) =>
  parseStoryboard({
    schemaVersion: 1,
    meta: { title: "t", theme: "bold-flat", voice: "v" },
    audio: { music: null },
    scenes,
  });
const fact = (id: string, value?: number) => ({ id, claim: "c", ...(value === undefined ? {} : { value }), source: { name: "n", url: "https://example.com/" } });
const facts = (a?: number, b?: number) => parseFacts({ facts: [fact("f-a", a), fact("f-b", b)] });

describe("compare schema", () => {
  it("accepts two labelled non-negative values", () => {
    expect(board(compare()).scenes[0]).toMatchObject({ props: { prefix: "", suffix: "" } });
  });
  it("rejects a negative value, a long label and two zero values", () => {
    expect(() => board(compare({ left: side("Rome", -1, "f-a") }))).toThrow(StoryboardError);
    expect(() => board(compare({ left: side("A label that is far too long", 1, "f-a") }))).toThrow(StoryboardError);
    expect(() => board(compare({ left: side("A", 0, "f-a"), right: side("B", 0, "f-b") }))).toThrow(/greater than zero|at least one/);
  });
});

describe("compare fact tracing", () => {
  it("passes when both sides equal their facts", () => {
    expect(() => assertFactsTraceable(board(compare()), facts(50, 57.7))).not.toThrow();
  });
  it("rejects a side that differs from its fact", () => {
    expect(() => assertFactsTraceable(board(compare()), facts(50, 58))).toThrow(/"cmp" shows 57.7 but fact "f-b" says 58/);
  });
  it("rejects a side whose fact has no value or does not exist", () => {
    expect(() => assertFactsTraceable(board(compare()), facts(undefined, 57.7))).toThrow(/no value/);
    expect(() => assertFactsTraceable(board(compare({ right: side("Han", 57.7, "zzz") })), facts(50, 57.7))).toThrow(/unknown fact "zzz"/);
  });
  it("rejects a value that would display rounded", () => {
    expect(() => assertFactsTraceable(board(compare({ decimals: 0 })), facts(50, 57.7))).toThrow(/would display/);
  });
});

describe("compare cues", () => {
  it("allows one callout and rejects two", () => {
    const one = [{ atWord: "rome", do: "callout", text: "Bigger" }];
    expect(() => assertCuesSupported(board(compare({}, one)))).not.toThrow();
    expect(() => assertCuesSupported(board(compare({}, [...one, ...one])))).toThrow(/at most 1 callout/);
  });
  it("rejects an x anchor", () => {
    expect(() => assertCuesSupported(board(compare({}, [{ atWord: "rome", do: "callout", text: "x", x: 3 }])))).toThrow(/does not use cue x/);
  });
});

describe("barHeights", () => {
  it("scales the taller side to the max and the other proportionally", () => {
    const [l, r] = barHeights(50, 100);
    expect(r).toBe(COMPARE.maxBar);
    expect(l).toBeCloseTo(COMPARE.maxBar / 2, 9);
  });
  it("handles equal values and a zero side", () => {
    expect(barHeights(7, 7)).toEqual([COMPARE.maxBar, COMPARE.maxBar]);
    expect(barHeights(0, 5)).toEqual([0, COMPARE.maxBar]);
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npx vitest run tests/unit/compare.test.ts`
Expected: FAIL (unknown scene type, missing module).

- [ ] **Step 3: Implement the schema**

In `src/schema/storyboard.ts` add:

```ts
const CompareSideSchema = z.strictObject({
  label: z.string().min(1).max(14),
  value: z.number().min(0),
  factId: z.string().min(1),
});

const CompareSceneSchema = z.strictObject({
  ...sceneBase,
  type: z.literal("compare"),
  props: z
    .strictObject({
      title: z.string().min(1).max(32),
      left: CompareSideSchema,
      right: CompareSideSchema,
      prefix: z.string().max(4).default(""),
      suffix: z.string().max(6).default(""),
      decimals: z.number().int().min(0).max(4).default(0),
    })
    .superRefine((props, ctx) => {
      if (props.left.value <= 0 && props.right.value <= 0) {
        ctx.addIssue({ code: "custom", path: ["left", "value"], message: "at least one side must be greater than zero" });
      }
    }),
});
// add CompareSceneSchema to the discriminated union
export type CompareProps = Extract<Scene, { type: "compare" }>["props"];
```

- [ ] **Step 4: Implement validation**

In `src/schema/validate.ts` rewrite the tracing so every branch goes through small helpers (keep the existing messages byte for byte):

```ts
function assertNumberFact(sceneId: string, shown: { value: number; decimals: number }, fact: Fact): void {
  if (fact.value === undefined) {
    throw new StoryboardError(`Scene "${sceneId}": fact "${fact.id}" has no value to verify the displayed number against`);
  }
  if (fact.value !== shown.value) {
    throw new StoryboardError(`Scene "${sceneId}" shows ${shown.value} but fact "${fact.id}" says ${fact.value}`);
  }
  const displayed = Number(formatNumber(shown.value, shown.decimals).replace(/,/g, ""));
  if (displayed !== shown.value) {
    throw new StoryboardError(
      `Scene "${sceneId}" would display ${displayed} for value ${shown.value} at ${shown.decimals} decimals; use more decimals or a rounded fact`,
    );
  }
}

export function assertFactsTraceable(sb: Storyboard, facts: Facts): void {
  const byId = new Map(facts.facts.map((fact) => [fact.id, fact]));
  const lookup = (sceneId: string, factId: string): Fact => {
    const fact = byId.get(factId);
    if (!fact) throw new StoryboardError(`Scene "${sceneId}" references unknown fact "${factId}"`);
    return fact;
  };
  for (const scene of sb.scenes) {
    switch (scene.type) {
      case "title":
      case "kinetic-text":
        break;
      case "big-number":
        assertNumberFact(scene.id, scene.props, lookup(scene.id, scene.props.factId));
        break;
      case "compare":
        for (const side of [scene.props.left, scene.props.right]) {
          assertNumberFact(scene.id, { value: side.value, decimals: scene.props.decimals }, lookup(scene.id, side.factId));
        }
        break;
      case "line-chart":
        assertLineChartFact(scene, lookup(scene.id, scene.props.factId));
        break;
      case "bar-race":
        assertBarRaceFact(scene, lookup(scene.id, scene.props.factId));
        break;
      default: {
        const unreachable: never = scene;
        throw new Error(`Unhandled scene type: ${JSON.stringify(unreachable)}`);
      }
    }
  }
}
```

(The `NumberScene` type alias becomes unused; delete it. Task 6 adds the `quote` case.) Add `compare: 1` to `MAX_CALLOUTS`.

- [ ] **Step 5: Implement layout and component**

`src/scenes/compare/layout.ts`:

```ts
export const COMPARE = {
  baseline: 1130,
  maxBar: 420,
  barWidth: 300,
  centers: [300, 780],
  labelY: 1196,
  growStart: 12,
  growFrames: 40,
  sideDelay: 6,
} as const;

/** Bar heights in px: the taller side is `maxBar`, the other proportional. A zero side has no bar. */
export function barHeights(left: number, right: number): [number, number] {
  const max = Math.max(left, right);
  return [(left / max) * COMPARE.maxBar, (right / max) * COMPARE.maxBar];
}
```

`src/scenes/compare/Compare.tsx` (a single SVG; left bar `PALETTE.neutral`, right bar `PALETTE.highlight`):

```tsx
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { CalloutBadge } from "../../charts/CalloutBadge";
import { CHART_BOX, placeBadge } from "../../charts/layout";
import { EXIT_FRAMES } from "../../charts/timing";
import { BODY_FONT, DISPLAY_FONT } from "../../design/fonts";
import { fitFontSize, formatNumber } from "../../design/layout";
import { countUp, dataProgress, popIn } from "../../design/motion";
import { PALETTE, SAFE, VIDEO } from "../../design/tokens";
import type { CompareProps } from "../../schema/storyboard";
import type { SceneRenderProps } from "../types";
import { COMPARE, barHeights } from "./layout";

const COLUMN_ROOM = 440;
const SIDE_COLORS = [PALETTE.neutral, PALETTE.highlight] as const;

export const Compare: React.FC<SceneRenderProps<CompareProps>> = ({ props, cues, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sides = [props.left, props.right] as const;
  const heights = barHeights(props.left.value, props.right.value);
  const fmt = (v: number) => `${props.prefix}${formatNumber(v, props.decimals)}${props.suffix}`;
  const valueFont = fitFontSize(
    fmt(Math.max(props.left.value, props.right.value)), COLUMN_ROOM, 130,
  );
  const exit = interpolate(frame, [durationFrames - EXIT_FRAMES, durationFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleIn = Math.min(1, popIn(frame, fps, 0));
  const callout = cues.find((c) => c.do === "callout" && c.text !== undefined);
  const leader = props.left.value >= props.right.value ? 0 : 1;
  const grows = sides.map((_, i) => dataProgress(frame, COMPARE.growStart + i * COMPARE.sideDelay, COMPARE.growFrames));

  const calloutNode = (() => {
    if (!callout || frame < callout.frame) return null;
    const ax = COMPARE.centers[leader];
    const ay = COMPARE.baseline - heights[leader] * grows[leader] - valueFont - 40;
    return (
      <CalloutBadge
        badge={placeBadge(ax, ay, callout.text as string, SAFE.top + 160)} text={callout.text as string}
        anchorX={ax} anchorY={ay} scale={popIn(frame, fps, callout.frame)} color={SIDE_COLORS[leader]}
      />
    );
  })();

  return (
    <AbsoluteFill style={{ background: PALETTE.ground, opacity: exit }}>
      <svg width={VIDEO.width} height={VIDEO.height} style={{ position: "absolute", inset: 0 }}>
        <text
          x={SAFE.side} y={SAFE.top + 52} fontFamily={BODY_FONT} fontSize={52} fill={PALETTE.ink}
          fillOpacity={0.85 * titleIn}
        >
          {props.title}
        </text>
        <line
          x1={CHART_BOX.left} x2={CHART_BOX.right} y1={COMPARE.baseline} y2={COMPARE.baseline}
          stroke={PALETTE.ink} strokeOpacity={0.35} strokeWidth={4}
        />
        {sides.map((side, i) => {
          const cx = COMPARE.centers[i];
          const h = heights[i] * grows[i];
          return (
            <g key={side.label}>
              <rect x={cx - COMPARE.barWidth / 2 + 10} y={COMPARE.baseline - h + 10} width={COMPARE.barWidth} height={h} fill={PALETTE.ink} fillOpacity={0.16} />
              <rect x={cx - COMPARE.barWidth / 2} y={COMPARE.baseline - h} width={COMPARE.barWidth} height={h} fill={SIDE_COLORS[i]} />
              <text
                x={cx} y={COMPARE.baseline - h - 28} textAnchor="middle"
                fontFamily={DISPLAY_FONT} fontSize={valueFont} fill={PALETTE.ink}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {fmt(countUp(side.value, grows[i], props.decimals))}
              </text>
              <text x={cx} y={COMPARE.labelY} textAnchor="middle" fontFamily={BODY_FONT} fontSize={44} fill={PALETTE.ink}>
                {side.label}
              </text>
            </g>
          );
        })}
        <g transform={`translate(540 ${COMPARE.baseline - 90}) scale(${Math.min(1, popIn(frame, fps, 24))})`}>
          <circle r={54} fill={PALETTE.ink} />
          <text textAnchor="middle" y={16} fontFamily={DISPLAY_FONT} fontSize={48} fill={PALETTE.ground}>VS</text>
        </g>
        {calloutNode}
      </svg>
    </AbsoluteFill>
  );
};
```

Wire `case "compare":` into `Video.tsx`. Add `"src/scenes/**/layout.ts"` to `coverage.include`.

- [ ] **Step 6: Run to verify GREEN**

Run: `npm run typecheck && npx vitest run tests/unit`
Expected: clean, all PASS (existing `big-number` tracing tests still pass: messages unchanged).

- [ ] **Step 7: Checkpoint (only if asked)**

`git add -A && git commit -m "feat: compare scene with per-side fact tracing"`

---

### Task 6: The `quote` scene

**Files:**
- Create: `src/scenes/quote/{Quote.tsx,timing.ts}`, `tests/unit/quote.test.ts`
- Modify: `src/schema/storyboard.ts`, `src/schema/validate.ts`, `src/design/tokens.ts`, `src/pipeline/buildVideo.ts`, `src/pipeline/assertSceneTiming.ts`, `src/compose/Video.tsx`, `tests/unit/tokens.test.ts`

**Interfaces:**
- Produces: scene `type: "quote"`, `props: { quote (<=140), attribution (<=40), factId }`, no cues; `QuoteProps`; `QUOTE_LANE = { width, height, maxFont }` in tokens; `QUOTE = { start: 6, wordGap: 3, attrLead: 10, settle: 18 }` and `quoteRevealFrames(wordCount): number` in `src/scenes/quote/timing.ts`; `assertQuotesFit(sb)` (in `assertTextScenes`); fact rule: the quote, after normalizing curly quotes and whitespace, must appear in the fact's `claim`. A `NO_CUES` set (`title`, `quote`) replaces the title-only check.

- [ ] **Step 1: Write the failing tests**

`tests/unit/quote.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildVideo } from "../../src/pipeline/buildVideo";
import { parseFacts } from "../../src/schema/facts";
import { parseStoryboard, StoryboardError } from "../../src/schema/storyboard";
import { assertCuesSupported, assertFactsTraceable, assertTextScenes } from "../../src/schema/validate";
import { QUOTE, quoteRevealFrames } from "../../src/scenes/quote/timing";
import { synthWords } from "../../src/voice/synthWords";

const QUOTE_TEXT = "I came, I saw, I conquered.";
const quote = (props: Record<string, unknown> = {}, cues: unknown[] = []) => ({
  id: "q", type: "quote",
  narration: "After the battle Caesar sent a three word report to Rome saying that he came, he saw, and he conquered.",
  cues,
  props: { quote: QUOTE_TEXT, attribution: "Julius Caesar", factId: "f-q", ...props },
});
const board = (...scenes: unknown[]) =>
  parseStoryboard({
    schemaVersion: 1,
    meta: { title: "t", theme: "bold-flat", voice: "v" },
    audio: { music: null },
    scenes,
  });
const facts = (claim: string) =>
  parseFacts({ facts: [{ id: "f-q", claim, source: { name: "Plutarch", url: "https://example.com/" } }] });
const words = (sb: { scenes: { id: string; narration: string }[] }) =>
  Object.fromEntries(sb.scenes.map((s) => [s.id, synthWords(s.narration)]));

describe("quote schema", () => {
  it("accepts a quote with an attribution and a fact", () => {
    expect(board(quote()).scenes[0]).toMatchObject({ type: "quote" });
  });
  it("rejects an empty or over-long quote and a missing fact", () => {
    expect(() => board(quote({ quote: "" }))).toThrow(StoryboardError);
    expect(() => board(quote({ quote: "x".repeat(141) }))).toThrow(StoryboardError);
    expect(() => board(quote({ factId: undefined }))).toThrow(StoryboardError);
  });
});

describe("quote fact tracing", () => {
  it("passes when the claim contains the quote verbatim", () => {
    const claim = `Caesar's report after Zela: "${QUOTE_TEXT}" (Plutarch, Life of Caesar)`;
    expect(() => assertFactsTraceable(board(quote()), facts(claim))).not.toThrow();
  });
  it("matches across curly vs straight quotes and extra whitespace", () => {
    const claim = "He wrote:  “I came,   I saw, I conquered.”";
    expect(() => assertFactsTraceable(board(quote()), facts(claim))).not.toThrow();
    const curly = quote({ quote: "It’s “fine”." });
    expect(() => assertFactsTraceable(board(curly), facts('He said: It\'s "fine".'))).not.toThrow();
  });
  it("rejects a quote that is not in the claim, and an unknown fact", () => {
    expect(() => assertFactsTraceable(board(quote()), facts("Caesar won a battle."))).toThrow(/"q".*quote.*fact "f-q"/);
    expect(() => assertFactsTraceable(board(quote({ factId: "zzz" })), facts(QUOTE_TEXT))).toThrow(/unknown fact "zzz"/);
  });
});

describe("quote cues and fit", () => {
  it("does not support cues", () => {
    expect(() => assertCuesSupported(board(quote({}, [{ atWord: "came", do: "callout", text: "x" }])))).toThrow(/"q" \(quote\) does not support cues/);
  });
  it("rejects a quote that cannot fit the lane at the minimum font", () => {
    const longWord = quote({ quote: "Supercalifragilisticexpialidocious-Supercalifragilisticexpialidocious" });
    expect(() => assertTextScenes(board(longWord))).toThrow(/"q".*quote does not fit/);
    expect(() => assertTextScenes(board(quote()))).not.toThrow();
  });
});

describe("quote reveal timing", () => {
  it("grows with the number of words", () => {
    expect(quoteRevealFrames(1)).toBe(QUOTE.start + QUOTE.attrLead + QUOTE.settle);
    expect(quoteRevealFrames(11)).toBe(QUOTE.start + 10 * QUOTE.wordGap + QUOTE.attrLead + QUOTE.settle);
  });
  it("buildVideo rejects a quote read faster than it can be revealed", () => {
    const fast = { ...quote({ quote: "one two three four five six seven eight nine ten eleven twelve" }), narration: "Hi." };
    const claim = "one two three four five six seven eight nine ten eleven twelve";
    expect(() => buildVideo(board(fast), { facts: [{ id: "f-q", claim, source: { name: "n", url: "https://example.com/" } }] }, words, 30)).toThrow(/"q".*too short/);
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npx vitest run tests/unit/quote.test.ts`
Expected: FAIL (unknown scene type, missing module).

- [ ] **Step 3: Implement tokens, schema, timing**

`src/design/tokens.ts` append:

```ts
/** Quote text lane: the title lane minus room for the big quote mark above and the attribution below. */
export const QUOTE_LANE = {
  width: TITLE_LANE.width,
  height: TITLE_LANE.height - 360,
  maxFont: 120,
} as const;
```
(and a `tokens.test.ts` assertion `QUOTE_LANE.height === TITLE_LANE.height - 360`).

`src/schema/storyboard.ts`:

```ts
const QuoteSceneSchema = z.strictObject({
  ...sceneBase,
  type: z.literal("quote"),
  props: z.strictObject({
    quote: z.string().min(1).max(140),
    attribution: z.string().min(1).max(40),
    factId: z.string().min(1),
  }),
});
// add to the union; export type QuoteProps = Extract<Scene, { type: "quote" }>["props"];
```

`src/scenes/quote/timing.ts`:

```ts
export const QUOTE = { start: 6, wordGap: 3, attrLead: 10, settle: 18 } as const;

/** Frames until the last word has landed, the attribution rule has drawn and everything has settled. */
export const quoteRevealFrames = (wordCount: number): number =>
  QUOTE.start + (wordCount - 1) * QUOTE.wordGap + QUOTE.attrLead + QUOTE.settle;
```

- [ ] **Step 4: Implement validation and timing assertion**

In `src/schema/validate.ts`:
- `MAX_CALLOUTS` gains `quote: 0`.
- Replace the title-only block in `assertCuesSupported` with:

```ts
const NO_CUES: ReadonlySet<Scene["type"]> = new Set(["title", "quote"]);
// ...inside the loop:
    if (NO_CUES.has(scene.type) && scene.cues.length > 0) {
      throw new StoryboardError(`Scene "${scene.id}" (${scene.type}) does not support cues`);
    }
```
- Add the `quote` case to the tracing switch:

```ts
      case "quote": {
        const fact = lookup(scene.id, scene.props.factId);
        if (!normalizeQuote(fact.claim).includes(normalizeQuote(scene.props.quote))) {
          throw new StoryboardError(
            `Scene "${scene.id}": the quote does not appear in the claim of fact "${fact.id}"; the on-screen wording must match the source`,
          );
        }
        break;
      }
```
with

```ts
const normalizeQuote = (s: string): string =>
  s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
```
- Extend `assertTextScenes` with the fit check (import `QUOTE_LANE` and `fitTitleFontSize`, already imported):

```ts
    if (scene.type === "quote") {
      try {
        fitTitleFontSize(scene.props.quote, QUOTE_LANE.width, QUOTE_LANE.height, QUOTE_LANE.maxFont);
      } catch (error) {
        if (error instanceof RangeError) throw new StoryboardError(`Scene "${scene.id}": the quote does not fit: ${error.message}`);
        throw error;
      }
    }
```

In `assertSceneTiming.ts` add:

```ts
    if (scene.type === "quote" && quoteRevealFrames(scene.props.quote.split(/\s+/).filter(Boolean).length) > limit) {
      throw new StoryboardError(
        `Scene "${scene.id}" is too short (${composed.durationFrames} frames): the quote cannot finish revealing before the scene exits; lengthen the narration`,
      );
    }
```
(import `quoteRevealFrames` from `../scenes/quote/timing`). No change needed in `buildVideo` (it already calls `assertTextScenes`).

- [ ] **Step 5: Implement the component and wire it**

`src/scenes/quote/Quote.tsx`:

```tsx
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { EXIT_FRAMES } from "../../charts/timing";
import { BODY_FONT, DISPLAY_FONT } from "../../design/fonts";
import { fitTitleFontSize } from "../../design/layout";
import { popIn, sustainDrift } from "../../design/motion";
import { CAPTION_LANE, PALETTE, QUOTE_LANE, SAFE, VIDEO } from "../../design/tokens";
import type { QuoteProps } from "../../schema/storyboard";
import type { SceneRenderProps } from "../types";
import { QUOTE } from "./timing";

/** A big flat quote mark, the words landing one by one, then a rule and the attribution. */
export const Quote: React.FC<SceneRenderProps<QuoteProps>> = ({ props, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = props.quote.split(/\s+/).filter(Boolean);
  const size = fitTitleFontSize(props.quote, QUOTE_LANE.width, QUOTE_LANE.height, QUOTE_LANE.maxFont);
  const attrDelay = QUOTE.start + (words.length - 1) * QUOTE.wordGap + QUOTE.attrLead;
  const exit = interpolate(frame, [durationFrames - EXIT_FRAMES, durationFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const markIn = Math.min(1, popIn(frame, fps, 0));
  const attrIn = Math.min(1, popIn(frame, fps, attrDelay));

  return (
    <AbsoluteFill
      style={{
        background: PALETTE.ground, opacity: exit, justifyContent: "center",
        padding: `${SAFE.top}px ${SAFE.side}px ${VIDEO.height - CAPTION_LANE.top}px`,
      }}
    >
      <div style={{ transform: `translateY(${sustainDrift(frame, 6, 90)}px)` }}>
        <div
          style={{
            fontFamily: DISPLAY_FONT, fontSize: 320, lineHeight: 0.8, height: 200, color: PALETTE.highlight,
            transform: `scale(${markIn})`, transformOrigin: "left top",
          }}
        >
          “
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0 0.3em", fontSize: size, marginTop: 24 }}>
          {words.map((word, i) => {
            const p = Math.min(1, popIn(frame, fps, QUOTE.start + i * QUOTE.wordGap));
            return (
              <span
                key={`${word}-${i}`}
                style={{
                  fontFamily: DISPLAY_FONT, fontSize: size, lineHeight: 1.02, color: PALETTE.ink,
                  opacity: p, transform: `translateY(${(1 - p) * 24}px)`, display: "inline-block",
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
        <div style={{ marginTop: 48, display: "flex", alignItems: "center", gap: 28, opacity: attrIn }}>
          <div style={{ width: 140, height: 8, background: PALETTE.highlight, transform: `scaleX(${attrIn})`, transformOrigin: "left center" }} />
          <div style={{ fontFamily: BODY_FONT, fontSize: 48, color: PALETTE.highlight }}>{props.attribution}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

Add `case "quote":` to `Video.tsx` `SceneSwitch`.

- [ ] **Step 6: Run to verify GREEN**

Run: `npm run typecheck && npx vitest run tests/unit`
Expected: clean, all PASS. (If the `fitTitleFontSize` check rejects the repeated-long-word test input differently, adjust the test input, not the rule.)

- [ ] **Step 7: Checkpoint (only if asked)**

`git add -A && git commit -m "feat: quote scene traced to its sourced claim"`

---

### Task 7: History demo, goldens, real-voice run, docs

**Files:**
- Create: `fixtures/history.storyboard.json`, `fixtures/history.facts.json`, `tests/render/snapshotHelper.ts`, `tests/render/history.snapshot.test.ts`, `tests/unit/historyDemo.test.ts`
- Modify: `src/Root.tsx`, `tests/render/finance.snapshot.test.ts` (use the helper), `docs/superpowers/specs/2026-10-05-motion-explainers-design.md`, `spikes/RESULTS.md`, `.superpowers/progress.md` (ledger, gitignored)

- [ ] **Step 1: Write the demo fixtures**

`fixtures/history.facts.json` (demo data, flagged for verification, like the finance demo):

```json
{
  "facts": [
    { "id": "f-rome", "claim": "Roman Empire population around 2 AD, millions (rough scholarly estimate; demo data, verify before publishing)", "value": 50, "source": { "name": "Wikipedia: Demographics of the Roman Empire", "url": "https://en.wikipedia.org/wiki/Demographics_of_the_Roman_Empire" } },
    { "id": "f-han", "claim": "Han dynasty census of 2 AD recorded about 57.7 million people (demo data, verify before publishing)", "value": 57.7, "source": { "name": "Wikipedia: Han dynasty", "url": "https://en.wikipedia.org/wiki/Han_dynasty" } },
    { "id": "f-quote", "claim": "After the battle of Zela, Caesar reported: \"I came, I saw, I conquered.\" (Plutarch, Life of Caesar; Suetonius)", "source": { "name": "Plutarch, Life of Caesar", "url": "https://en.wikipedia.org/wiki/Veni,_vidi,_vici" } }
  ]
}
```

`fixtures/history.storyboard.json`: five scenes, all different types (so the variety rule and four wipes are exercised): `intro` title ("Two Empires, One Era", kicker "HISTORY"); `east-west` kinetic-text (lines `["Rome in", "the west", "Han in", "the east"]`, one `emphasize` cue `{ "atWord": "east", "do": "emphasize", "text": "east" }` with narration "Rome ruled the west while the Han dynasty ruled the east, half a world away."); `people` compare (title "People under rule, millions", left Rome 50 `f-rome`, right Han China 57.7 `f-han`, decimals 1, suffix "M", callout cue on the word "more" with text "More people", narration "The Han ruled even more people than Rome."); `census` big-number (value 57.7, suffix "M", decimals 1, label "recorded in the Han census", factId `f-han`, tone "highlight", narration "That census counted fifty seven point seven million."); `veni` quote (quote "I came, I saw, I conquered.", attribution "Julius Caesar", factId `f-quote`, narration "Rome's best known line is Caesar's boast about a quick victory: I came, I saw, I conquered.").

- [ ] **Step 2: Write the failing demo test**

`tests/unit/historyDemo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import facts from "../../fixtures/history.facts.json";
import storyboard from "../../fixtures/history.storyboard.json";
import { buildVideo } from "../../src/pipeline/buildVideo";
import { cutFrames } from "../../src/compose/wipe";
import { synthWords } from "../../src/voice/synthWords";

const built = buildVideo(
  storyboard, facts,
  (sb) => Object.fromEntries(sb.scenes.map((s) => [s.id, synthWords(s.narration)])),
  30,
);

describe("history demo storyboard", () => {
  it("validates, composes five scenes of five different types and has four cuts to wipe", () => {
    expect(built.scenes.map((s) => s.scene.type)).toEqual(["title", "kinetic-text", "compare", "big-number", "quote"]);
    expect(cutFrames(built.scenes)).toHaveLength(4);
  });
  it("resolves the emphasize and callout cues inside their scenes", () => {
    for (const s of built.scenes) for (const c of s.cues) expect(c.frame).toBeLessThan(s.durationFrames);
    expect(built.scenes[1].cues[0].do).toBe("emphasize");
    expect(built.scenes[2].cues[0].do).toBe("callout");
  });
});
```

Run: `npx vitest run tests/unit/historyDemo.test.ts`. Expected: FAIL until the fixtures exist (create them in Step 1 first, then it should PASS: this step is the check that the fixtures validate against every Plan 4 rule; if it fails on a rule, fix the fixture, not the rule).

- [ ] **Step 3: Register the composition**

In `src/Root.tsx` import the two history fixtures, build `history` exactly like `finance` (stand-in `synthWords`), and add `<Composition id="HistoryDemo" ... defaultProps={{ scenes: history.scenes, captions: history.captions }} />`.

- [ ] **Step 4: Share the snapshot helper and add history goldens**

`tests/render/snapshotHelper.ts` extracts the render-and-compare body of the finance test (`GOLDEN_DIR`, `TMP_DIR`, `MAX_DIFF = 0.002`, `UPDATE_SNAPSHOTS` handling) as `expectMatchesGolden(compositionId: string, name: string, frame: number): Promise<void>`; `finance.snapshot.test.ts` is changed to call it (golden file names unchanged: `finance-<name>.png`; history uses `history-<name>.png`).

`tests/render/history.snapshot.test.ts`: build the history demo as above and snapshot, per scene: `kinetic-end` (scene end minus `SETTLE_MARGIN`), `kinetic-emph` (scene start + the emphasize cue's frame + 12), `compare-end`, `quote-end`, plus `wipe-cut` (first cut frame) and `wipe-mid` (first cut frame minus 3).

Run: `UPDATE_SNAPSHOTS=1 npx vitest run tests/render --testTimeout=240000`
Expected: PASS and goldens written. Then Read every new history golden and the changed finance goldens and confirm by eye, recording in the ledger: kinetic lines are left-aligned, fully inside the safe area, nothing in the caption lane; the emphasized word has a yellow block behind dark text; compare bars share the baseline, values sit above the bars and fit, the VS badge sits between, the callout does not hide a value; the quote text wraps inside the lane, the quote mark is a glyph (not tofu) and the attribution sits under the rule; wipe-cut is solid blue with captions on top, wipe-mid shows the slanted blue band with the yellow trailing band. Fix and re-run if any of these fail.

- [ ] **Step 5: Produce the history demo with the real voice**

Run: `npm run produce -- --storyboard fixtures/history.storyboard.json --facts fixtures/history.facts.json --out out/history-edge --no-enforce-length`
Expected: a final mp4 under `out/history-edge`, loudness within -14 +/- 1 LUFS and true peak <= -1.5 dBTP (the produce gate fails otherwise). Extract a frame at the compare callout and at the first wipe with ffmpeg (`ffmpeg -ss <t> -i out/history-edge/final.mp4 -frames:v 1 out/history-edge/check.png`) and Read them to confirm the real-voice timing lands the emphasis and callout on their words.

Also re-run the finance real-voice demo (`npm run produce -- --storyboard fixtures/finance.storyboard.json --facts fixtures/finance.facts.json --out out/finance-edge --no-enforce-length`) and extract the frame at the "climbed" callout cue: the cursor dot sits on 2021 and the badge appears with it.

- [ ] **Step 6: Full verification**

Run: `npm run typecheck && npm run test:cov && npm run test:render`
Expected: typecheck clean; unit tests PASS with coverage >= 80% on every included glob; render tests PASS (live Edge test skipped). Report exact counts.

- [ ] **Step 7: Update the docs**

- Spec section 4: replace the "Chart decisions (Plan 2)" camera/transition deferral line with a "Plan 4 decisions" block: line draw is paced to callout cues (cursor on the anchor on the cue frame; early cues pushed at most to start + 6 frames; right-to-left callouts rejected); transitions are two slanted flat bands at every cut, below captions; the chart camera push-in and matched-element transitions are dropped from v1 with the reason; `kinetic-text` (lines <= 14 chars, no digits, up to 2 emphasize cues naming on-screen words), `compare` (two facts, value >= 0), `quote` (text must appear in the fact's claim) rules; update the scene library list and milestone 4 status.
- `spikes/RESULTS.md`: add "Plan 4 results" (measured render time per frame for the history demo, what the eye review found) and a "Inputs for Plan 5" brief (timeline and map; carried gaps: title numbers not fact-traced, callout text not traced, fonts load from Google at render time, kinetic/quote glyph coverage if tofu showed up, the stand-in voice, single-process rendering).
- Ledger lines for each task and every ruling.

- [ ] **Step 8: Checkpoint (only if asked)**

`git add -A && git commit -m "feat: history demo, wipes and text scenes verified end to end"`
