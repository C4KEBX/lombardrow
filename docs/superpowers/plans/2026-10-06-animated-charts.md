# Motion Explainers: Plan 2 (Animated Charts) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two truly animated, data-driven chart scenes (`line-chart`, `bar-race`) to the foundation, wire their data to sourced facts, and render a ~25s multi-scene finance demo that looks polished.

**Architecture:** Charts are pure functions of `(data, frame)`. Pure geometry/race math lives in `src/charts/` (unit-tested with TDD); React scene components in `src/scenes/` only draw SVG from that math. Chart data must deep-equal a `dataset` on a sourced fact, so the existing "every number traces to a source" rule extends to charts. A `buildVideo` function centralizes parse + validation + scene composition so Root and tests share one path.

**Tech Stack:** Existing stack (Remotion 4.0.533, React 19, Zod 4.5.4, Vitest 5) plus `d3-scale`, `d3-shape`, `@remotion/paths` (pinned 4.0.533).

**Spec:** `docs/superpowers/specs/2026-10-05-motion-explainers-design.md` (sections 4 and 8, milestone 3). Previous plan: `docs/superpowers/plans/2026-10-06-foundation-and-spikes.md`. Spike findings: `spikes/RESULTS.md`.

**Scope note:** Not in this plan: voice step and word-event splitting normalizer, captions, music/audio finish (Plan 3); camera push-in and scene-to-scene transitions, `kinetic-text`/`timeline`/`map`/`compare`/`quote` scenes (Plan 4+); the Claude Code skill. Word timings here come from a clearly labeled synthetic stand-in (`fixtures/synthWords.ts`), not TTS.

## Global Constraints

- Everything from Plan 1 still applies: 1080x1920 @ 30fps; all `remotion*` packages pinned exactly `4.0.533`; zod pinned exactly `4.5.4`; safe zones top 154px / bottom 384px / sides 60px; data eases out with NO overshoot, springs only for objects; no 3 identical scene types in a row; files under 800 lines; no mutation of inputs; zero paid services.
- Rendering uses the system ffmpeg path (`src/pipeline/encode.ts`). Remotion's bundled ffmpeg crashes on this macOS 12 machine. Never call `renderMedia`/`remotion render` to MP4 directly; use `--sequence` + the encoder.
- **Chart data must trace to a fact:** a chart scene's `factId` must reference a fact whose `dataset` deep-equals the scene's `points` (line-chart) or `frames` (bar-race). The last point of a line chart must display exactly at the scene's `decimals`.
- Callout cues on `line-chart` must carry an `x` anchor inside the chart's x range; `bar-race` and `big-number` callouts must not carry `x`. Callout text is at most 24 characters. Callout limits per scene: big-number 1, line-chart 3, bar-race 1. `emphasize` cues are rejected everywhere (no scene renders them).
- Callout and other free text is author-written and NOT traced to facts; the script/fact-check step must verify it (known gap, see Review Focus).
- TDD for all non-visual logic; 80% coverage on `src/schema`, `src/pipeline`, `src/charts`, `src/design/motion.ts`, `src/design/layout.ts`.
- **No git commits unless the user explicitly asks.** Each "Checkpoint" step names the intended message; run it only if asked. Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

Failure modes the spec implies but happy-path tests would miss, most likely first. Each has a pinning test in the task named.

1. Degenerate chart data: flat series, all zeros, negative values, exactly 2 points, huge magnitudes (1e9): no NaN or collapsed axis (Tasks 3, 6).
2. Non-increasing or duplicate x values, NaN/Infinity y, >60 points: rejected with a readable message (Task 6).
3. Callout badges anchored at the first/last point or near the top must stay inside the 60px gutters and below the header (Tasks 3, 6, 7); callout text over 24 chars rejected.
4. Bar race: entity appears or disappears between frames, ties, fewer entities than `topN`, all-zero frames (division by zero), a single dataset frame boundary at `t` exactly integer (Task 4).
5. Chart data that differs from its fact, or a fact with no dataset, or a last value that would display rounded: rejected (Task 6, 7).
6. Axis tick labels must not crowd or show duplicates from too few decimals (step 0.5 with 0 decimals) (Task 3).
7. Carry-over: `formatNumber(-0.001, 0)` must never show `-0`; fact source URLs must be http(s) only (Task 1).
8. Known gap, not tested here: callout text and chart titles are not traced to facts.

## File Structure

```
package.json, tsconfig.json                 modify: deps, lib ES2023
src/design/layout.ts                        modify: formatNumber sign handling
src/design/motion.ts                        modify: easeInOutCubic, dataFrameAt
src/design/tokens.ts                        modify: CATEGORICAL palette
src/schema/deepEqual.ts                     create: JSON deep equality
src/schema/facts.ts                         modify: dataset field, http(s) urls
src/schema/storyboard.ts                    modify: cue x/text cap, line-chart, bar-race
src/schema/validate.ts                      modify: dataset traceability, cue anchors, callout limits
src/pipeline/resolveScene.ts                modify: ResolvedCue.x
src/pipeline/buildVideo.ts                  create: parse + validate + compose in one call
src/charts/geometry.ts                      create: cursor/value/domain/ticks/path-point math
src/charts/layout.ts                        create: CHART_BOX, badge placement
src/charts/race.ts                          create: raceStateAt
src/charts/CalloutBadge.tsx                 create: SVG callout badge
src/scenes/line-chart/LineChart.tsx         create
src/scenes/bar-race/BarRace.tsx             create
src/compose/Video.tsx                       modify: new scene cases
src/Root.tsx                                modify: FinanceDemo composition via buildVideo
fixtures/synthWords.ts                      create: synthetic word timings (stand-in for TTS)
fixtures/finance.storyboard.json, finance.facts.json   create
tests/unit/*.test.ts, tests/render/finance.snapshot.test.ts
```

---

### Task 1: Carry-over fixes and dependencies

**Files:**
- Modify: `package.json`, `tsconfig.json`, `src/design/layout.ts`, `src/schema/facts.ts`
- Test: `tests/unit/formatNumberSign.test.ts`, `tests/unit/factsUrl.test.ts`

**Interfaces:**
- Produces: `formatNumber(value, decimals)` that never returns `-0`/`-0.0`; `FactsSchema` rejecting non-http(s) source URLs; `d3-scale`, `d3-shape`, `@remotion/paths` available.

- [ ] **Step 1: Install dependencies**

Run:
```bash
cd "/Users/justinmason/Claude Code/motion-explainers"
npm install --save-exact @remotion/paths@4.0.533
npm install d3-scale@^4.0.2 d3-shape@^3.2.0
npm install -D @types/d3-scale@^4.0.9 @types/d3-shape@^3.2.0
```
Expected: installs succeed. Then in `tsconfig.json` change `"lib": ["ES2022", "DOM"]` to `"lib": ["ES2023", "DOM"]` (needed for `signDisplay: "negative"` typing).

- [ ] **Step 2: Write the failing tests**

`tests/unit/formatNumberSign.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { formatNumber } from "../../src/design/layout";

describe("formatNumber never shows negative zero", () => {
  it("drops the sign when rounding produces zero", () => {
    expect(formatNumber(-0.001, 0)).toBe("0");
    expect(formatNumber(-0.04, 1)).toBe("0.0");
    expect(formatNumber(-0, 0)).toBe("0");
  });
  it("keeps the sign on real negatives", () => {
    expect(formatNumber(-57, 0)).toBe("-57");
    expect(formatNumber(-0.5, 1)).toBe("-0.5");
  });
});
```

`tests/unit/factsUrl.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseFacts } from "../../src/schema/facts";

const withUrl = (url: string) => ({
  facts: [{ id: "f1", claim: "c", source: { name: "n", url } }],
});

describe("fact source urls", () => {
  it("accepts http and https", () => {
    expect(() => parseFacts(withUrl("https://example.com/a"))).not.toThrow();
    expect(() => parseFacts(withUrl("http://example.com/a"))).not.toThrow();
  });
  it("rejects javascript:, file: and data: urls", () => {
    for (const bad of ["javascript:alert(1)", "file:///etc/passwd", "data:text/html,hi"]) {
      expect(() => parseFacts(withUrl(bad))).toThrow(/http/);
    }
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run tests/unit/formatNumberSign.test.ts tests/unit/factsUrl.test.ts`
Expected: FAIL (`-0` results; javascript: accepted).

- [ ] **Step 4: Implement**

In `src/design/layout.ts` replace `formatNumber` with:
```ts
export function formatNumber(value: number, decimals: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: "negative", // no sign when the rounded result is zero
  });
}
```
In `src/schema/facts.ts` change the `url` field to:
```ts
  source: z.strictObject({
    name: z.string().min(1),
    url: z.url().refine((u) => /^https?:\/\//i.test(u), "source url must be http(s)"),
  }),
```
(keep the surrounding `strictObject` structure already in the file).

- [ ] **Step 5: Run to verify pass**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; all unit tests pass (the existing `layout.test.ts` "never renders negative zero" and "keeps the sign" tests must still pass).

- [ ] **Step 6: Checkpoint** (only if asked): `chore: chart dependencies, formatNumber sign, http(s) fact urls`

---

### Task 2: Small shared utilities (TDD)

**Files:**
- Modify: `src/design/motion.ts`, `src/design/tokens.ts`
- Create: `src/schema/deepEqual.ts`
- Test: `tests/unit/motionChart.test.ts`, `tests/unit/deepEqual.test.ts`, `tests/unit/categorical.test.ts`

**Interfaces:**
- Produces:
  - `easeInOutCubic(t: number): number`
  - `dataFrameAt(targetProgress: number, startFrame: number, durationFrames: number): number` (inverse of `dataProgress`)
  - `CATEGORICAL: readonly string[]` (6 hex colors, none equal to `positive`/`negative`)
  - `deepEqual(a: unknown, b: unknown): boolean` (JSON values; key-order independent)

- [ ] **Step 1: Write the failing tests**

`tests/unit/motionChart.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { dataFrameAt, dataProgress, easeInOutCubic } from "../../src/design/motion";

describe("easeInOutCubic", () => {
  it("is 0 at 0, 0.5 at 0.5, 1 at 1 and clamps outside", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 10);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(-3)).toBe(0);
    expect(easeInOutCubic(4)).toBe(1);
  });
  it("is monotonic and never overshoots", () => {
    let prev = -1;
    for (let t = 0; t <= 1; t += 0.01) {
      const v = easeInOutCubic(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeLessThanOrEqual(1);
      prev = v;
    }
  });
});

describe("dataFrameAt (inverse of dataProgress)", () => {
  it("hits the start and the end", () => {
    expect(dataFrameAt(0, 10, 60)).toBe(10);
    expect(dataFrameAt(1, 10, 60)).toBe(70);
  });
  it("round-trips through dataProgress", () => {
    for (const p of [0, 0.1, 0.25, 0.5, 0.9, 1]) {
      expect(dataProgress(dataFrameAt(p, 10, 60), 10, 60)).toBeCloseTo(p, 8);
    }
  });
  it("clamps out-of-range targets and rejects a bad duration", () => {
    expect(dataFrameAt(-1, 10, 60)).toBe(10);
    expect(dataFrameAt(9, 10, 60)).toBe(70);
    expect(() => dataFrameAt(0.5, 0, 0)).toThrow(RangeError);
  });
});
```

`tests/unit/deepEqual.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { deepEqual } from "../../src/schema/deepEqual";

describe("deepEqual", () => {
  it("compares primitives, arrays and objects", () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual("a", "b")).toBe(false);
    expect(deepEqual([1, 2], [1, 2])).toBe(true);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(null, 0)).toBe(false);
  });
  it("ignores object key order", () => {
    expect(deepEqual({ x: 1, y: 2 }, { y: 2, x: 1 })).toBe(true);
  });
  it("detects nested differences and extra or missing keys", () => {
    expect(deepEqual([{ x: 1, y: 2 }], [{ x: 1, y: 3 }])).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });
  it("does not treat an array and an object as equal", () => {
    expect(deepEqual([], {})).toBe(false);
    expect(deepEqual({ 0: 1 }, [1])).toBe(false);
  });
});
```

`tests/unit/categorical.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { CATEGORICAL, PALETTE } from "../../src/design/tokens";

describe("CATEGORICAL palette", () => {
  it("has 6 distinct hex colors", () => {
    expect(CATEGORICAL).toHaveLength(6);
    expect(new Set(CATEGORICAL).size).toBe(6);
    for (const c of CATEGORICAL) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
  });
  it("never reuses the semantic gain/loss colors", () => {
    expect(CATEGORICAL).not.toContain(PALETTE.positive);
    expect(CATEGORICAL).not.toContain(PALETTE.negative);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/motionChart.test.ts tests/unit/deepEqual.test.ts tests/unit/categorical.test.ts`
Expected: FAIL (missing exports / module).

- [ ] **Step 3: Implement**

