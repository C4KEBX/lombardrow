import { VIDEO } from "../design/tokens";
import { assertSceneTiming } from "../pipeline/assertSceneTiming";
import { composeScenes } from "../pipeline/resolveScene";
import { parseFacts, type Facts } from "../schema/facts";
import { parseStoryboard, type Storyboard } from "../schema/storyboard";
import {
  assertCuesSupported, assertFactsTraceable, assertHeadlinesFit, assertMapRegions, assertTextScenes, assertVariety,
  assertYears, sceneStamps,
} from "../schema/validate";
import { assertDevicesInBounds, deviceBoxes } from "../devices/bounds";
import { stampTrack } from "../devices/tracks";
import { synthWords } from "../voice/synthWords";
import { adviceLint } from "./adviceLint";
import { TARGET_SECONDS, countWords, estimateSeconds, targetWords } from "./estimate";

export type Issue = { stage: string; message: string };
export type CheckReport = {
  ok: boolean;
  issues: Issue[];
  warnings: string[];
  stats: { scenes: number; words: number; estimatedSeconds: number } | null;
};

function attempt<T>(issues: Issue[], stage: string, fn: () => T): T | undefined {
  try {
    return fn();
  } catch (error) {
    issues.push({ stage, message: error instanceof Error ? error.message : String(error) });
    return undefined;
  }
}

/**
 * Runs every validation stage independently, and per scene, so one pass reports every bad scene (a scene with several faults in one stage still reports only its first). Cue
 * timing uses synthetic word timings; `produce` re-checks against the real voice.
 */
export function checkStoryboard(storyboardJson: unknown, factsJson: unknown): CheckReport {
  const issues: Issue[] = [];
  const warnings: string[] = [];
  const sb: Storyboard | undefined = attempt(issues, "storyboard schema", () => parseStoryboard(storyboardJson));
  const facts: Facts | undefined = attempt(issues, "facts schema", () => parseFacts(factsJson));
  if (!sb) return { ok: false, issues, warnings, stats: null };

  attempt(issues, "variety", () => assertVariety(sb));
  // Every other stage is independent per scene, so run it on one scene at a time: one issue per bad scene.
  const perScene = (stage: string, run: (single: Storyboard) => void): void => {
    for (const scene of sb.scenes) attempt(issues, stage, () => run({ ...sb, scenes: [scene] }));
  };
  perScene("cues", assertCuesSupported);
  perScene("headlines", assertHeadlinesFit);
  perScene("text scenes", assertTextScenes);
  perScene("map regions", assertMapRegions);
  perScene("year counter", assertYears);
  if (facts) perScene("fact tracing", (single) => assertFactsTraceable(single, facts));
  if (facts) {
    perScene("source stamp", (single) => {
      const [scene] = single.scenes;
      stampTrack([{ id: scene.id, startFrame: 0, durationFrames: 1, stamp: sceneStamps(single, facts)[scene.id] }], VIDEO.fps);
    });
  }
  attempt(issues, "devices", () => {
    const { doorNo, series } = sb.meta;
    const years = sb.scenes.flatMap((s) =>
      s.year === undefined ? [] : [{ from: s.year, to: s.year, startFrame: 0, endFrame: 1, fadeIn: true, fadeOut: true }]);
    assertDevicesInBounds(deviceBoxes({ doorNo, series, years, stamps: [] }));
  });
  perScene("timing", (single) => {
    const words = Object.fromEntries(single.scenes.map((s) => [s.id, synthWords(s.narration)]));
    assertSceneTiming(composeScenes(single, words, VIDEO.fps));
  });

  const narrations = sb.scenes.map((s) => s.narration);
  const estimatedSeconds = Math.round(estimateSeconds(narrations) * 10) / 10;
  const words = narrations.reduce((n, t) => n + countWords(t), 0);
  if (estimatedSeconds < TARGET_SECONDS.min || estimatedSeconds > TARGET_SECONDS.max) {
    warnings.push(
      `estimated length ${estimatedSeconds} s is outside ${TARGET_SECONDS.min}-${TARGET_SECONDS.max} s (${words} words now; about ${targetWords(sb.scenes.length)} words fits ${sb.scenes.length} scenes)`,
    );
  }
  for (const hit of adviceLint(sb)) {
    warnings.push(`Scene "${hit.sceneId}" narration contains advice-style phrasing: "${hit.phrase}"; keep it educational and historical`);
  }
  return { ok: issues.length === 0, issues, warnings, stats: { scenes: sb.scenes.length, words, estimatedSeconds } };
}

export function formatReport(report: CheckReport): string {
  const lines = report.issues.map((i) => `[${i.stage}] ${i.message}`);
  for (const w of report.warnings) lines.push(`warning: ${w}`);
  if (report.stats) {
    const { scenes, words, estimatedSeconds } = report.stats;
    lines.push(`${scenes} scenes, ${words} words, about ${estimatedSeconds} s`);
  }
  lines.push(report.ok ? "OK" : `FAIL: ${report.issues.length} issue${report.issues.length === 1 ? "" : "s"}`);
  return lines.join("\n");
}
