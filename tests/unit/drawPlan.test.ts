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

describe("drawPlan ordering of same-frame cues", () => {
  it("orders cues spoken on the same frame by x so a feasible order is not rejected", () => {
    const plan = drawPlan([{ frame: 50, x: 2020 }, { frame: 50, x: 2010 }], points, DURATION);
    expect(plan.appear[1]).toBe(50);
    expect(plan.appear[0]).toBe(50 + LINE_DRAW_MIN_SEGMENT);
  });
});