Append to `src/design/motion.ts`:
```ts
/** Smooth start and stop; used for rank swaps in bar races. Never overshoots. */
export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** The frame at which `dataProgress(frame, start, duration)` reaches `targetProgress`. */
export function dataFrameAt(targetProgress: number, startFrame: number, durationFrames: number): number {
  if (durationFrames <= 0) throw new RangeError("durationFrames must be positive");
  return startFrame + durationFrames * (1 - Math.cbrt(1 - clamp01(targetProgress)));
}
```
Append to `src/design/tokens.ts`:
```ts
/** Categorical series colors (bar races). Deliberately excludes the semantic gain/loss colors. */
export const CATEGORICAL = ["#ffd23f", "#7c8cff", "#ff9f5a", "#5ad1ff", "#c78bff", "#9be564"] as const;
```
Create `src/schema/deepEqual.ts`:
```ts
/** Deep equality for JSON values (null, boolean, number, string, arrays, plain objects). */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
  }
  const ak = Object.keys(a as object);
  const bk = Object.keys(b as object);
  if (ak.length !== bk.length) return false;
  return ak.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(b, key) &&
      deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run typecheck && npm test`
Expected: all pass.

- [ ] **Step 5: Checkpoint** (only if asked): `feat: chart easing utilities, categorical palette, deepEqual`

---

### Task 3: Line-chart geometry and chart layout (TDD, pure)

**Files:**
- Create: `src/charts/geometry.ts`, `src/charts/layout.ts`
- Test: `tests/unit/chartGeometry.test.ts`, `tests/unit/chartLayout.test.ts`

**Interfaces:**
- Consumes: `clamp01` from `src/design/motion.ts`; `SAFE`, `VIDEO` from `src/design/tokens.ts`.
- Produces (`geometry.ts`):
  - `type DataPoint = { x: number; y: number }`, `type Domain = readonly [number, number]`, `type Baseline = "zero" | "data"`
  - `cursorX(points, progress): number`
  - `valueAtX(points, x): number`
  - `visibleMax(points, x): number`
  - `yDomainAt(points, progress, baseline, headroom = 0.12): Domain`
  - `niceTicks(domain, count): number[]`
  - `decimalsForStep(step): number`
  - `pointOnPathAtX(path, targetX): DataPoint`
- Produces (`layout.ts`):
  - `CHART_BOX = { left: 60, right: 1020, top: 760, bottom: 1400 }`
  - `BADGE = { charPx: 33, padPx: 28, heightPx: 84, offsetPx: 90, fontPx: 44 }`
  - `type PlacedBadge = { x: number; y: number; width: number; above: boolean }`
  - `badgeWidth(text): number`, `placeBadge(anchorX, anchorY, text, minY = 640): PlacedBadge`

- [ ] **Step 1: Write the failing tests**

`tests/unit/chartGeometry.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  cursorX, decimalsForStep, niceTicks, pointOnPathAtX, valueAtX, visibleMax, yDomainAt,
  type DataPoint,
} from "../../src/charts/geometry";

const pts: DataPoint[] = [{ x: 2000, y: 10 }, { x: 2001, y: 20 }, { x: 2002, y: 40 }];

describe("cursorX", () => {
  it("maps progress onto the x range and clamps", () => {
    expect(cursorX(pts, 0)).toBe(2000);
    expect(cursorX(pts, 0.5)).toBe(2001);
    expect(cursorX(pts, 1)).toBe(2002);
    expect(cursorX(pts, -1)).toBe(2000);
    expect(cursorX(pts, 2)).toBe(2002);
  });
});

describe("valueAtX", () => {
  it("interpolates linearly and clamps to the ends", () => {
    expect(valueAtX(pts, 2000.5)).toBe(15);
    expect(valueAtX(pts, 2001)).toBe(20);
    expect(valueAtX(pts, 1999)).toBe(10);
    expect(valueAtX(pts, 3000)).toBe(40);
  });
});

describe("visibleMax", () => {
  it("includes the interpolated tip", () => {
    expect(visibleMax(pts, 2000.5)).toBe(15);
    expect(visibleMax(pts, 2002)).toBe(40);
  });
});

describe("yDomainAt", () => {
  it("starts small and grows to fit the data (zero baseline)", () => {
    const [lo0, hi0] = yDomainAt(pts, 0, "zero");
    expect(lo0).toBe(0);
    expect(hi0).toBeCloseTo(11.2, 6);
    const [, hi1] = yDomainAt(pts, 1, "zero");
    expect(hi1).toBeCloseTo(44.8, 6);
  });
  it("never shrinks as progress increases", () => {
    let prev = -Infinity;
    for (let p = 0; p <= 1; p += 0.02) {
      const [, hi] = yDomainAt(pts, p, "zero");
      expect(hi).toBeGreaterThanOrEqual(prev);
      prev = hi;
    }
  });
  it("keeps a minimum span so an early tiny value does not make a razor-thin axis", () => {
    const [lo, hi] = yDomainAt([{ x: 0, y: 1 }, { x: 1, y: 100 }], 0, "zero");
    expect(lo).toBe(0);
    expect(hi).toBeCloseTo(28, 6);
  });
  it("pads below the data minimum for the data baseline", () => {
    const [lo, hi] = yDomainAt(pts, 1, "data");
    expect(lo).toBeCloseTo(7, 6);
    expect(hi).toBeCloseTo(43.96, 6);
  });
  it("handles flat, all-zero and negative series without NaN or a collapsed axis", () => {
    const cases: DataPoint[][] = [
      [{ x: 0, y: 5 }, { x: 1, y: 5 }],
      [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      [{ x: 0, y: -5 }, { x: 1, y: -3 }],
      [{ x: 0, y: 1e9 }, { x: 1, y: 3e9 }],
    ];
    for (const series of cases) {
      for (const baseline of ["zero", "data"] as const) {
        for (const p of [0, 0.5, 1]) {
          const [lo, hi] = yDomainAt(series, p, baseline);
          expect(Number.isFinite(lo) && Number.isFinite(hi)).toBe(true);
          expect(hi).toBeGreaterThan(lo);
        }
      }
    }
  });
});

describe("niceTicks / decimalsForStep", () => {
  it("returns round tick values inside the domain", () => {
    expect(niceTicks([0, 100], 5)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(niceTicks([0, 11.2], 4)).toEqual([0, 2, 4, 6, 8, 10]);
  });
  it("derives label decimals from the tick step so labels never duplicate", () => {
    expect(decimalsForStep(20)).toBe(0);
    expect(decimalsForStep(1)).toBe(0);
    expect(decimalsForStep(0.5)).toBe(1);
    expect(decimalsForStep(0.05)).toBe(2);
    expect(decimalsForStep(0.00001)).toBe(4);
    expect(decimalsForStep(Number.NaN)).toBe(0);
  });
});

describe("pointOnPathAtX", () => {
  it("finds the point on a path at a given x", () => {
    const p = pointOnPathAtX("M0,0 L100,100", 50);
    expect(p.x).toBeCloseTo(50, 2);
    expect(p.y).toBeCloseTo(50, 2);
  });
  it("clamps to the path ends", () => {
    const end = pointOnPathAtX("M0,0 L100,100", 500);
    expect(end.x).toBeCloseTo(100, 2);
    const start = pointOnPathAtX("M0,0 L100,100", -5);
    expect(start.x).toBeCloseTo(0, 2);
  });
});
```

`tests/unit/chartLayout.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { BADGE, CHART_BOX, badgeWidth, placeBadge } from "../../src/charts/layout";

describe("CHART_BOX", () => {
  it("sits inside the side gutters and above the bottom safe zone", () => {
    expect(CHART_BOX.left).toBe(60);
    expect(CHART_BOX.right).toBe(1020);
    expect(CHART_BOX.bottom + 80).toBeLessThanOrEqual(1920 - 384);
  });
});

describe("placeBadge", () => {
  it("centers above the anchor when there is room", () => {
    const b = placeBadge(540, 1000, "Crash");
    expect(b.x).toBe(540);
    expect(b.y).toBe(1000 - BADGE.offsetPx);
    expect(b.above).toBe(true);
    expect(b.width).toBe(badgeWidth("Crash"));
  });
  it("clamps inside the left and right gutters", () => {
    const left = placeBadge(70, 1000, "Crash");
    expect(left.x - left.width / 2).toBeGreaterThanOrEqual(CHART_BOX.left);
    const right = placeBadge(1010, 1000, "Crash");
    expect(right.x + right.width / 2).toBeLessThanOrEqual(CHART_BOX.right);
  });
  it("flips below the anchor when above would collide with the header", () => {
    const b = placeBadge(540, 700, "Crash");
    expect(b.above).toBe(false);
    expect(b.y).toBe(700 + BADGE.offsetPx);
  });
  it("fits the longest allowed text (24 chars) in the gutters", () => {
    const text = "x".repeat(24);
    for (const ax of [60, 540, 1020]) {
      const b = placeBadge(ax, 1000, text);
      expect(b.x - b.width / 2).toBeGreaterThanOrEqual(CHART_BOX.left);
      expect(b.x + b.width / 2).toBeLessThanOrEqual(CHART_BOX.right);
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/chartGeometry.test.ts tests/unit/chartLayout.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `src/charts/geometry.ts`**

```ts
import { getLength, getPointAtLength } from "@remotion/paths";
import { scaleLinear } from "d3-scale";
import { clamp01 } from "../design/motion";

export type DataPoint = { x: number; y: number };
export type Domain = readonly [number, number];
export type Baseline = "zero" | "data";

const MIN_SPAN_FRACTION = 0.25; // an early tiny value never makes a razor-thin axis
const DATA_BASELINE_PAD = 0.1;
const MAX_TICK_DECIMALS = 4;
const PATH_SEARCH_STEPS = 24;

/** The x position the line has been drawn up to. Points must be sorted by x. */
export function cursorX(points: readonly DataPoint[], progress: number): number {
  const first = points[0].x;
  const last = points[points.length - 1].x;
  return first + (last - first) * clamp01(progress);
}

export function valueAtX(points: readonly DataPoint[], x: number): number {
  const first = points[0];
  const last = points[points.length - 1];
  if (x <= first.x) return first.y;
  if (x >= last.x) return last.y;
  for (let i = 1; i < points.length; i += 1) {
    const b = points[i];
    if (x <= b.x) {
      const a = points[i - 1];
      return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
    }
  }
  return last.y;
}

export function visibleMax(points: readonly DataPoint[], x: number): number {
  let max = valueAtX(points, x);
  for (const p of points) {
    if (p.x <= x && p.y > max) max = p.y;
  }
  return max;
}

/** Y domain that grows smoothly as the line draws (running max plus headroom). */
export function yDomainAt(
  points: readonly DataPoint[],
  progress: number,
  baseline: Baseline,
  headroom = 0.12,
): Domain {
  const ys = points.map((p) => p.y);
  const dataMin = Math.min(...ys);
  const dataMax = Math.max(...ys);
  const dataSpan = dataMax - dataMin;
  const lo =
    baseline === "zero"
      ? Math.min(0, dataMin)
      : dataMin - DATA_BASELINE_PAD * (dataSpan || Math.max(Math.abs(dataMin), 1));
  let fullSpan = dataMax - lo;
  if (fullSpan <= 0) fullSpan = Math.max(Math.abs(dataMax), 1);
  const visible = visibleMax(points, cursorX(points, progress));
  const span = Math.max(visible - lo, MIN_SPAN_FRACTION * fullSpan);
  return [lo, lo + span * (1 + headroom)];
}

export function niceTicks(domain: Domain, count: number): number[] {
  return scaleLinear()
    .domain([domain[0], domain[1]])
    .ticks(count)
    .filter((t) => t >= domain[0] && t <= domain[1]);
}

/** Decimals needed so tick labels at this step never repeat (0.5 -> 1, 0.05 -> 2). */
export function decimalsForStep(step: number): number {
  if (!Number.isFinite(step) || step <= 0 || step >= 1) return 0;
  return Math.min(MAX_TICK_DECIMALS, Math.ceil(-Math.log10(step) - 1e-9));
}

/** Point on an x-monotonic path at a given x (bisection on path length). */
export function pointOnPathAtX(path: string, targetX: number): DataPoint {
  let lo = 0;
  let hi = getLength(path);
  const at = (length: number): DataPoint => {
    const p = getPointAtLength(path, length);
    if (!p) throw new RangeError(`path has no point at length ${length}`);
    return { x: p.x, y: p.y };
  };
  for (let i = 0; i < PATH_SEARCH_STEPS; i += 1) {
    const mid = (lo + hi) / 2;
    if (at(mid).x < targetX) lo = mid;
    else hi = mid;
  }
  return at((lo + hi) / 2);
}
```

`src/charts/layout.ts`:
```ts
import { SAFE, VIDEO } from "../design/tokens";

export const CHART_BOX = {
  left: SAFE.side,
  right: VIDEO.width - SAFE.side,
  top: 760,
  bottom: 1400,
} as const;

/** Callout badge metrics. charPx matches the display face at fontPx (about 0.75em per char). */
export const BADGE = { charPx: 33, padPx: 28, heightPx: 84, offsetPx: 90, fontPx: 44 } as const;

export type PlacedBadge = { x: number; y: number; width: number; above: boolean };

