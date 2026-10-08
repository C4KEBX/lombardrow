import { QUOTE_WORD_GAP_EM, fitTitleFontSize, formatNumber } from "../design/layout";
import { QUOTE_LANE, TITLE_LANE } from "../design/tokens";
import type { Facts } from "./facts";
import { COUNTRY_NAMES, regionTouchesBbox, suggestCountries } from "../map/atlas";
import { deepEqual } from "./deepEqual";
import { emphasisTarget } from "./emphasis";
import { StoryboardError, type Scene, type Storyboard } from "./storyboard";

export const MIN_VIDEO_MS = 55_000;
export const MAX_VIDEO_MS = 60_000;

export function assertVariety(sb: Storyboard): void {
  for (let i = 2; i < sb.scenes.length; i += 1) {
    const [a, b, c] = [sb.scenes[i - 2], sb.scenes[i - 1], sb.scenes[i]];
    if (a.type === b.type && b.type === c.type) {
      throw new StoryboardError(
        `Scenes "${a.id}", "${b.id}", "${c.id}" are all "${a.type}"; vary the scene types`,
      );
    }
  }
}

type ChartScene = Extract<Scene, { type: "line-chart" }>;
type RaceScene = Extract<Scene, { type: "bar-race" }>;
type Fact = Facts["facts"][number];

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

function assertBarRaceFact(scene: RaceScene, fact: Fact): void {
  if (fact.dataset === undefined) {
    throw new StoryboardError(`Scene "${scene.id}": fact "${fact.id}" has no dataset to verify the race against`);
  }
  if (!deepEqual(fact.dataset, scene.props.frames)) {
    throw new StoryboardError(`Scene "${scene.id}": race frames do not match the dataset of fact "${fact.id}"`);
  }
  const { decimals } = scene.props;
  for (const frame of scene.props.frames) {
    for (const { name, value } of frame.values) {
      const displayed = Number(formatNumber(value, decimals).replace(/,/g, ""));
      if (displayed !== value) {
        throw new StoryboardError(
          `Scene "${scene.id}" would display ${displayed} for value ${value} (${name}, ${frame.label}) at ${decimals} decimals; use more decimals`,
        );
      }
    }
  }
}

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

