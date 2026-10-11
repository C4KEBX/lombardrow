import { fitTitleFontSize } from "../design/layout";
import { COLD_OPEN_HEADLINE, CONTENT, VIDEO } from "../design/tokens";
import { assertSceneTiming } from "../pipeline/assertSceneTiming";
import { composeScenes } from "../pipeline/resolveScene";
import { parseFacts, type Facts } from "../schema/facts";
import { parseStoryboard, type Scene, type Storyboard } from "../schema/storyboard";
import {
  assertCuesSupported, assertDisputedHedged, assertFactsTraceable, assertHeadlinesFit, assertMapRegions, assertSources,
  assertSpokenFigures, assertTextScenes, assertVariety, assertYears, sceneStamps,
} from "../schema/validate";
import { assertDevicesInBounds, deviceBoxes } from "../devices/bounds";
import { stampTrack } from "../devices/tracks";
import { synthWords } from "../voice/synthWords";
import { adviceLint, tickerHits } from "./adviceLint";
import { assertAssets, parseAssets, type Asset } from "../schema/assets";
import { checkPlan, crossCheck, parsePlan, scriptOf, type HistoryEntry, type Spec } from "../variation/index";
import { TARGET_SECONDS, countWords, estimateSeconds, targetWords } from "./estimate";
import { estimatedWords, pacingIssues } from "./pacing";

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
export function checkStoryboard(
  storyboardJson: unknown,
  factsJson: unknown,
  opts: {
    variation?: { plan: unknown; history: readonly HistoryEntry[]; spec: Spec };
    assets?: { json: unknown; fileExists: (asset: Asset) => boolean };
  } = {},
): CheckReport {
  const { variation } = opts;
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
  // Whole storyboard: the opening title card's headline shares its lane with the door-number masthead.
  attempt(issues, "headlines", () => assertHeadlinesFit(sb));
  for (const message of openerIssues(sb)) issues.push({ stage: "opener", message });
  perScene("text scenes", assertTextScenes);
  perScene("map regions", assertMapRegions);
  perScene("year counter", assertYears);
  if (facts) perScene("fact tracing", (single) => assertFactsTraceable(single, facts));
  if (facts) perScene("spoken figures", (single) => assertSpokenFigures(single, facts));
  if (facts) perScene("disputed", (single) => assertDisputedHedged(single, facts));
  if (facts) attempt(issues, "sources", () => assertSources(facts));
  attempt(issues, "assets", () => assertAssets(sb, opts.assets ? parseAssets(opts.assets.json) : undefined, opts.assets?.fileExists ?? (() => false)));
  if (variation) {
    const plan = attempt(issues, "plan", () => parsePlan(variation.plan));
    if (plan) {
      for (const reason of checkPlan(plan, variation.history, variation.spec, scriptOf(sb)).reasons) issues.push({ stage: "variation", message: reason });
      for (const reason of crossCheck(plan, sb, variation.spec)) issues.push({ stage: "plan vs storyboard", message: reason });
    }
  }
  for (const hit of tickerHits(sb)) {
    issues.push({ stage: "tickers", message: `Scene "${hit.sceneId}" shows or says the ticker "${hit.ticker}"; the brand never names tickers` });
  }
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

  // The fast format's pacing, on estimated timings; `produce` re-checks against the real voice.
  attempt(issues, "pacing", () => {
    const composed = composeScenes(sb, Object.fromEntries(sb.scenes.map((s) => [s.id, estimatedWords(s)])), VIDEO.fps);
    for (const message of pacingIssues(sb, composed, VIDEO.fps)) issues.push({ stage: "pacing", message });
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

/** Scene types that move from frame 0 and show a thing (a document, chart, map), so they can carry a cold open. */
export const COLD_OPEN_TYPES: readonly Scene["type"][] = ["ledger-page", "line-chart", "bar-race", "map", "archival", "flow-diagram", "timeline", "compare", "big-number"];

const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";
const DATE_LEAD = new RegExp(`^(?:[Ii]n\\s+)?(?:(?:${MONTHS})\\b|\\d{3,4}\\b|[A-Z][a-z]+,\\s+(?:(?:${MONTHS})\\s+)?\\d{3,4}\\b)`);

/**
 * How the video opens. A title-card open puts a title scene first. A cold open puts a moving visual first,
 * with the masthead laid over it, and its first line states a claim: not a question, not a date.
 */
export function openerIssues(sb: Storyboard): string[] {
  const first = sb.scenes[0];
  if (!first) return [];
  if (sb.meta.open === "bleed") return bleedOpenIssues(sb);
  if (sb.meta.hookLine !== undefined) return ["meta.hookLine is the bleed open's frame-0 line; set meta.open to \"bleed\" or drop it"];
  if (sb.meta.open !== "cold") {
    return first.type === "title" ? [] : [`Scene "${first.id}" opens the video as ${first.type}; a title-card open needs a title scene first, which carries the door number. For a moving open, set meta.open to "cold"`];
  }
  const issues: string[] = [];
  if (!COLD_OPEN_TYPES.includes(first.type)) {
    issues.push(`Scene "${first.id}" opens a cold open as ${first.type}; a cold open starts on something moving that shows a thing: ${COLD_OPEN_TYPES.join(", ")}`);
  }
  issues.push(...firstLineIssues(first.id, first.narration, "a cold open"));
  try {
    fitTitleFontSize(sb.meta.title, CONTENT.width, COLD_OPEN_HEADLINE.boxPx, COLD_OPEN_HEADLINE.maxPx);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    issues.push(`The title "${sb.meta.title}" does not fit the cold-open masthead: ${error.message}`);
  }
  return issues;
}

function firstSentence(text: string): string {
  const match = /^.*?[.!?](?=\s|$)/.exec(text.trim());
  return (match ? match[0] : text).trim();
}

/** The opening line states a claim: not a question, not a date. */
function firstLineIssues(sceneId: string, narration: string, open: string): string[] {
  const line = firstSentence(narration);
  const issues: string[] = [];
  if (line.endsWith("?")) issues.push(`Scene "${sceneId}" opens on a question ("${line}"); ${open}'s first line states a surprising claim`);
  if (DATE_LEAD.test(line)) issues.push(`Scene "${sceneId}" opens on a date ("${line}"); ${open}'s first line states a surprising claim, and the date can come later`);
  return issues;
}

/**
 * A bleed open fills frame one with an image and nothing over it: the first scene is a bleed archival scene,
 * with no year counter (the corner tag, door number and series, arrives at 2 s), and its first line is a claim.
 */
function bleedOpenIssues(sb: Storyboard): string[] {
  const first = sb.scenes[0];
  const issues: string[] = [];
  if (first.type !== "archival" || first.props.layout !== "bleed") {
    issues.push(`Scene "${first.id}" opens a bleed open as ${first.type === "archival" ? "a framed archival scene" : first.type}; frame one is a full-frame image: an archival scene with "layout": "bleed"`);
  }
  if (first.year !== undefined) issues.push(`Scene "${first.id}" shows the year counter on frame one; a bleed open keeps frame one clear, so give the year from the second scene on`);
  issues.push(...firstLineIssues(first.id, first.narration, "a bleed open"));
  return issues;
}