export const badgeWidth = (text: string): number => text.length * BADGE.charPx + 2 * BADGE.padPx;

/** Centers a badge above (or below, if there is no room) its anchor, kept inside the side gutters. */
export function placeBadge(anchorX: number, anchorY: number, text: string, minY = 640): PlacedBadge {
  const width = badgeWidth(text);
  const half = width / 2;
  const x = Math.min(CHART_BOX.right - half, Math.max(CHART_BOX.left + half, anchorX));
  const above = anchorY - BADGE.offsetPx - BADGE.heightPx / 2 >= minY;
  return { x, y: above ? anchorY - BADGE.offsetPx : anchorY + BADGE.offsetPx, width, above };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run typecheck && npx vitest run tests/unit/chartGeometry.test.ts tests/unit/chartLayout.test.ts`
Expected: all pass. If `niceTicks([0, 11.2], 4)` differs from `[0, 2, 4, 6, 8, 10]` because of d3's step choice, adjust only that expected array to d3's actual output (keep it a round-number list inside the domain) and note it in the ledger.

- [ ] **Step 5: Checkpoint** (only if asked): `feat: line-chart geometry and badge layout`

---

### Task 4: Bar-race state (TDD, pure)

**Files:**
- Create: `src/charts/race.ts`
- Test: `tests/unit/race.test.ts`

**Interfaces:**
- Consumes: `clamp01`, `easeInOutCubic` from `src/design/motion.ts`.
- Produces:
  - `type RaceValue = { name: string; value: number }`, `type RaceFrame = { label: string; values: RaceValue[] }`
  - `type RaceBar = { name: string; value: number; rank: number; opacity: number; colorIndex: number }`
  - `type RaceState = { bars: RaceBar[]; label: string; axisMax: number }`
  - `raceStateAt(frames: readonly RaceFrame[], t: number, topN: number): RaceState` (`t` is a fractional keyframe index; bars are sorted by rank and only those with opacity > 0 are returned)

- [ ] **Step 1: Write the failing tests `tests/unit/race.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { raceStateAt, type RaceFrame } from "../../src/charts/race";

const F: RaceFrame[] = [
  { label: "2010", values: [{ name: "A", value: 10 }, { name: "B", value: 20 }, { name: "C", value: 5 }] },
  { label: "2011", values: [{ name: "A", value: 30 }, { name: "B", value: 20 }, { name: "C", value: 8 }] },
  { label: "2012", values: [{ name: "A", value: 30 }, { name: "B", value: 40 }, { name: "D", value: 12 }] },
];
const names = (s: ReturnType<typeof raceStateAt>) => s.bars.map((b) => b.name);
const bar = (s: ReturnType<typeof raceStateAt>, n: string) => s.bars.find((b) => b.name === n)!;

describe("raceStateAt at keyframes", () => {
  it("returns exact values, ranks and label at t=0", () => {
    const s = raceStateAt(F, 0, 3);
    expect(names(s)).toEqual(["B", "A", "C"]);
    expect(bar(s, "B").value).toBe(20);
    expect(bar(s, "B").rank).toBe(0);
    expect(s.label).toBe("2010");
    expect(s.axisMax).toBeCloseTo(21.6, 6);
  });
  it("hides an entity that has not appeared yet (D) and shows it once it ranks in", () => {
    expect(names(raceStateAt(F, 1, 3))).toEqual(["A", "B", "C"]);
    expect(names(raceStateAt(F, 2, 3))).toEqual(["B", "A", "D"]);
  });
});

describe("raceStateAt between keyframes", () => {
  it("interpolates values linearly and swaps ranks smoothly", () => {
    const s = raceStateAt(F, 0.5, 3);
    expect(bar(s, "A").value).toBeCloseTo(20, 6);
    expect(bar(s, "A").rank).toBeCloseTo(0.5, 6);
    expect(bar(s, "B").rank).toBeCloseTo(0.5, 6);
    expect(bar(s, "C").value).toBeCloseTo(6.5, 6);
  });
  it("fades entities across the topN boundary", () => {
    const s = raceStateAt(F, 1.5, 3);
    expect(bar(s, "D").value).toBeCloseTo(6, 6);
    expect(bar(s, "D").opacity).toBeCloseTo(0.5, 6);
    expect(bar(s, "C").opacity).toBeCloseTo(0.5, 6);
  });
  it("keeps colors stable by first appearance", () => {
    const s = raceStateAt(F, 2, 4);
    expect(bar(s, "A").colorIndex).toBe(0);
    expect(bar(s, "B").colorIndex).toBe(1);
    expect(bar(s, "D").colorIndex).toBe(3);
  });
  it("clamps t outside the range", () => {
    expect(raceStateAt(F, -5, 3)).toEqual(raceStateAt(F, 0, 3));
    expect(raceStateAt(F, 99, 3)).toEqual(raceStateAt(F, 2, 3));
  });
});

describe("raceStateAt edge cases", () => {
  it("returns fewer bars than topN when there are fewer entities", () => {
    const two: RaceFrame[] = [
      { label: "a", values: [{ name: "X", value: 1 }, { name: "Y", value: 2 }] },
      { label: "b", values: [{ name: "X", value: 2 }, { name: "Y", value: 3 }] },
    ];
    expect(raceStateAt(two, 0.5, 5).bars).toHaveLength(2);
  });
  it("breaks ties by name so ranks are stable", () => {
    const tie: RaceFrame[] = [
      { label: "a", values: [{ name: "B", value: 5 }, { name: "A", value: 5 }] },
      { label: "b", values: [{ name: "B", value: 5 }, { name: "A", value: 5 }] },
    ];
    expect(names(raceStateAt(tie, 0, 2))).toEqual(["A", "B"]);
  });
  it("never divides by zero when every value is 0", () => {
    const zero: RaceFrame[] = [
      { label: "a", values: [{ name: "X", value: 0 }, { name: "Y", value: 0 }] },
      { label: "b", values: [{ name: "X", value: 0 }, { name: "Y", value: 0 }] },
    ];
    const s = raceStateAt(zero, 0.5, 2);
    expect(s.axisMax).toBe(1);
    for (const b of s.bars) expect(Number.isFinite(b.value) && Number.isFinite(b.rank)).toBe(true);
  });
  it("works with a single frame and rejects an empty list", () => {
    expect(names(raceStateAt([F[0]], 0.7, 3))).toEqual(["B", "A", "C"]);
    expect(() => raceStateAt([], 0, 3)).toThrow(RangeError);
  });
  it("does not mutate its input", () => {
    const before = JSON.stringify(F);
    raceStateAt(F, 1.3, 3);
    expect(JSON.stringify(F)).toBe(before);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/race.test.ts`
Expected: FAIL, cannot resolve `../../src/charts/race`.

- [ ] **Step 3: Implement `src/charts/race.ts`**

```ts
import { clamp01, easeInOutCubic } from "../design/motion";

export type RaceValue = { name: string; value: number };
export type RaceFrame = { label: string; values: RaceValue[] };
export type RaceBar = { name: string; value: number; rank: number; opacity: number; colorIndex: number };
export type RaceState = { bars: RaceBar[]; label: string; axisMax: number };

const AXIS_HEADROOM = 1.08;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function namesInOrder(frames: readonly RaceFrame[]): string[] {
  const seen = new Set<string>();
  for (const frame of frames) for (const v of frame.values) seen.add(v.name);
  return [...seen];
}

/** Value per name for a frame; entities missing from the frame count as 0. */
function valuesAt(frame: RaceFrame, names: readonly string[]): Map<string, number> {
  const byName = new Map(frame.values.map((v) => [v.name, v.value]));
  return new Map(names.map((name) => [name, byName.get(name) ?? 0]));
}

function ranksOf(values: Map<string, number>): Map<string, number> {
  const sorted = [...values.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return new Map(sorted.map(([name], index) => [name, index]));
}

/**
 * State of a bar race at fractional keyframe index `t`. Values move linearly; ranks swap with an
 * ease-in-out so overtakes read clearly. Bars below `topN` fade out and are omitted at opacity 0.
 */
export function raceStateAt(frames: readonly RaceFrame[], t: number, topN: number): RaceState {
  if (frames.length === 0) throw new RangeError("frames must not be empty");
  const names = namesInOrder(frames);
  const tc = Math.min(Math.max(t, 0), frames.length - 1);
  const k = Math.min(Math.floor(tc), Math.max(frames.length - 2, 0));
  const next = Math.min(k + 1, frames.length - 1);
  const f = frames.length === 1 ? 0 : tc - k;
  const u = easeInOutCubic(f);

  const a = valuesAt(frames[k], names);
  const b = valuesAt(frames[next], names);
  const ra = ranksOf(a);
  const rb = ranksOf(b);

  const bars = names
    .map((name, colorIndex) => {
      const rank = lerp(ra.get(name) as number, rb.get(name) as number, u);
      return {
        name,
        value: lerp(a.get(name) as number, b.get(name) as number, f),
        rank,
        opacity: clamp01(topN - rank),
        colorIndex,
      };
    })
    .filter((bar) => bar.opacity > 0)
    .sort((x, y) => x.rank - y.rank || x.name.localeCompare(y.name));

  const maxOf = (m: Map<string, number>) => Math.max(...m.values());
  const axis = lerp(maxOf(a), maxOf(b), f) * AXIS_HEADROOM;
  return {
    bars,
    label: frames[Math.min(Math.round(tc), frames.length - 1)].label,
    axisMax: axis > 0 ? axis : 1,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run typecheck && npx vitest run tests/unit/race.test.ts`
Expected: all pass.

- [ ] **Step 5: Checkpoint** (only if asked): `feat: bar-race state machine`

---

### Task 5: Shared video builder (TDD)

**Files:**
- Create: `src/pipeline/buildVideo.ts`
- Modify: `src/Root.tsx` (use `buildVideo` for the existing hello composition)
- Test: `tests/unit/buildVideo.test.ts`

**Interfaces:**
- Consumes: `parseStoryboard`, `parseFacts`, all `assert*` from `validate.ts`, `composeScenes` + `ComposedScene` from `resolveScene.ts`, `WordTiming`.
- Produces:
  - `type BuiltVideo = { storyboard: Storyboard; scenes: ComposedScene[]; totalFrames: number }`
  - `buildVideo(storyboardJson: unknown, factsJson: unknown, wordsFor: (sb: Storyboard) => Record<string, readonly WordTiming[]>, fps: number): BuiltVideo`

- [ ] **Step 1: Write the failing test `tests/unit/buildVideo.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import facts from "../../fixtures/hello.facts.json";
import storyboard from "../../fixtures/hello.storyboard.json";
import words from "../../fixtures/hello.words.json";
import { buildVideo } from "../../src/pipeline/buildVideo";
import { StoryboardError } from "../../src/schema/storyboard";
import { CueResolutionError } from "../../src/schema/timing";

describe("buildVideo", () => {
  it("parses, validates and composes the hello fixtures", () => {
    const built = buildVideo(storyboard, facts, () => words, 30);
    expect(built.scenes.map((s) => s.id)).toEqual(["intro", "drop"]);
    expect(built.totalFrames).toBe(159);
  });

  it("runs the validation rules (facts mismatch is rejected)", () => {
    const badFacts = { facts: [{ ...facts.facts[0], value: 56 }] };
    expect(() => buildVideo(storyboard, badFacts, () => words, 30)).toThrow(StoryboardError);
  });

  it("rejects unsupported cues before composing", () => {
    const bad = {
      ...storyboard,
      scenes: [
        { ...storyboard.scenes[0], cues: [{ atWord: "the", do: "callout", text: "x" }] },
        storyboard.scenes[1],
      ],
    };
    expect(() => buildVideo(bad, facts, () => words, 30)).toThrow(/does not support cues/);
  });

  it("propagates timing errors naming the scene", () => {
    expect(() => buildVideo(storyboard, facts, () => ({ intro: words.intro }), 30)).toThrow(CueResolutionError);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/buildVideo.test.ts`
Expected: FAIL, cannot resolve `../../src/pipeline/buildVideo`.

- [ ] **Step 3: Implement `src/pipeline/buildVideo.ts`**

```ts
import { parseFacts } from "../schema/facts";
import { parseStoryboard, type Storyboard } from "../schema/storyboard";
import type { WordTiming } from "../schema/timing";
import {
  assertCuesSupported,
  assertFactsTraceable,
  assertHeadlinesFit,
  assertVariety,
} from "../schema/validate";
import { composeScenes, type ComposedScene } from "./resolveScene";

export type BuiltVideo = { storyboard: Storyboard; scenes: ComposedScene[]; totalFrames: number };

/** The single path from raw JSON to renderable scenes: parse, validate, compose. */
export function buildVideo(
  storyboardJson: unknown,
  factsJson: unknown,
  wordsFor: (sb: Storyboard) => Record<string, readonly WordTiming[]>,
  fps: number,
): BuiltVideo {
  const storyboard = parseStoryboard(storyboardJson);
  assertVariety(storyboard);
  assertCuesSupported(storyboard);
  assertHeadlinesFit(storyboard);
  assertFactsTraceable(storyboard, parseFacts(factsJson));
  const scenes = composeScenes(storyboard, wordsFor(storyboard), fps);
  const totalFrames = scenes.reduce((sum, scene) => sum + scene.durationFrames, 0);
  return { storyboard, scenes, totalFrames };
}
```

Replace the top of `src/Root.tsx` (everything from the imports through `helloFrames`) with:
```tsx
import React from "react";
import { Composition } from "remotion";
import facts from "../fixtures/hello.facts.json";
import storyboardJson from "../fixtures/hello.storyboard.json";
import words from "../fixtures/hello.words.json";
import { Video } from "./compose/Video";
import { VIDEO } from "./design/tokens";
import { buildVideo } from "./pipeline/buildVideo";
import { RenderStress } from "./spikes/RenderStress";

const hello = buildVideo(storyboardJson, facts, () => words, VIDEO.fps);
```
and in the JSX use `durationInFrames={hello.totalFrames}` and `defaultProps={{ scenes: hello.scenes }}` for `HelloBigNumber` (leave `RenderStress` unchanged).

- [ ] **Step 4: Run to verify pass**

Run: `npm run typecheck && npm test && npm run test:render`
Expected: unit tests pass; the 4 existing render tests still pass (hello unchanged).

- [ ] **Step 5: Checkpoint** (only if asked): `refactor: buildVideo centralizes parse, validate, compose`

---

### Task 6: Line-chart scene end to end

**Files:**
- Modify: `src/schema/storyboard.ts`, `src/schema/facts.ts`, `src/schema/validate.ts`, `src/pipeline/resolveScene.ts`, `src/compose/Video.tsx`
- Create: `src/charts/CalloutBadge.tsx`, `src/scenes/line-chart/LineChart.tsx`
- Test: `tests/unit/lineChartSchema.test.ts`, `tests/unit/lineChartValidate.test.ts`, `tests/unit/resolveCueX.test.ts`

**Interfaces:**
- Consumes: geometry/layout from Task 3, `deepEqual` and `dataFrameAt` from Task 2.
- Produces:
  - Storyboard scene type `"line-chart"` with props `{ title, points: DataPoint[2..60], xFormat: "year"|"number" (default "number"), prefix, suffix, decimals, tone, baseline: "zero"|"data" (default "zero"), factId }` and type `LineChartProps`
  - Cue field `x?: number`; callout `text` max 24 chars
  - Fact field `dataset?: JSON`
  - `ResolvedCue.x?: number`
  - `assertFactsTraceable` handling line-chart; `assertCuesSupported` with `MAX_CALLOUTS` = `{ title: 0, "big-number": 1, "line-chart": 3 }` and anchor rules
  - `LineChart` React component

- [ ] **Step 1: Write the failing schema tests `tests/unit/lineChartSchema.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { parseFacts } from "../../src/schema/facts";
import { parseStoryboard, StoryboardError } from "../../src/schema/storyboard";

const scene = (props: Record<string, unknown> = {}, cues: unknown[] = []) => ({
  id: "c1", type: "line-chart", narration: "It rose.", cues,
  props: { title: "T", points: [{ x: 2000, y: 1 }, { x: 2001, y: 2 }], factId: "f1", ...props },
});
const board = (s: unknown) =>
  parseStoryboard({
    schemaVersion: 1,
    meta: { title: "t", theme: "bold-flat", voice: "v" },
    audio: { music: null },
    scenes: [s],
  });

describe("line-chart schema", () => {
  it("parses and applies defaults", () => {
    const sc = board(scene()).scenes[0];
    if (sc.type !== "line-chart") throw new Error("expected line-chart");
    expect(sc.props).toMatchObject({
      xFormat: "number", baseline: "zero", tone: "highlight", decimals: 0, prefix: "", suffix: "",
    });
  });
  it("rejects fewer than 2 points and more than 60", () => {
    expect(() => board(scene({ points: [{ x: 1, y: 1 }] }))).toThrow(StoryboardError);
    const many = Array.from({ length: 61 }, (_, i) => ({ x: i, y: i }));
    expect(() => board(scene({ points: many }))).toThrow(StoryboardError);
  });
  it("rejects non-increasing and duplicate x with a readable message", () => {
    expect(() => board(scene({ points: [{ x: 2, y: 1 }, { x: 1, y: 2 }] }))).toThrow(/increasing/);
    expect(() => board(scene({ points: [{ x: 1, y: 1 }, { x: 1, y: 2 }] }))).toThrow(/increasing/);
  });
  it("rejects NaN and Infinity coordinates", () => {
    expect(() => board(scene({ points: [{ x: 1, y: NaN }, { x: 2, y: 2 }] }))).toThrow(StoryboardError);
    expect(() => board(scene({ points: [{ x: 1, y: 1 }, { x: 2, y: Infinity }] }))).toThrow(StoryboardError);
  });
  it("rejects unknown props and point keys", () => {
    expect(() => board(scene({ colour: "red" }))).toThrow(StoryboardError);
    expect(() => board(scene({ points: [{ x: 1, y: 1, z: 3 }, { x: 2, y: 2 }] }))).toThrow(StoryboardError);
  });
  it("accepts a callout with an x anchor and rejects text over 24 chars", () => {
    expect(() => board(scene({}, [{ atWord: "rose", do: "callout", text: "Up", x: 2001 }]))).not.toThrow();
    const long = "x".repeat(25);
    expect(() => board(scene({}, [{ atWord: "rose", do: "callout", text: long, x: 2001 }]))).toThrow(StoryboardError);
  });
});

describe("facts dataset", () => {
  it("accepts any JSON dataset and rejects unknown fact keys", () => {
    const fact = { id: "f1", claim: "c", dataset: [{ x: 1, y: 2 }], source: { name: "n", url: "https://example.com/" } };
    expect(parseFacts({ facts: [fact] }).facts[0].dataset).toEqual([{ x: 1, y: 2 }]);
    expect(() => parseFacts({ facts: [{ ...fact, datset: [] }] })).toThrow(StoryboardError);
  });
});
```

`tests/unit/resolveCueX.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { composeScenes } from "../../src/pipeline/resolveScene";
import { parseStoryboard } from "../../src/schema/storyboard";

describe("composeScenes carries the cue x anchor", () => {
  it("passes x through to the resolved cue", () => {
    const sb = parseStoryboard({
      schemaVersion: 1,
      meta: { title: "t", theme: "bold-flat", voice: "v" },
      audio: { music: null },
      scenes: [{
        id: "c", type: "line-chart", narration: "It rose fast.",
        props: { title: "T", points: [{ x: 1, y: 1 }, { x: 2, y: 2 }], factId: "f1" },
        cues: [{ atWord: "rose", do: "callout", text: "Up", x: 2 }],
      }],
    });
    const words = { c: [
      { text: "It", startMs: 0, endMs: 100 }, { text: "rose", startMs: 100, endMs: 400 },
      { text: "fast.", startMs: 400, endMs: 800 },
    ] };
    const [composed] = composeScenes(sb, words, 30);
    expect(composed.cues).toEqual([{ frame: 3, do: "callout", text: "Up", x: 2 }]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/lineChartSchema.test.ts tests/unit/resolveCueX.test.ts`
Expected: FAIL (unknown scene type, unknown cue keys).

- [ ] **Step 3: Implement the schema, facts and resolver changes**

In `src/schema/storyboard.ts`:
- In `CueSchema` change `text` to `z.string().min(1).max(24).optional()` and add `x: z.number().optional(),` (keep the callout-requires-text refine).
- Add before `SceneSchema`:
```ts
const PointSchema = z.strictObject({ x: z.number(), y: z.number() });

const LineChartSceneSchema = z.strictObject({
  ...sceneBase,
  type: z.literal("line-chart"),
  props: z
    .strictObject({
      title: z.string().min(1).max(60),
      points: z.array(PointSchema).min(2).max(60),
      xFormat: z.enum(["year", "number"]).default("number"),
      prefix: z.string().max(4).default(""),
      suffix: z.string().max(6).default(""),
      decimals: z.number().int().min(0).max(4).default(0),
      tone: z.enum(TONES).default("highlight"),
      baseline: z.enum(["zero", "data"]).default("zero"),
      factId: z.string().min(1),
    })
    .superRefine((props, ctx) => {
      props.points.forEach((point, i) => {
        if (i > 0 && point.x <= props.points[i - 1].x) {
          ctx.addIssue({
            code: "custom",
            path: ["points", i, "x"],
            message: "x values must be strictly increasing",
          });
        }
      });
    }),
});
```
- Change the union to `z.discriminatedUnion("type", [TitleSceneSchema, BigNumberSceneSchema, LineChartSceneSchema])` and add `export type LineChartProps = Extract<Scene, { type: "line-chart" }>["props"];`.

In `src/schema/facts.ts` add `dataset: z.json().optional(),` to `FactSchema` (after `value`).

In `src/pipeline/resolveScene.ts` add `x?: number` to `ResolvedCue` and `x: cue.x,` to the mapped cue object.

- [ ] **Step 4: Run schema tests to verify pass**

Run: `npx vitest run tests/unit/lineChartSchema.test.ts tests/unit/resolveCueX.test.ts`
Expected: pass. (`npm run typecheck` will fail in `Video.tsx` (non-exhaustive switch) and `validate.ts` (`MAX_CALLOUTS` lookup) until Step 8; that is expected mid-task.)

- [ ] **Step 5: Write the failing validation tests `tests/unit/lineChartValidate.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { parseFacts } from "../../src/schema/facts";
import { parseStoryboard, StoryboardError } from "../../src/schema/storyboard";
import { assertCuesSupported, assertFactsTraceable } from "../../src/schema/validate";

const points = [{ x: 2000, y: 10.5 }, { x: 2001, y: 20.25 }, { x: 2002, y: 40.75 }];
const chart = (props: Record<string, unknown> = {}, cues: unknown[] = []) => ({
  id: "c1", type: "line-chart", narration: "It rose.", cues,
  props: { title: "T", points, factId: "f1", decimals: 2, ...props },
});
const board = (...scenes: unknown[]) =>
  parseStoryboard({
    schemaVersion: 1,
    meta: { title: "t", theme: "bold-flat", voice: "v" },
    audio: { music: null },
    scenes,
  });
const facts = (dataset: unknown) =>
  parseFacts({ facts: [{ id: "f1", claim: "c", dataset, source: { name: "n", url: "https://example.com/" } }] });
const callout = (x?: number) => ({ atWord: "rose", do: "callout", text: "Up", ...(x === undefined ? {} : { x }) });

describe("line-chart fact tracing", () => {
  it("passes when the dataset equals the points (key order ignored)", () => {
    const ds = points.map((p) => ({ y: p.y, x: p.x }));
    expect(() => assertFactsTraceable(board(chart()), facts(ds))).not.toThrow();
  });
  it("rejects data that differs from the fact dataset", () => {
    const ds = points.map((p, i) => (i === 1 ? { ...p, y: 99 } : p));
    expect(() => assertFactsTraceable(board(chart()), facts(ds))).toThrow(/"c1".*fact "f1"/);
  });
  it("rejects a fact with no dataset", () => {
    const noData = parseFacts({ facts: [{ id: "f1", claim: "c", source: { name: "n", url: "https://example.com/" } }] });
    expect(() => assertFactsTraceable(board(chart()), noData)).toThrow(/no dataset/);
  });
  it("rejects an unknown fact id", () => {
    expect(() => assertFactsTraceable(board(chart({ factId: "zzz" })), facts(points))).toThrow(/unknown fact "zzz"/);
  });
  it("rejects a last value that would display rounded", () => {
    expect(() => assertFactsTraceable(board(chart({ decimals: 0 })), facts(points))).toThrow(/would display/);
  });
});

describe("line-chart callout cues", () => {
  it("accepts up to 3 callouts with in-range x anchors", () => {
    const sb = board(chart({}, [callout(2000), callout(2001), callout(2002)]));
    expect(() => assertCuesSupported(sb)).not.toThrow();
  });
  it("rejects a 4th callout", () => {
    const sb = board(chart({}, [callout(2000), callout(2001), callout(2002), callout(2002)]));
    expect(() => assertCuesSupported(sb)).toThrow(/at most 3 callout/);
  });
  it("rejects a callout without x", () => {
    expect(() => assertCuesSupported(board(chart({}, [callout()])))).toThrow(/need an x anchor/);
  });
  it("rejects an x outside the chart range", () => {
    expect(() => assertCuesSupported(board(chart({}, [callout(1999)])))).toThrow(/outside.*2000-2002/);
    expect(() => assertCuesSupported(board(chart({}, [callout(2003)])))).toThrow(StoryboardError);
  });
  it("rejects an x anchor on a big-number callout", () => {
    const num = {
      id: "n", type: "big-number", narration: "Num.",
      props: { value: 1, label: "l", factId: "f1" },
      cues: [{ atWord: "num", do: "callout", text: "Up", x: 5 }],
    };
    expect(() => assertCuesSupported(board(num))).toThrow(/does not use cue x anchors/);
  });
});
```

- [ ] **Step 6: Run to verify failure**

Run: `npx vitest run tests/unit/lineChartValidate.test.ts`
Expected: FAIL (line-chart not traced, anchors unchecked).

- [ ] **Step 7: Implement validation changes in `src/schema/validate.ts`**

Replace `assertFactsTraceable` with the version below (keep imports, add `import { deepEqual } from "./deepEqual";` and `import type { Scene } from "./storyboard";` adjustments as needed), and replace `MAX_CALLOUTS`/`assertCuesSupported`:

```ts
type NumberScene = Extract<Scene, { type: "big-number" }>;
type ChartScene = Extract<Scene, { type: "line-chart" }>;
type Fact = Facts["facts"][number];

function assertNumberFact(scene: NumberScene, fact: Fact): void {
  if (fact.value === undefined) {
    throw new StoryboardError(
      `Scene "${scene.id}": fact "${fact.id}" has no value to verify the displayed number against`,
    );
  }
  if (fact.value !== scene.props.value) {
    throw new StoryboardError(
      `Scene "${scene.id}" shows ${scene.props.value} but fact "${fact.id}" says ${fact.value}`,
    );
  }
  const { value, decimals } = scene.props;
  const displayed = Number(formatNumber(value, decimals).replace(/,/g, ""));
  if (displayed !== value) {
    throw new StoryboardError(
      `Scene "${scene.id}" would display ${displayed} for value ${value} at ${decimals} decimals; use more decimals or a rounded fact`,
    );
  }
}

function assertLineChartFact(scene: ChartScene, fact: Fact): void {
  if (fact.dataset === undefined) {
    throw new StoryboardError(`Scene "${scene.id}": fact "${fact.id}" has no dataset to verify the chart against`);
  }
  if (!deepEqual(fact.dataset, scene.props.points)) {
    throw new StoryboardError(`Scene "${scene.id}": chart points do not match the dataset of fact "${fact.id}"`);
  }
  const last = scene.props.points[scene.props.points.length - 1].y;
  const displayed = Number(formatNumber(last, scene.props.decimals).replace(/,/g, ""));
  if (displayed !== last) {
    throw new StoryboardError(
      `Scene "${scene.id}" would display ${displayed} for the last value ${last} at ${scene.props.decimals} decimals; use more decimals`,
    );
  }
}

export function assertFactsTraceable(sb: Storyboard, facts: Facts): void {
  const byId = new Map(facts.facts.map((fact) => [fact.id, fact]));
  for (const scene of sb.scenes) {
    if (scene.type === "title") continue;
    const fact = byId.get(scene.props.factId);
    if (!fact) {
      throw new StoryboardError(`Scene "${scene.id}" references unknown fact "${scene.props.factId}"`);
    }
    if (scene.type === "big-number") assertNumberFact(scene, fact);
    else assertLineChartFact(scene, fact);
  }
}

const MAX_CALLOUTS: Record<Scene["type"], number> = { title: 0, "big-number": 1, "line-chart": 3 };

function assertCueAnchor(scene: Scene, cue: Scene["cues"][number]): void {
  if (scene.type === "line-chart") {
    if (cue.x === undefined) {
      throw new StoryboardError(`Scene "${scene.id}" (line-chart) callout cues need an x anchor`);
    }
    const lo = scene.props.points[0].x;
    const hi = scene.props.points[scene.props.points.length - 1].x;
    if (cue.x < lo || cue.x > hi) {
      throw new StoryboardError(
        `Scene "${scene.id}" (line-chart) cue x ${cue.x} is outside the chart's x range ${lo}-${hi}`,
      );
    }
  } else if (cue.x !== undefined) {
    throw new StoryboardError(`Scene "${scene.id}" (${scene.type}) does not use cue x anchors`);
  }
}

/** Rejects cues the scene would silently ignore at render time. */
export function assertCuesSupported(sb: Storyboard): void {
  for (const scene of sb.scenes) {
    if (scene.type === "title" && scene.cues.length > 0) {
      throw new StoryboardError(`Scene "${scene.id}" (title) does not support cues`);
    }
    const emphasize = scene.cues.find((cue) => cue.do === "emphasize");
    if (emphasize) {
      throw new StoryboardError(`Scene "${scene.id}" (${scene.type}) cannot render "emphasize" cues`);
    }
    const callouts = scene.cues.filter((cue) => cue.do === "callout").length;
    if (callouts > MAX_CALLOUTS[scene.type]) {
      throw new StoryboardError(
        `Scene "${scene.id}" (${scene.type}) supports at most ${MAX_CALLOUTS[scene.type]} callout cue; got ${callouts}`,
      );
    }
    for (const cue of scene.cues) assertCueAnchor(scene, cue);
  }
}
```
Keep `assertHeadlinesFit`, `assertVariety`, `assertDuration` and the exported constants unchanged. The message for max callouts must still read `at most N callout` (existing tests match `/"n".*at most 1 callout/`).

- [ ] **Step 8: Build the callout badge and the LineChart component, wire into Video**

`src/charts/CalloutBadge.tsx`:
```tsx
import React from "react";
import { DISPLAY_FONT } from "../design/fonts";
import { PALETTE } from "../design/tokens";
import { BADGE, type PlacedBadge } from "./layout";

type Props = {
  badge: PlacedBadge;
  text: string;
  anchorX: number;
  anchorY: number;
  scale: number;
  color: string;
};

/** SVG callout: a stem from the data point to a tilted flat badge with a hard offset shadow. */
export const CalloutBadge: React.FC<Props> = ({ badge, text, anchorX, anchorY, scale, color }) => (
  <g opacity={Math.min(1, scale)}>
    <line x1={anchorX} y1={anchorY} x2={badge.x} y2={badge.y} stroke={color} strokeWidth={6} strokeLinecap="round" />
    <g transform={`translate(${badge.x} ${badge.y}) rotate(-3) scale(${scale})`}>
      <rect
        x={-badge.width / 2 + 8} y={-BADGE.heightPx / 2 + 8}
        width={badge.width} height={BADGE.heightPx}
        fill={PALETTE.ink} fillOpacity={0.2}
      />
      <rect x={-badge.width / 2} y={-BADGE.heightPx / 2} width={badge.width} height={BADGE.heightPx} fill={color} />
      <text
        textAnchor="middle" y={BADGE.fontPx * 0.35}
        fontFamily={DISPLAY_FONT} fontSize={BADGE.fontPx} fill={PALETTE.ground}
      >
        {text}
      </text>
    </g>
  </g>
);
```

`src/scenes/line-chart/LineChart.tsx`:
```tsx
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { scaleLinear } from "d3-scale";
import { area as d3area, curveMonotoneX, line as d3line } from "d3-shape";
import { CalloutBadge } from "../../charts/CalloutBadge";
import {
  cursorX, decimalsForStep, niceTicks, pointOnPathAtX, valueAtX, yDomainAt,
  type DataPoint, type Domain,
} from "../../charts/geometry";
import { CHART_BOX, placeBadge } from "../../charts/layout";
import { BODY_FONT, DISPLAY_FONT } from "../../design/fonts";
import { fitFontSize, formatNumber } from "../../design/layout";
import { dataFrameAt, dataProgress, popIn, staggerDelay, sustainDrift } from "../../design/motion";
import { PALETTE, SAFE, VIDEO } from "../../design/tokens";
import type { LineChartProps } from "../../schema/storyboard";
import type { SceneRenderProps } from "../types";

const DRAW_START = 14;
const DRAW_SHARE = 0.7; // fraction of the scene spent drawing the line
const LINE_WIDTH = 16;

export const LineChart: React.FC<SceneRenderProps<LineChartProps>> = ({ props, cues, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tone = PALETTE[props.tone];
  const { points } = props;

  const drawFrames = Math.max(30, Math.round(durationFrames * DRAW_SHARE) - DRAW_START);
  const progress = dataProgress(frame, DRAW_START, drawFrames);
  const cx = cursorX(points, progress);
  const xDomain: Domain = [points[0].x, points[points.length - 1].x];
  const yDomain = yDomainAt(points, progress, props.baseline);
  const sx = scaleLinear().domain([xDomain[0], xDomain[1]]).range([CHART_BOX.left, CHART_BOX.right]);
  const sy = scaleLinear().domain([yDomain[0], yDomain[1]]).range([CHART_BOX.bottom, CHART_BOX.top]);
  const toX = (d: DataPoint) => sx(d.x);
  const toY = (d: DataPoint) => sy(d.y);
  const linePath = d3line<DataPoint>().x(toX).y(toY).curve(curveMonotoneX)(points) ?? "";
  const areaPath = d3area<DataPoint>().x(toX).y0(CHART_BOX.bottom).y1(toY).curve(curveMonotoneX)(points) ?? "";
  const tip = pointOnPathAtX(linePath, sx(cx));

  const fmt = (v: number, decimals: number) => `${props.prefix}${formatNumber(v, decimals)}${props.suffix}`;
  const readout = fmt(valueAtX(points, cx), props.decimals);
  const readoutSize = fitFontSize(fmt(points[points.length - 1].y, props.decimals), VIDEO.width - 2 * SAFE.side, 220);

  const yTicks = niceTicks(yDomain, 4);
  const yTickDecimals = decimalsForStep(yTicks.length > 1 ? yTicks[1] - yTicks[0] : 1);
  const rawXTicks = niceTicks(xDomain, 5);
  const xTicks = props.xFormat === "year" ? rawXTicks.filter(Number.isInteger) : rawXTicks;
  const xTickDecimals = props.xFormat === "year" ? 0 : decimalsForStep(rawXTicks.length > 1 ? rawXTicks[1] - rawXTicks[0] : 1);
  const xLabel = (t: number) => (props.xFormat === "year" ? String(t) : formatNumber(t, xTickDecimals));

  const titleIn = Math.min(1, popIn(frame, fps, 0));
  const dotIn = Math.min(1, popIn(frame, fps, DRAW_START));
  const exit = interpolate(frame, [durationFrames - 8, durationFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const span = xDomain[1] - xDomain[0];

  return (
    <AbsoluteFill style={{ background: PALETTE.ground, opacity: exit }}>
      <div style={{ position: "absolute", left: SAFE.side, top: SAFE.top, width: VIDEO.width - 2 * SAFE.side }}>
        <div
          style={{
            fontFamily: BODY_FONT, fontSize: 52, color: PALETTE.ink, opacity: 0.85,
            transform: `scale(${titleIn})`, transformOrigin: "left center",
          }}
        >
          {props.title}
        </div>
        <div
          style={{
            fontFamily: DISPLAY_FONT, fontSize: readoutSize, lineHeight: 1.05, color: tone,
            fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", marginTop: 24,
          }}
        >
          {readout}
        </div>
      </div>

      <svg width={VIDEO.width} height={VIDEO.height} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <clipPath id="line-reveal">
            <rect x={0} y={0} width={sx(cx)} height={VIDEO.height} />
          </clipPath>
        </defs>

        {yTicks.map((t, i) => {
          const y = sy(t);
          const fade =
            Math.min(1, Math.max(0, (y - CHART_BOX.top) / 60)) * Math.min(1, popIn(frame, fps, staggerDelay(i, 3)));
          return (
            <g key={t} opacity={fade}>
              <line x1={CHART_BOX.left} x2={CHART_BOX.right} y1={y} y2={y} stroke={PALETTE.ink} strokeOpacity={0.14} strokeWidth={3} />
              <text x={CHART_BOX.left} y={y - 12} fontFamily={BODY_FONT} fontSize={34} fill={PALETTE.ink} fillOpacity={0.55}>
                {fmt(t, yTickDecimals)}
              </text>
            </g>
          );
        })}
        <line
          x1={CHART_BOX.left} x2={CHART_BOX.right} y1={CHART_BOX.bottom} y2={CHART_BOX.bottom}
          stroke={PALETTE.ink} strokeOpacity={0.35} strokeWidth={4}
        />
        {xTicks.map((t) => (
          <text
            key={t} x={sx(t)} y={CHART_BOX.bottom + 56} textAnchor="middle"
            fontFamily={BODY_FONT} fontSize={34} fill={PALETTE.ink} fillOpacity={0.55}
          >
            {xLabel(t)}
          </text>
        ))}

        <g clipPath="url(#line-reveal)">
          <path d={areaPath} fill={tone} fillOpacity={0.2} />
          <path d={linePath} fill="none" stroke={tone} strokeWidth={LINE_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
        </g>

        <g transform={`translate(${tip.x} ${tip.y})`} opacity={dotIn}>
          <circle r={40 + sustainDrift(frame, 8, 30)} fill="none" stroke={tone} strokeWidth={8} strokeOpacity={0.5} />
          <circle r={24} fill={PALETTE.ink} />
          <circle r={11} fill={tone} />
        </g>

        {cues
          .filter((c) => c.do === "callout" && c.text !== undefined && c.x !== undefined)
          .map((c) => {
            const anchorXValue = c.x as number;
            const reach = dataFrameAt((anchorXValue - xDomain[0]) / span, DRAW_START, drawFrames);
            const appear = Math.max(c.frame, Math.ceil(reach));
            if (frame < appear) return null;
            const ax = sx(anchorXValue);
            const ay = sy(valueAtX(points, anchorXValue));
            return (
              <CalloutBadge
                key={`${c.frame}-${c.x}`} badge={placeBadge(ax, ay, c.text as string)} text={c.text as string}
                anchorX={ax} anchorY={ay} scale={popIn(frame, fps, appear)} color={tone}
              />
            );
          })}
      </svg>
    </AbsoluteFill>
  );
};
```

In `src/compose/Video.tsx` add `import { LineChart } from "../scenes/line-chart/LineChart";` and a case:
```tsx
    case "line-chart":
      return <LineChart props={scene.props} cues={cues} durationFrames={durationFrames} />;
```

- [ ] **Step 9: Run typecheck and all unit tests**

Run: `npm run typecheck && npm test`
Expected: typecheck clean (the scene union is exhaustive again); all unit tests, including the Task 6 validation tests, pass.

- [ ] **Step 10: Defer visual verification**

The line-chart visuals cannot be rendered until a composition with chart data exists. They are verified in Task 8 Step 6 (`FinanceDemo`) and locked in by Task 9's snapshots. Note this in the ledger; do not add any throwaway composition.

- [ ] **Step 11: Checkpoint** (only if asked): `feat: line-chart scene with fact-traced data`

---

### Task 7: Bar-race scene end to end

**Files:**
- Modify: `src/schema/storyboard.ts`, `src/schema/validate.ts`, `src/compose/Video.tsx`
- Create: `src/scenes/bar-race/BarRace.tsx`
- Test: `tests/unit/barRaceSchema.test.ts`, `tests/unit/barRaceValidate.test.ts`

**Interfaces:**
- Consumes: `raceStateAt` (Task 4), `CATEGORICAL` (Task 2), `placeBadge`/`CHART_BOX` (Task 3), `CalloutBadge` (Task 6).
- Produces: scene type `"bar-race"` with props `{ title, frames: RaceFrame[2..20] (each 2..12 values, value >= 0, unique names per frame, unique labels), prefix, suffix, decimals, topN (3..8, default 5), factId }`, type `BarRaceProps`; `MAX_CALLOUTS["bar-race"] = 1`; `BarRace` component.

- [ ] **Step 1: Write the failing tests**

`tests/unit/barRaceSchema.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseStoryboard, StoryboardError } from "../../src/schema/storyboard";

const frames = [
  { label: "2020", values: [{ name: "A", value: 1 }, { name: "B", value: 2 }] },
  { label: "2021", values: [{ name: "A", value: 3 }, { name: "B", value: 2 }] },
];
const scene = (props: Record<string, unknown> = {}) => ({
  id: "r1", type: "bar-race", narration: "Race.",
  props: { title: "T", frames, factId: "f1", ...props },
});
const board = (s: unknown) =>
  parseStoryboard({
    schemaVersion: 1,
    meta: { title: "t", theme: "bold-flat", voice: "v" },
    audio: { music: null },
    scenes: [s],
  });

describe("bar-race schema", () => {
  it("parses with defaults", () => {
    const sc = board(scene()).scenes[0];
    if (sc.type !== "bar-race") throw new Error("expected bar-race");
    expect(sc.props).toMatchObject({ topN: 5, decimals: 0, prefix: "", suffix: "" });
  });
  it("rejects fewer than 2 frames, fewer than 2 values, and out-of-range topN", () => {
    expect(() => board(scene({ frames: [frames[0]] }))).toThrow(StoryboardError);
    expect(() => board(scene({ frames: [{ label: "a", values: [{ name: "A", value: 1 }] }, frames[1]] }))).toThrow(StoryboardError);
    expect(() => board(scene({ topN: 2 }))).toThrow(StoryboardError);
    expect(() => board(scene({ topN: 9 }))).toThrow(StoryboardError);
  });
  it("rejects negative, NaN and Infinity values", () => {
    for (const bad of [-1, NaN, Infinity]) {
      const f = [{ label: "a", values: [{ name: "A", value: bad }, { name: "B", value: 1 }] }, frames[1]];
      expect(() => board(scene({ frames: f }))).toThrow(StoryboardError);
    }
  });
  it("rejects duplicate frame labels and duplicate names within a frame", () => {
    expect(() => board(scene({ frames: [frames[0], { ...frames[1], label: "2020" }] }))).toThrow(/duplicate frame label/);
    const dup = [{ label: "a", values: [{ name: "A", value: 1 }, { name: "A", value: 2 }] }, frames[1]];
    expect(() => board(scene({ frames: dup }))).toThrow(/duplicate name/);
  });
  it("rejects names over 18 characters", () => {
    const long = [{ label: "a", values: [{ name: "x".repeat(19), value: 1 }, { name: "B", value: 1 }] }, frames[1]];
    expect(() => board(scene({ frames: long }))).toThrow(StoryboardError);
  });
});
```

`tests/unit/barRaceValidate.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseFacts } from "../../src/schema/facts";
import { parseStoryboard } from "../../src/schema/storyboard";
import { assertCuesSupported, assertFactsTraceable } from "../../src/schema/validate";

const frames = [
  { label: "2020", values: [{ name: "A", value: 1 }, { name: "B", value: 2 }] },
  { label: "2021", values: [{ name: "A", value: 3 }, { name: "B", value: 2 }] },
];
const race = (cues: unknown[] = []) => ({
  id: "r1", type: "bar-race", narration: "Race.", cues,
  props: { title: "T", frames, factId: "f1" },
});
const board = (s: unknown) =>
  parseStoryboard({
    schemaVersion: 1,
    meta: { title: "t", theme: "bold-flat", voice: "v" },
    audio: { music: null },
    scenes: [s],
  });
const facts = (dataset?: unknown) =>
  parseFacts({ facts: [{ id: "f1", claim: "c", dataset, source: { name: "n", url: "https://example.com/" } }] });

describe("bar-race fact tracing", () => {
  it("passes when the dataset equals the frames", () => {
    expect(() => assertFactsTraceable(board(race()), facts(frames))).not.toThrow();
  });
  it("rejects different data and missing datasets", () => {
    const changed = [frames[0], { ...frames[1], values: [{ name: "A", value: 4 }, { name: "B", value: 2 }] }];
    expect(() => assertFactsTraceable(board(race()), facts(changed))).toThrow(/"r1".*fact "f1"/);
    expect(() => assertFactsTraceable(board(race()), facts(undefined))).toThrow(/no dataset/);
  });
});

describe("bar-race callouts", () => {
  const callout = { atWord: "race", do: "callout", text: "New leader" };
  it("allows one callout without an x anchor", () => {
    expect(() => assertCuesSupported(board(race([callout])))).not.toThrow();
  });
  it("rejects two callouts and any x anchor", () => {
    expect(() => assertCuesSupported(board(race([callout, callout])))).toThrow(/at most 1 callout/);
    expect(() => assertCuesSupported(board(race([{ ...callout, x: 1 }])))).toThrow(/does not use cue x anchors/);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/barRaceSchema.test.ts tests/unit/barRaceValidate.test.ts`
Expected: FAIL (unknown scene type).

- [ ] **Step 3: Implement schema and validation**

In `src/schema/storyboard.ts` add before `SceneSchema`:
```ts
const RaceFrameSchema = z
  .strictObject({
    label: z.string().min(1).max(12),
    values: z
      .array(z.strictObject({ name: z.string().min(1).max(18), value: z.number().min(0) }))
      .min(2)
      .max(12),
  })
  .superRefine((frame, ctx) => {
    const seen = new Set<string>();
    frame.values.forEach((v, i) => {
      if (seen.has(v.name)) {
        ctx.addIssue({ code: "custom", path: ["values", i, "name"], message: `duplicate name "${v.name}" in frame "${frame.label}"` });
      }
      seen.add(v.name);
    });
  });

const BarRaceSceneSchema = z.strictObject({
  ...sceneBase,
  type: z.literal("bar-race"),
  props: z
    .strictObject({
      title: z.string().min(1).max(60),
      frames: z.array(RaceFrameSchema).min(2).max(20),
      prefix: z.string().max(4).default(""),
      suffix: z.string().max(6).default(""),
      decimals: z.number().int().min(0).max(4).default(0),
      topN: z.number().int().min(3).max(8).default(5),
      factId: z.string().min(1),
    })
    .superRefine((props, ctx) => {
      const seen = new Set<string>();
      props.frames.forEach((frame, i) => {
        if (seen.has(frame.label)) {
          ctx.addIssue({ code: "custom", path: ["frames", i, "label"], message: `duplicate frame label "${frame.label}"` });
        }
        seen.add(frame.label);
      });
    }),
});
```
Add it to the union, and `export type BarRaceProps = Extract<Scene, { type: "bar-race" }>["props"];`.

In `src/schema/validate.ts` add `type RaceScene = Extract<Scene, { type: "bar-race" }>;`, add
```ts
function assertBarRaceFact(scene: RaceScene, fact: Fact): void {
  if (fact.dataset === undefined) {
    throw new StoryboardError(`Scene "${scene.id}": fact "${fact.id}" has no dataset to verify the race against`);
  }
  if (!deepEqual(fact.dataset, scene.props.frames)) {
    throw new StoryboardError(`Scene "${scene.id}": race frames do not match the dataset of fact "${fact.id}"`);
  }
}
```
change the dispatch in `assertFactsTraceable` to
```ts
    if (scene.type === "big-number") assertNumberFact(scene, fact);
    else if (scene.type === "line-chart") assertLineChartFact(scene, fact);
    else assertBarRaceFact(scene, fact);
```
and `MAX_CALLOUTS` to `{ title: 0, "big-number": 1, "line-chart": 3, "bar-race": 1 }`.

- [ ] **Step 4: Run schema/validation tests to verify pass**

Run: `npx vitest run tests/unit/barRaceSchema.test.ts tests/unit/barRaceValidate.test.ts`
Expected: pass. (Typecheck fails only in `Video.tsx` until Step 5.)

- [ ] **Step 5: Build the BarRace component and wire it**

`src/scenes/bar-race/BarRace.tsx`:
```tsx
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { CalloutBadge } from "../../charts/CalloutBadge";
import { CHART_BOX, placeBadge } from "../../charts/layout";
import { raceStateAt } from "../../charts/race";
import { BODY_FONT, DISPLAY_FONT } from "../../design/fonts";
import { fitFontSize, formatNumber } from "../../design/layout";
import { dataProgress, popIn } from "../../design/motion";
import { CATEGORICAL, PALETTE, SAFE, VIDEO } from "../../design/tokens";
import type { BarRaceProps } from "../../schema/storyboard";
import type { SceneRenderProps } from "../types";

const RACE_START = 10;
const RACE_SHARE = 0.8;
const BARS_TOP = 640;
const BARS_BOTTOM = VIDEO.height - SAFE.bottom;
const MAX_PITCH = 150;
const NAME_ROW = 36;
const VALUE_ROOM = 300;
const MAX_BAR_WIDTH = CHART_BOX.right - CHART_BOX.left - VALUE_ROOM;

export const BarRace: React.FC<SceneRenderProps<BarRaceProps>> = ({ props, cues, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tone = PALETTE.highlight;
  const n = props.frames.length;

  const raceFrames = Math.max(40, Math.round(durationFrames * RACE_SHARE) - RACE_START);
  const progress = dataProgress(frame, RACE_START, raceFrames);
  const state = raceStateAt(props.frames, (n - 1) * progress, props.topN);
  const grow = dataProgress(frame, 0, 18);

  const pitch = Math.min(MAX_PITCH, (BARS_BOTTOM - BARS_TOP) / props.topN);
  const barH = pitch - NAME_ROW - 14;
  const fmt = (v: number) => `${props.prefix}${formatNumber(v, props.decimals)}${props.suffix}`;
  const maxValue = Math.max(...props.frames.flatMap((f) => f.values.map((v) => v.value)));
  const valueFont = fitFontSize(fmt(maxValue), VALUE_ROOM - 16, barH * 0.5);

  const titleIn = Math.min(1, popIn(frame, fps, 0));
  const exit = interpolate(frame, [durationFrames - 8, durationFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const leader = state.bars[0];
  const callout = cues.find((c) => c.do === "callout" && c.text !== undefined);
  const calloutNode = (() => {
    if (!callout || !leader || frame < callout.frame) return null;
    const w = Math.max(0, (leader.value / state.axisMax) * MAX_BAR_WIDTH * grow);
    const ax = CHART_BOX.left + w;
    const ay = BARS_TOP + leader.rank * pitch + NAME_ROW + barH / 2;
    return (
      <CalloutBadge
        badge={placeBadge(ax, ay, callout.text as string, SAFE.top + 160)} text={callout.text as string}
        anchorX={ax} anchorY={ay} scale={popIn(frame, fps, callout.frame)} color={tone}
      />
    );
  })();

  return (
    <AbsoluteFill style={{ background: PALETTE.ground, opacity: exit }}>
      <div
        style={{
          position: "absolute", left: SAFE.side, top: SAFE.top,
          fontFamily: BODY_FONT, fontSize: 52, color: PALETTE.ink, opacity: 0.85,
          transform: `scale(${titleIn})`, transformOrigin: "left center",
        }}
      >
        {props.title}
      </div>

      <svg width={VIDEO.width} height={VIDEO.height} style={{ position: "absolute", inset: 0 }}>
        <text
          x={CHART_BOX.right} y={BARS_TOP + props.topN * pitch - 20} textAnchor="end"
          fontFamily={DISPLAY_FONT} fontSize={260} fill={PALETTE.ink} fillOpacity={0.1}
        >
          {state.label}
        </text>

        {state.bars.map((bar) => {
          const w = Math.max(0, (bar.value / state.axisMax) * MAX_BAR_WIDTH * grow);
          const color = CATEGORICAL[bar.colorIndex % CATEGORICAL.length];
          return (
            <g key={bar.name} opacity={bar.opacity} transform={`translate(${CHART_BOX.left} ${BARS_TOP + bar.rank * pitch})`}>
              <text y={28} fontFamily={BODY_FONT} fontSize={34} fill={PALETTE.ink}>
                {bar.name}
              </text>
              <rect x={8} y={NAME_ROW + 8} width={w} height={barH} fill={PALETTE.ink} fillOpacity={0.16} />
              <rect y={NAME_ROW} width={w} height={barH} fill={color} />
              <text
                x={w + 16} y={NAME_ROW + barH * 0.68}
                fontFamily={DISPLAY_FONT} fontSize={valueFont} fill={PALETTE.ink}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {fmt(bar.value)}
              </text>
            </g>
          );
        })}
        {calloutNode}
      </svg>
    </AbsoluteFill>
  );
};
```
In `src/compose/Video.tsx` add `import { BarRace } from "../scenes/bar-race/BarRace";` and the case:
```tsx
    case "bar-race":
      return <BarRace props={scene.props} cues={cues} durationFrames={durationFrames} />;
```

- [ ] **Step 6: Run typecheck and all unit tests**

Run: `npm run typecheck && npm test`
Expected: clean and all pass. Visual verification happens in Task 8 (same reason as Task 6 Step 10).

- [ ] **Step 7: Checkpoint** (only if asked): `feat: bar-race scene with fact-traced data`

---

### Task 8: Finance demo fixtures, composition, and visual review

**Files:**
- Create: `fixtures/synthWords.ts`, `fixtures/finance.storyboard.json`, `fixtures/finance.facts.json`
- Modify: `src/Root.tsx`, `package.json` (scripts)
- Test: `tests/unit/synthWords.test.ts`, `tests/unit/financeDemo.test.ts`

**Interfaces:**
- Consumes: `buildVideo` (Task 5), all scenes.
- Produces: `synthWords(narration: string, msPerChar = 55, baseMs = 90, gapMs = 40): WordTiming[]`; composition id `FinanceDemo`; npm scripts `render:finance`, `still:finance`.

The words are synthetic stand-ins for TTS timings (documented in the helper). All numbers in the fixtures are demo data: the S&P 500 and CPI series are approximately real but unverified, and the bar-race companies and values are fictional.

- [ ] **Step 1: Write the failing tests**

`tests/unit/synthWords.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { synthWords } from "../../fixtures/synthWords";

describe("synthWords (stand-in for TTS word timings)", () => {
  it("returns one ordered, finite timing per whitespace-separated token", () => {
    const words = synthWords("The index fell, then climbed.");
    expect(words.map((w) => w.text)).toEqual(["The", "index", "fell,", "then", "climbed."]);
    let prev = -1;
    for (const w of words) {
      expect(Number.isFinite(w.startMs) && Number.isFinite(w.endMs)).toBe(true);
      expect(w.endMs).toBeGreaterThan(w.startMs);
      expect(w.startMs).toBeGreaterThan(prev);
      prev = w.startMs;
    }
  });
  it("makes longer words last longer", () => {
    const [short, long] = synthWords("a extraordinarily");
    expect(long.endMs - long.startMs).toBeGreaterThan(short.endMs - short.startMs);
  });
  it("returns an empty list for blank narration", () => {
    expect(synthWords("   ")).toEqual([]);
  });
});
```

`tests/unit/financeDemo.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import facts from "../../fixtures/finance.facts.json";
import storyboard from "../../fixtures/finance.storyboard.json";
import { synthWords } from "../../fixtures/synthWords";
import { buildVideo } from "../../src/pipeline/buildVideo";

const build = () =>
  buildVideo(
    storyboard, facts,
    (sb) => Object.fromEntries(sb.scenes.map((s) => [s.id, synthWords(s.narration)])),
    30,
  );

describe("finance demo fixtures", () => {
  it("pass every validation rule and compose", () => {
    expect(() => build()).not.toThrow();
  });
  it("run between 20 and 45 seconds", () => {
    const { totalFrames } = build();
    expect(totalFrames).toBeGreaterThanOrEqual(20 * 30);
    expect(totalFrames).toBeLessThanOrEqual(45 * 30);
  });
  it("give each chart scene enough time to draw and every cue a frame inside its scene", () => {
    for (const scene of build().scenes) {
      if (scene.scene.type === "line-chart" || scene.scene.type === "bar-race") {
        expect(scene.durationFrames).toBeGreaterThanOrEqual(120);
      }
      for (const cue of scene.cues) {
        expect(cue.frame).toBeGreaterThanOrEqual(0);
        expect(cue.frame).toBeLessThan(scene.durationFrames);
      }
    }
  });
  it("covers all four scene types", () => {
    const types = new Set(build().scenes.map((s) => s.scene.type));
    expect([...types].sort()).toEqual(["bar-race", "big-number", "line-chart", "title"]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/synthWords.test.ts tests/unit/financeDemo.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Create `fixtures/synthWords.ts`**

```ts
import type { WordTiming } from "../src/schema/timing";

/**
 * Synthetic word timings: a deterministic stand-in for TTS output so cues and scene durations can
 * be exercised without a voice. Each word lasts baseMs + msPerChar * length, separated by gapMs.
 * Replaced by the real voice step (and its number-splitting normalizer) in a later plan.
 */
export function synthWords(narration: string, msPerChar = 55, baseMs = 90, gapMs = 40): WordTiming[] {
  const tokens = narration.split(/\s+/).filter(Boolean);
  let cursor = 0;
  return tokens.map((text) => {
    const duration = baseMs + msPerChar * text.length;
    const word = { text, startMs: cursor, endMs: cursor + duration };
    cursor += duration + gapMs;
    return word;
  });
}
```

- [ ] **Step 4: Create the fixtures**

`fixtures/finance.storyboard.json`:
```json
{
  "schemaVersion": 1,
  "meta": { "title": "Finance Demo", "theme": "bold-flat", "voice": "en-US-AndrewNeural" },
  "audio": { "music": null },
  "scenes": [
    {
      "id": "intro",
      "type": "title",
      "narration": "Seventeen years of the S and P five hundred, in under a minute.",
      "props": { "headline": "17 Years of the S&P 500", "kicker": "INVESTING" }
    },
    {
      "id": "sp500",
      "type": "line-chart",
      "narration": "The index fell to nine hundred in two thousand eight, then climbed past forty seven hundred.",
      "props": {
        "title": "S&P 500 year-end close",
        "xFormat": "year",
        "decimals": 2,
        "tone": "highlight",
        "factId": "f-sp",
        "points": [
          { "x": 2007, "y": 1468.36 }, { "x": 2008, "y": 903.25 }, { "x": 2009, "y": 1115.1 },
          { "x": 2010, "y": 1257.64 }, { "x": 2011, "y": 1257.6 }, { "x": 2012, "y": 1426.19 },
          { "x": 2013, "y": 1848.36 }, { "x": 2014, "y": 2058.9 }, { "x": 2015, "y": 2043.94 },
          { "x": 2016, "y": 2238.83 }, { "x": 2017, "y": 2673.61 }, { "x": 2018, "y": 2506.85 },
          { "x": 2019, "y": 3230.78 }, { "x": 2020, "y": 3756.07 }, { "x": 2021, "y": 4766.18 },
          { "x": 2022, "y": 3839.5 }, { "x": 2023, "y": 4769.83 }
        ]
      },
      "cues": [
        { "atWord": "fell", "do": "callout", "text": "2008: 903", "x": 2008 },
        { "atWord": "climbed", "do": "callout", "text": "2021: 4,766", "x": 2021 }
      ]
    },
    {
      "id": "drop",
      "type": "big-number",
      "narration": "Peak to trough, it lost fifty seven percent of its value.",
      "props": { "value": 57, "suffix": "%", "label": "peak-to-trough drop", "factId": "f-drop", "tone": "negative" },
      "cues": [{ "atWord": "fifty", "do": "callout", "text": "Over half" }]
    },
    {
      "id": "race",
      "type": "bar-race",
      "narration": "Meanwhile, the race for the biggest company kept changing hands.",
      "props": {
        "title": "Market cap, $B (synthetic data)",
        "prefix": "$",
        "suffix": "B",
        "topN": 5,
        "factId": "f-race",
        "frames": [
          { "label": "2018", "values": [{ "name": "Northwind", "value": 520 }, { "name": "Contoso", "value": 480 }, { "name": "Globex", "value": 300 }, { "name": "Initech", "value": 260 }, { "name": "Umbrella", "value": 190 }, { "name": "Hooli", "value": 120 }] },
          { "label": "2019", "values": [{ "name": "Northwind", "value": 560 }, { "name": "Contoso", "value": 610 }, { "name": "Globex", "value": 340 }, { "name": "Initech", "value": 300 }, { "name": "Umbrella", "value": 250 }, { "name": "Hooli", "value": 180 }] },
          { "label": "2020", "values": [{ "name": "Northwind", "value": 640 }, { "name": "Contoso", "value": 820 }, { "name": "Globex", "value": 410 }, { "name": "Initech", "value": 520 }, { "name": "Umbrella", "value": 280 }, { "name": "Hooli", "value": 330 }] },
          { "label": "2021", "values": [{ "name": "Northwind", "value": 700 }, { "name": "Contoso", "value": 1010 }, { "name": "Globex", "value": 520 }, { "name": "Initech", "value": 880 }, { "name": "Umbrella", "value": 300 }, { "name": "Hooli", "value": 640 }, { "name": "Vandelay", "value": 450 }] },
          { "label": "2022", "values": [{ "name": "Northwind", "value": 690 }, { "name": "Contoso", "value": 960 }, { "name": "Globex", "value": 540 }, { "name": "Initech", "value": 940 }, { "name": "Umbrella", "value": 360 }, { "name": "Hooli", "value": 810 }, { "name": "Vandelay", "value": 600 }] },
          { "label": "2023", "values": [{ "name": "Northwind", "value": 720 }, { "name": "Contoso", "value": 1020 }, { "name": "Globex", "value": 560 }, { "name": "Initech", "value": 1180 }, { "name": "Umbrella", "value": 400 }, { "name": "Hooli", "value": 990 }, { "name": "Vandelay", "value": 760 }] }
        ]
      },
      "cues": [{ "atWord": "changing", "do": "callout", "text": "New leader" }]
    },
    {
      "id": "cpi",
      "type": "line-chart",
      "narration": "Then inflation spiked to eight percent in twenty twenty two.",
      "props": {
        "title": "US CPI inflation, yearly",
        "xFormat": "year",
        "suffix": "%",
        "decimals": 1,
        "tone": "negative",
        "factId": "f-cpi",
        "points": [
          { "x": 2015, "y": 0.1 }, { "x": 2016, "y": 1.3 }, { "x": 2017, "y": 2.1 },
          { "x": 2018, "y": 2.4 }, { "x": 2019, "y": 1.8 }, { "x": 2020, "y": 1.2 },
          { "x": 2021, "y": 4.7 }, { "x": 2022, "y": 8.0 }, { "x": 2023, "y": 4.1 }
        ]
      },
      "cues": [{ "atWord": "spiked", "do": "callout", "text": "2022: 8.0%", "x": 2022 }]
    }
  ]
}
```

`fixtures/finance.facts.json` (the `dataset` values MUST equal the scene data above exactly; copy them verbatim):
```json
{
  "facts": [
    {
      "id": "f-sp",
      "claim": "S&P 500 year-end close, 2007-2023 (demo data; verify before publishing)",
      "dataset": [
        { "x": 2007, "y": 1468.36 }, { "x": 2008, "y": 903.25 }, { "x": 2009, "y": 1115.1 },
        { "x": 2010, "y": 1257.64 }, { "x": 2011, "y": 1257.6 }, { "x": 2012, "y": 1426.19 },
        { "x": 2013, "y": 1848.36 }, { "x": 2014, "y": 2058.9 }, { "x": 2015, "y": 2043.94 },
        { "x": 2016, "y": 2238.83 }, { "x": 2017, "y": 2673.61 }, { "x": 2018, "y": 2506.85 },
        { "x": 2019, "y": 3230.78 }, { "x": 2020, "y": 3756.07 }, { "x": 2021, "y": 4766.18 },
        { "x": 2022, "y": 3839.5 }, { "x": 2023, "y": 4769.83 }
      ],
      "source": { "name": "S&P Dow Jones Indices", "url": "https://www.spglobal.com/spdji/en/indices/equity/sp-500/" }
    },
    {
      "id": "f-drop",
      "claim": "S&P 500 peak-to-trough decline, Oct 2007 to Mar 2009 (demo data)",
      "value": 57,
      "source": { "name": "S&P Dow Jones Indices", "url": "https://www.spglobal.com/spdji/en/indices/equity/sp-500/" }
    },
    {
      "id": "f-race",
      "claim": "Fictional companies, synthetic market caps (demo data only)",
      "dataset": [
        { "label": "2018", "values": [{ "name": "Northwind", "value": 520 }, { "name": "Contoso", "value": 480 }, { "name": "Globex", "value": 300 }, { "name": "Initech", "value": 260 }, { "name": "Umbrella", "value": 190 }, { "name": "Hooli", "value": 120 }] },
        { "label": "2019", "values": [{ "name": "Northwind", "value": 560 }, { "name": "Contoso", "value": 610 }, { "name": "Globex", "value": 340 }, { "name": "Initech", "value": 300 }, { "name": "Umbrella", "value": 250 }, { "name": "Hooli", "value": 180 }] },
        { "label": "2020", "values": [{ "name": "Northwind", "value": 640 }, { "name": "Contoso", "value": 820 }, { "name": "Globex", "value": 410 }, { "name": "Initech", "value": 520 }, { "name": "Umbrella", "value": 280 }, { "name": "Hooli", "value": 330 }] },
        { "label": "2021", "values": [{ "name": "Northwind", "value": 700 }, { "name": "Contoso", "value": 1010 }, { "name": "Globex", "value": 520 }, { "name": "Initech", "value": 880 }, { "name": "Umbrella", "value": 300 }, { "name": "Hooli", "value": 640 }, { "name": "Vandelay", "value": 450 }] },
        { "label": "2022", "values": [{ "name": "Northwind", "value": 690 }, { "name": "Contoso", "value": 960 }, { "name": "Globex", "value": 540 }, { "name": "Initech", "value": 940 }, { "name": "Umbrella", "value": 360 }, { "name": "Hooli", "value": 810 }, { "name": "Vandelay", "value": 600 }] },
        { "label": "2023", "values": [{ "name": "Northwind", "value": 720 }, { "name": "Contoso", "value": 1020 }, { "name": "Globex", "value": 560 }, { "name": "Initech", "value": 1180 }, { "name": "Umbrella", "value": 400 }, { "name": "Hooli", "value": 990 }, { "name": "Vandelay", "value": 760 }] }
      ],
      "source": { "name": "Synthetic demo data", "url": "https://example.com/synthetic-demo-data" }
    },
    {
      "id": "f-cpi",
      "claim": "US CPI annual average inflation, 2015-2023 (demo data; verify before publishing)",
      "dataset": [
        { "x": 2015, "y": 0.1 }, { "x": 2016, "y": 1.3 }, { "x": 2017, "y": 2.1 },
        { "x": 2018, "y": 2.4 }, { "x": 2019, "y": 1.8 }, { "x": 2020, "y": 1.2 },
        { "x": 2021, "y": 4.7 }, { "x": 2022, "y": 8.0 }, { "x": 2023, "y": 4.1 }
      ],
      "source": { "name": "US Bureau of Labor Statistics", "url": "https://www.bls.gov/cpi/" }
    }
  ]
}
```

- [ ] **Step 5: Register `FinanceDemo` in `src/Root.tsx`**

Add imports:
```tsx
import financeFacts from "../fixtures/finance.facts.json";
import financeStoryboard from "../fixtures/finance.storyboard.json";
import { synthWords } from "../fixtures/synthWords";
```
Add below `hello`:
```tsx
const finance = buildVideo(
  financeStoryboard,
  financeFacts,
  (sb) => Object.fromEntries(sb.scenes.map((s) => [s.id, synthWords(s.narration)])),
  VIDEO.fps,
);
```
Add a composition inside `RemotionRoot` (same shape as the hello one):
```tsx
    <Composition
      id="FinanceDemo"
      component={Video}
      durationInFrames={finance.totalFrames}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
      defaultProps={{ scenes: finance.scenes }}
    />
```
In `package.json` scripts add:
```json
    "render:finance": "rm -rf out/finance-frames && remotion render src/index.ts FinanceDemo out/finance-frames --sequence --image-format=jpeg && ffmpeg -y -loglevel error -framerate 30 -pattern_type glob -i \"out/finance-frames/element-*.jpeg\" -c:v libx264 -pix_fmt yuv420p out/finance.mp4",
    "still:finance": "remotion still src/index.ts FinanceDemo"
```

- [ ] **Step 6: Run tests, then render and review the demo**

Run: `npm run typecheck && npm test`
Expected: clean; all pass (including `financeDemo.test.ts`; if the 20-45s bound fails because narrations are too short or long, adjust the NARRATION wording in the fixture, not the bounds, and note it).

Run: `time npm run render:finance` then `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,duration -of csv=p=0 out/finance.mp4`
Expected: renders without error; 1080x1920, 30/1, duration equal to total frames / 30.

Run a contact sheet and view it with the Read tool:
```bash
ffmpeg -y -loglevel error -i out/finance.mp4 -vf "select='not(mod(n,20))',scale=216:384,tile=10x4" -frames:v 1 out/finance-sheet.png
```
Then also render and Read at least these stills (compute frames from the sheet): one mid-draw frame and one settled frame of each `line-chart` scene, one mid-race and one settled frame of the `bar-race`:
```bash
npx remotion still src/index.ts FinanceDemo out/fin-a.png --frame=<N>
```
Checklist while viewing: (1) the line grows left to right with the y-axis rescaling as it grows, the readout counts with the tip, the dot sits exactly on the line; (2) callout badges appear at the right moment, point at the right data point, stay inside the 60px gutters, and never cover the readout; (3) tick labels are readable with no duplicates; (4) bars swap ranks smoothly, entities fade across the top-N boundary, value labels never leave the right gutter; (5) nothing sits inside the top 154px or bottom 384px except background; (6) the look is consistent with the title and big-number scenes (same palette, type, hard-offset shadows). Record concrete defects and fix them (adjust constants such as `CHART_BOX`, font sizes, or badge offsets), re-render, and re-check. Do not move on with visible defects.

- [ ] **Step 7: Measure render time and record it**

From the `time` output of Step 6 compute seconds per frame (wall seconds / total frames). Append to `spikes/RESULTS.md`:
```markdown
## C. FinanceDemo render (date: 2026-10-06)
- Frames: <total frames>, wall time: <seconds> s, <s/frame> s/frame (4 scene types, line charts rebuild their SVG path every frame)
- Estimated 60s video (1800 frames): <minutes> min
- Verdict: <acceptable (<10 min) | too slow, mitigation: ...>
```
Fill every `<...>` with measured values (no placeholders left).

- [ ] **Step 8: Checkpoint** (only if asked): `feat: finance demo composition with line charts and bar race`

---

### Task 9: Visual snapshot tests for the chart scenes

**Files:**
- Create: `tests/render/finance.snapshot.test.ts`
- Create (generated, then reviewed by eye): `tests/render/golden/finance-*.png`

**Interfaces:**
- Consumes: `buildVideo`, `synthWords`, composition `FinanceDemo`, `diffRatio`, `getServeUrl`.

- [ ] **Step 1: Write the test `tests/render/finance.snapshot.test.ts`**

```ts
import fs from "node:fs";
import path from "node:path";
import { renderStill, selectComposition } from "@remotion/renderer";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import facts from "../../fixtures/finance.facts.json";
import storyboard from "../../fixtures/finance.storyboard.json";
import { synthWords } from "../../fixtures/synthWords";
import { buildVideo } from "../../src/pipeline/buildVideo";
import { diffRatio } from "../../src/testing/imageDiff";
import { getServeUrl } from "../../src/testing/renderHelpers";

const GOLDEN_DIR = path.resolve("tests/render/golden");
const TMP_DIR = path.resolve("tests/render/_tmp");
const MAX_DIFF = 0.002;
const SETTLE_MARGIN = 10; // frames before the exit fade starts (it begins 8 frames before the end)

const built = buildVideo(
  storyboard, facts,
  (sb) => Object.fromEntries(sb.scenes.map((s) => [s.id, synthWords(s.narration)])),
  30,
);

// Two frames per chart scene: mid-animation and settled. Offsets come from the composed scenes.
const targets: { name: string; frame: number }[] = [];
let start = 0;
for (const scene of built.scenes) {
  if (scene.scene.type === "line-chart" || scene.scene.type === "bar-race") {
    targets.push({ name: `${scene.id}-mid`, frame: start + Math.round(scene.durationFrames * 0.45) });
    targets.push({ name: `${scene.id}-end`, frame: start + scene.durationFrames - SETTLE_MARGIN });
  }
  start += scene.durationFrames;
}

describe("FinanceDemo chart snapshots", () => {
  for (const { name, frame } of targets) {
    it(`${name} (frame ${frame}) matches the golden image`, async () => {
      fs.mkdirSync(GOLDEN_DIR, { recursive: true });
      fs.mkdirSync(TMP_DIR, { recursive: true });
      const serveUrl = await getServeUrl();
      const composition = await selectComposition({ serveUrl, id: "FinanceDemo" });
      const output = path.join(TMP_DIR, `finance-${name}.png`);
      await renderStill({ composition, serveUrl, output, frame });

      const golden = path.join(GOLDEN_DIR, `finance-${name}.png`);
      if (process.env.UPDATE_SNAPSHOTS === "1") {
        fs.copyFileSync(output, golden);
        return;
      }
      if (!fs.existsSync(golden)) {
        throw new Error(`Missing golden image ${golden}; run with UPDATE_SNAPSHOTS=1 and review it by eye`);
      }
      const ratio = diffRatio(PNG.sync.read(fs.readFileSync(output)), PNG.sync.read(fs.readFileSync(golden)));
      expect(ratio).toBeLessThanOrEqual(MAX_DIFF);
    });
  }
});
```

- [ ] **Step 2: Run to verify the gate fails without goldens**

Run: `npm run test:render`
Expected: the 6 finance snapshot tests FAIL with "Missing golden image"; the Plan 1 tests still pass.

- [ ] **Step 3: Generate goldens and review each by eye**

Run: `UPDATE_SNAPSHOTS=1 npm run test:render`
Expected: all pass and `tests/render/golden/finance-sp500-mid.png`, `finance-sp500-end.png`, `finance-race-mid.png`, `finance-race-end.png`, `finance-cpi-mid.png`, `finance-cpi-end.png` exist. Open each of the 6 with the Read tool and apply the Task 8 Step 6 checklist. Fix and regenerate until all 6 look right.

- [ ] **Step 4: Prove the gate catches regressions**

Temporarily change `LINE_WIDTH = 16` to `LINE_WIDTH = 28` in `src/scenes/line-chart/LineChart.tsx`, run `npm run test:render`, confirm the `sp500`/`cpi` snapshot tests FAIL, revert the change, run again and confirm all PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npm run typecheck && npm run test:cov && npm run test:render`
Expected: typecheck clean; unit tests pass with coverage thresholds met (80%+ on the listed globs, including `src/charts/**` if you add it to `vitest.config.ts` coverage `include`: do that now and re-run); render tests pass.

- [ ] **Step 6: Checkpoint** (only if asked): `test: chart scene snapshots`

---

### Task 10: Record results and hand off to Plan 3

**Files:**
- Modify: `spikes/RESULTS.md`, `docs/superpowers/specs/2026-10-05-motion-explainers-design.md`

- [ ] **Step 1: Amend the spec milestones**

In spec section 8 mark milestone 3 (charts) done with a one-line outcome, and add to section 4 the decisions made here: chart data traces to fact datasets; callouts carry data anchors (`x`); camera push-in and scene transitions are deferred to the polish plan. Note in section 8 that the voice step and word-splitting normalizer move to the plan that also adds captions and audio.

- [ ] **Step 2: Write the Plan 3 brief at the end of `spikes/RESULTS.md`**

```markdown
## Inputs for Plan 3 (voice, captions, audio finish)
- Replace `fixtures/synthWords.ts` with the real voice step: Edge TTS WordBoundary plus the splitting normalizer (cases in section A, plus cue-token collisions "$1.5" vs "15").
- Encoding is system-ffmpeg only (`src/pipeline/encode.ts`); audio mux and loudness normalization go through the same path.
- FinanceDemo render budget: <s/frame> measured; per-scene cost drivers: line-chart rebuilds its path each frame.
- Visual follow-ups noticed while reviewing the chart stills: <list the concrete polish items found in Task 8 Step 6 that were not fixed>.
- Known gaps: callout text and chart titles are not traced to facts; title numbers are not traced.
```
Fill every `<...>` with real values from this run.

- [ ] **Step 3: Final report to the user**

Summarize: what was built, the measured render time, test and coverage status, the path to `out/finance.mp4`, and the deferred items. Ask whether to commit and whether to proceed to writing Plan 3.

- [ ] **Step 4: Checkpoint** (only if asked): `docs: record chart results, plan 3 brief`