function assertTimelineFact(scene: Extract<Scene, { type: "timeline" }>, fact: Fact): void {
  if (fact.dataset === undefined) {
    throw new StoryboardError(`Scene "${scene.id}": fact "${fact.id}" has no dataset to verify the timeline against`);
  }
  if (!deepEqual(fact.dataset, scene.props.events)) {
    throw new StoryboardError(`Scene "${scene.id}": timeline events do not match the dataset of fact "${fact.id}"`);
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
      case "quote": {
        const fact = lookup(scene.id, scene.props.factId);
        if (!quoteInClaim(fact.claim, scene.props.quote)) {
          throw new StoryboardError(
            `Scene "${scene.id}": the quote does not appear in the claim of fact "${fact.id}"; the on-screen wording must match the source`,
          );
        }
        break;
      }
      case "timeline":
        assertTimelineFact(scene, lookup(scene.id, scene.props.factId));
        break;
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

export function assertDuration(totalMs: number): void {
  if (!Number.isFinite(totalMs) || totalMs < MIN_VIDEO_MS || totalMs > MAX_VIDEO_MS) {
    throw new StoryboardError(
      `Video length ${(totalMs / 1000).toFixed(1)}s is outside the required ${MIN_VIDEO_MS / 1000}-${MAX_VIDEO_MS / 1000}s`,
    );
  }
}

const MAX_CALLOUTS: Record<Scene["type"], number> = {
  title: 0,
  "big-number": 1,
  "line-chart": 3,
  "bar-race": 1,
  "kinetic-text": 0,
  compare: 1,
  quote: 0,
  timeline: 0,
  map: 0,
};

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

const NO_CUES: ReadonlySet<Scene["type"]> = new Set(["title", "quote"]);
const MAX_EMPHASIS = 2;

type EmphasisScene = Extract<Scene, { type: "kinetic-text" | "timeline" | "map" }>;
const isEmphasisScene = (scene: Scene): scene is EmphasisScene =>
  scene.type === "kinetic-text" || scene.type === "timeline" || scene.type === "map";

/** What an emphasize cue can point at, and whether every item needs exactly one cue. */
function emphasisItems(scene: EmphasisScene): { items: string[]; noun: string; exact: boolean } {
  switch (scene.type) {
    case "kinetic-text":
      return { items: scene.props.lines, noun: "line", exact: false };
    case "timeline":
      return { items: scene.props.events.map((e) => e.label), noun: "event", exact: true };
    case "map":
      return { items: scene.props.regions, noun: "region", exact: true };
  }
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

/** Rejects cues the scene would silently ignore at render time. */
export function assertCuesSupported(sb: Storyboard): void {
  for (const scene of sb.scenes) {
    if (NO_CUES.has(scene.type) && scene.cues.length > 0) {
      throw new StoryboardError(`Scene "${scene.id}" (${scene.type}) does not support cues`);
    }
    const emphasize = scene.cues.filter((cue) => cue.do === "emphasize");
    if (!isEmphasisScene(scene) && emphasize.length > 0) {
      throw new StoryboardError(`Scene "${scene.id}" (${scene.type}) cannot render "emphasize" cues`);
    }
    if (isEmphasisScene(scene)) assertEmphasis(scene, emphasize);
    const callouts = scene.cues.filter((cue) => cue.do === "callout").length;
    if (callouts > MAX_CALLOUTS[scene.type]) {
      throw new StoryboardError(
        `Scene "${scene.id}" (${scene.type}) supports at most ${MAX_CALLOUTS[scene.type]} callout cue; got ${callouts}`,
      );
    }
    for (const cue of scene.cues) assertCueAnchor(scene, cue);
  }
}

export const TITLE_MAX_FONT_PX = 190;

export function assertHeadlinesFit(sb: Storyboard): void {
  for (const scene of sb.scenes) {
    if (scene.type !== "title") continue;
    try {
      fitTitleFontSize(scene.props.headline, TITLE_LANE.width, TITLE_LANE.height, TITLE_MAX_FONT_PX);
    } catch (error) {
      if (error instanceof RangeError) {
        throw new StoryboardError(`Scene "${scene.id}" headline does not fit: ${error.message}`);
      }
      throw error;
    }
  }
}

/** Content rules for text scenes. Numbers must reach the screen through facts, so lines carry none. */
export function assertTextScenes(sb: Storyboard): void {
  for (const scene of sb.scenes) {
    if (scene.type === "kinetic-text" && scene.props.lines.some((line) => /\d/.test(line))) {
      throw new StoryboardError(`Scene "${scene.id}" (kinetic-text) shows a digit; spell it out or use a big-number scene tied to a fact`);
    }
    if (scene.type === "quote") {
      try {
        fitTitleFontSize(scene.props.quote, QUOTE_LANE.width, QUOTE_LANE.height, QUOTE_LANE.maxFont, undefined, QUOTE_WORD_GAP_EM);
      } catch (error) {
        if (error instanceof RangeError) throw new StoryboardError(`Scene "${scene.id}": the quote does not fit: ${error.message}`);
        throw error;
      }
    }
  }
}

/** Every region must be a country name in the bundled atlas (modern borders). */
export function assertMapRegions(sb: Storyboard): void {
  for (const scene of sb.scenes) {
    if (scene.type !== "map") continue;
    for (const name of scene.props.regions) {
      if (COUNTRY_NAMES.has(name)) {
        if (!regionTouchesBbox(name, scene.props.focus)) {
          throw new StoryboardError(`Scene "${scene.id}": "${name}" lies outside the focus box and would light up off-screen; widen focus or drop it`);
        }
        continue;
      }
      const hint = suggestCountries(name);
      throw new StoryboardError(
        `Scene "${scene.id}": "${name}" is not a country name in the atlas${hint.length ? ` (did you mean: ${hint.join(", ")})` : ""}`,
      );
    }
  }
}
