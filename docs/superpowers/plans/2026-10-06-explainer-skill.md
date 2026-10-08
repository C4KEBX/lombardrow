# Motion Explainers: Plan 6 (The Claude Code Skill and First Real Videos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One command, `/make-explainer <topic>`, takes Claude Code from a topic to a finished, narrated, captioned 60-second video: researched sources, a validated storyboard, a human review gate, then the render. Prove it by making a finance, an investing and a history video with the skill.

**Architecture:** Claude Code itself is the "brain" (research, script, storyboard, repair), so it costs nothing beyond the user's subscription. Deterministic, tested tools do everything checkable: `check` (collects every validation issue plus duration and advice warnings), `catalog` (generates the storyboard JSON Schema the skill reads, with a drift test), `verify-facts` (advisory: do the fact's numbers appear on its source page), `sheet` (a self-contained review page with a still per scene, the facts and warnings), and the existing `produce`. The skill (`SKILL.md` plus `rules.md`) is a workflow with hard rules and a human gate; guard tests keep it in sync with the scripts and scene types.

**Tech Stack:** Existing stack only. Zod 4's `z.toJSONSchema` for the catalog; Node `fetch` for fact verification; Remotion `renderStill` for the sheet. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-05-motion-explainers-design.md` (sections 7, 8 milestone 7). Previous plans: `2026-10-06-foundation-and-spikes.md` through `2026-10-06-history-scenes.md`. Brief: `spikes/RESULTS.md` ("Inputs for Plan 6").

**Scope note:** Not in this plan: auto-publishing, thumbnails, multiple voices per video, parallel rendering, translating content, music selection beyond the existing `audio.music` field, YouTube/TikTok metadata. Dropped from the spec: the skill lives at `.claude/skills/make-explainer/` (where Claude Code discovers project skills), not a top-level `skill/` directory; Task 6 records the amendment.

## Verified before writing this plan

- Measured speech rate from the three real Edge runs (finance 2.87, history 2.76, ancient 2.50 words/s; overall **2.68 words/s**, audio only). With the 0.4 s tail pad per scene, a 55-60 s video of about 8 scenes needs about 143 words.
- `produce` already rejects videos outside 55-60 s (`assertDuration`) and fails scenes that are too short with messages that name the scene and the fix; `buildVideo` throws on the first problem, so the repair loop needs a collector (Task 1).
- Every validation message already names the scene id and what to change (Plans 2-5), which is what makes an LLM repair loop converge.
- `z.toJSONSchema` exists in Zod 4.5; refinements are not representable and are documented in `rules.md` instead.
- `synthWords` (browser-safe) provides cue resolution for validation without a voice; real timing is checked by `produce`.

## Global Constraints

- Everything from Plans 1 to 5 still applies: 1080x1920 @ 30fps; all `remotion*` pinned `4.0.533`; zod pinned `4.5.4`; files < 800 lines; immutable data; zero paid services; TDD with 80% coverage on non-visual logic (`src/skill/**` is included; `src/skill/sheetRender.ts` is excluded and covered by the render test); system ffmpeg only; render tests run serially; no two files differing only by case.
- **The skill never weakens the pipeline:** no skill step edits `src/`, `tests/` or the validators to make a storyboard pass.
- **LLM text is untrusted:** anything model-written that is placed into HTML (the review sheet) is escaped; model-written URLs are only fetched after a host check (no localhost, private or link-local addresses; http and https only), with a timeout, a body cap and a redirect limit.
- Finance and investing videos are educational and historical: the lint warns on advice-style phrasing ("you should buy", "guaranteed", "can't lose").
- **No git commits unless the user explicitly asks.** Each "Checkpoint" step names the intended message; run it only if asked. Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

Failure modes the spec implies but happy-path tests would miss, most likely first. Each has a pinning test in the task named.

1. The repair loop "fixes" a failure by editing a fact to match the storyboard (or the reverse) and so launders a wrong number. Defense in depth: `check` fails when scene data differs from the fact, `verify-facts` flags numbers not on the source page, the sheet shows every fact with its status, the skill forbids it, and the human gate (Tasks 1, 3, 4, 5).
2. Model-written text reaching the review page: `<script>`, attribute injection, `javascript:` URLs (Task 3).
3. `verify-facts` fetching a model-chosen URL: private hosts, redirects into private hosts, slow or huge responses, non-HTML (Task 4).
4. The JSON Schema catalog drifting from the Zod schema, and `rules.md` drifting from the scene types (Tasks 2, 5).
5. A script that is too long or too short for 55-60 s, caught before the expensive render, using a calibrated estimate (Task 1).
6. Skill instructions referencing scripts or files that do not exist, or contradicting the hard rules (Task 5).
7. Advice-style finance narration slipping through (Task 1).
8. Known gap, not tested: the quality of what the model writes (hook, clarity, taste) and the real voice's pronunciation. The rehearsal in Task 6 exercises the skill but only a human watching the videos judges them.

## File Structure

```
package.json                                   modify: scripts check, catalog, sheet, verify-facts
.gitignore                                     modify: videos/*/review/
vitest.config.ts                               modify: coverage globs (src/skill/**)
src/schema/storyboard.ts                       modify: export SCENE_TYPES
src/skill/flags.ts                             create: tiny argv parser shared by the CLIs
src/skill/estimate.ts                          create: WORDS_PER_SECOND, countWords, estimateSeconds
src/skill/adviceLint.ts                        create: advice-phrase warnings
src/skill/check.ts                             create: checkStoryboard, formatReport
src/skill/catalog.ts                           create: buildCatalog
src/skill/review.ts                            create: buildReviewModel, escapeHtml, renderReviewHtml
src/skill/sheetRender.ts                       create: stills + files (excluded from unit coverage)
src/skill/verifyFacts.ts                       create: host guard, token extraction, verifyFacts
scripts/check.ts, catalog.ts, sheet.ts, verify-facts.ts   create: thin CLIs
.claude/skills/make-explainer/SKILL.md         create: the workflow
.claude/skills/make-explainer/rules.md         create: scene catalog, cue rules, style, finance safety
.claude/skills/make-explainer/storyboard.schema.json  create: generated
videos/<slug>/{facts.json,storyboard.json}     create (Task 6): the three rehearsal videos
README.md                                      create: how to use the project
tests/unit/*, tests/render/sheet.test.ts       see tasks
```

---

### Task 1: The checker (collect every issue, estimate length, lint advice)

**Files:**
- Create: `src/skill/flags.ts`, `src/skill/estimate.ts`, `src/skill/adviceLint.ts`, `src/skill/check.ts`, `scripts/check.ts`, `tests/unit/flags.test.ts`, `tests/unit/estimate.test.ts`, `tests/unit/adviceLint.test.ts`, `tests/unit/check.test.ts`
- Modify: `package.json`, `vitest.config.ts`

**Interfaces:**
- Produces:
  - `parseFlags(argv: readonly string[], spec: { values: readonly string[]; booleans?: readonly string[] }): { values: Map<string, string>; flags: Set<string> }` (throws on unknown flag or missing value).
  - `WORDS_PER_SECOND = 2.68`, `TARGET_SECONDS = { min: 55, max: 60 }`, `countWords(text): number`, `estimateSeconds(narrations: readonly string[]): number` (sum over scenes of `words / WORDS_PER_SECOND + 0.4`), `targetWords(sceneCount: number): number` (words for 57.5 s).
  - `adviceLint(sb: Storyboard): { sceneId: string; phrase: string }[]`.
  - `type Issue = { stage: string; message: string }`; `type CheckReport = { ok: boolean; issues: Issue[]; warnings: string[]; stats: { scenes: number; words: number; estimatedSeconds: number } | null }`; `checkStoryboard(storyboardJson: unknown, factsJson: unknown): CheckReport`; `formatReport(report): string`.
  - `npm run check -- --storyboard <path> --facts <path> [--json]` (exit 1 when `issues` is non-empty).

- [ ] **Step 1: Write the failing tests**

`tests/unit/flags.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseFlags } from "../../src/skill/flags";

describe("parseFlags", () => {
  const spec = { values: ["--storyboard", "--facts"], booleans: ["--json"] };
  it("reads value flags and boolean flags", () => {
    const r = parseFlags(["--storyboard", "a.json", "--json", "--facts", "b.json"], spec);
    expect(r.values.get("--storyboard")).toBe("a.json");
    expect(r.values.get("--facts")).toBe("b.json");
    expect(r.flags.has("--json")).toBe(true);
  });
  it("rejects unknown flags and a missing or flag-like value", () => {
    expect(() => parseFlags(["--nope"], spec)).toThrow(/Unknown flag --nope/);
    expect(() => parseFlags(["--storyboard"], spec)).toThrow(/needs a value/);
    expect(() => parseFlags(["--storyboard", "--facts"], spec)).toThrow(/needs a value/);
  });
});
```

`tests/unit/estimate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import financeSb from "../../fixtures/finance.storyboard.json";
import historySb from "../../fixtures/history.storyboard.json";
import ancientSb from "../../fixtures/ancient.storyboard.json";
import { TARGET_SECONDS, WORDS_PER_SECOND, countWords, estimateSeconds, targetWords } from "../../src/skill/estimate";

const narrations = (sb: { scenes: { narration: string }[] }) => sb.scenes.map((s) => s.narration);

describe("estimate", () => {
  it("counts whitespace-separated words", () => {
    expect(countWords("  one  two\nthree ")).toBe(3);
    expect(countWords("")).toBe(0);
  });
  it("matches the measured real-voice lengths of the three demos within 10 percent", () => {
    const measured: [{ scenes: { narration: string }[] }, number][] = [
      [financeSb, 22.9], [historySb, 20.9], [ancientSb, 29.6],
    ];
    for (const [sb, seconds] of measured) {
      expect(Math.abs(estimateSeconds(narrations(sb)) - seconds) / seconds).toBeLessThan(0.1);
    }
  });
  it("targetWords gives a script length that estimates inside the 55-60 s window", () => {
    for (const scenes of [6, 8, 10]) {
      const words = targetWords(scenes);
      const even = Array.from({ length: scenes }, () => "w ".repeat(Math.round(words / scenes)).trim());
      const s = estimateSeconds(even);
      expect(s).toBeGreaterThanOrEqual(TARGET_SECONDS.min);
      expect(s).toBeLessThanOrEqual(TARGET_SECONDS.max);
    }
    expect(WORDS_PER_SECOND).toBe(2.68);
  });
});
```

`tests/unit/adviceLint.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseStoryboard } from "../../src/schema/storyboard";
import { adviceLint } from "../../src/skill/adviceLint";

const board = (narration: string) =>
  parseStoryboard({
    schemaVersion: 1,
    meta: { title: "t", theme: "bold-flat", voice: "v" },
    audio: { music: null },
    scenes: [{ id: "s", type: "title", narration, props: { headline: "H" } }],
  });

describe("adviceLint", () => {
  it("flags advice and certainty phrasing with the scene id and phrase", () => {
    for (const text of [
      "You should buy index funds now.",
      "This is a guaranteed return.",
      "It is a risk-free way to grow money.",
      "You can't lose with this strategy.",
      "Sell today before it drops.",
      "You need to invest early.",
    ]) {
      const hits = adviceLint(board(text));
      expect(hits.length, text).toBeGreaterThan(0);
      expect(hits[0].sceneId).toBe("s");
    }
  });
  it("leaves factual, historical phrasing alone", () => {
    for (const text of [
      "Investors bought stocks in the nineteen twenties.",
      "The index fell fifty seven percent from its peak.",
      "Many analysts sold their positions.",
    ]) {
      expect(adviceLint(board(text))).toEqual([]);
    }
  });
});
```

`tests/unit/check.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import facts from "../../fixtures/finance.facts.json";
import storyboard from "../../fixtures/finance.storyboard.json";
import { checkStoryboard, formatReport } from "../../src/skill/check";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

describe("checkStoryboard", () => {
  it("passes a valid storyboard and reports stats and a length warning when outside 55-60 s", () => {
    const report = checkStoryboard(storyboard, facts);
    expect(report.issues).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.stats?.scenes).toBe(5);
    expect(report.warnings.join("\n")).toMatch(/estimated length .* outside 55-60 s/);
  });

  it("collects every independent issue in one run instead of stopping at the first", () => {
    const sb = clone(storyboard) as typeof storyboard;
    (sb.scenes[2].props as { value: number }).value = 58; // drop: fact says 57
    (sb.scenes[4].cues[0] as { atWord: string }).atWord = "nonexistentword"; // cue not in narration
    sb.scenes[0].props.headline = "x".repeat(60); // does not fit
    const report = checkStoryboard(sb, facts);
    const text = report.issues.map((i) => i.message).join("\n");
    expect(report.ok).toBe(false);
    expect(text).toMatch(/"drop".*57/);
    expect(text).toMatch(/headline does not fit/);
    expect(text).toMatch(/"cpi"/); // the unresolvable cue is reported against its scene
  });

  it("stops at schema errors and says so", () => {
    const sb = clone(storyboard) as { scenes: unknown[] };
    sb.scenes = [{ id: "x", type: "no-such-type" }];
    const report = checkStoryboard(sb, facts);
    expect(report.ok).toBe(false);
    expect(report.issues[0].stage).toBe("storyboard schema");
    expect(report.stats).toBeNull();
  });

  it("reports a facts schema error separately", () => {
    const report = checkStoryboard(storyboard, { facts: [] });
    expect(report.issues.some((i) => i.stage === "facts schema")).toBe(true);
  });

  it("adds advice warnings with scene ids", () => {
    const sb = clone(storyboard) as typeof storyboard;
    sb.scenes[0].narration = "You should buy the index today.";
    const report = checkStoryboard(sb, facts);
    expect(report.warnings.join("\n")).toMatch(/"intro".*you should buy/i);
  });
});

describe("formatReport", () => {
  it("lists issues by stage, then warnings, then a verdict line", () => {
    const text = formatReport({
      ok: false,
      issues: [{ stage: "cues", message: 'Scene "a" cannot render "emphasize" cues' }],
      warnings: ["something to look at"],
      stats: { scenes: 3, words: 100, estimatedSeconds: 40.1 },
    });
    expect(text).toMatch(/\[cues\] Scene "a" cannot render/);
    expect(text).toMatch(/warning: something to look at/);
    expect(text).toMatch(/FAIL: 1 issue/);
    expect(text).toMatch(/3 scenes, 100 words, about 40\.1 s/);
  });
  it("prints OK when there are no issues", () => {
    expect(formatReport({ ok: true, issues: [], warnings: [], stats: { scenes: 1, words: 5, estimatedSeconds: 3 } })).toMatch(/OK/);
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npx vitest run tests/unit/flags.test.ts tests/unit/estimate.test.ts tests/unit/adviceLint.test.ts tests/unit/check.test.ts`
Expected: FAIL, modules missing.

- [ ] **Step 3: Implement**

`src/skill/flags.ts`:

```ts
export type FlagSpec = { values: readonly string[]; booleans?: readonly string[] };

/** Minimal argv parser shared by the skill's CLIs: value flags need a value, boolean flags stand alone. */
export function parseFlags(argv: readonly string[], spec: FlagSpec): { values: Map<string, string>; flags: Set<string> } {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (spec.booleans?.includes(flag)) {
      flags.add(flag);
    } else if (spec.values.includes(flag)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) throw new Error(`${flag} needs a value`);
      values.set(flag, value);
      i += 1;
    } else {
      throw new Error(`Unknown flag ${flag}`);
    }
  }
  return { values, flags };
}
```

`src/skill/estimate.ts`:

```ts
import { DEFAULT_TAIL_PAD_MS } from "../schema/timing";

/** Measured from three real Edge runs (2.87, 2.76, 2.50): overall 2.68 words per second of audio. */
export const WORDS_PER_SECOND = 2.68;
export const TARGET_SECONDS = { min: 55, max: 60 } as const;
const MID_SECONDS = (TARGET_SECONDS.min + TARGET_SECONDS.max) / 2;
const TAIL_SECONDS = DEFAULT_TAIL_PAD_MS / 1000;

export const countWords = (text: string): number => text.split(/\s+/).filter(Boolean).length;

/** Video length: each scene lasts its narration plus a short tail. A planning estimate; `produce` has the real number. */
export const estimateSeconds = (narrations: readonly string[]): number =>
  narrations.reduce((sum, n) => sum + countWords(n) / WORDS_PER_SECOND + TAIL_SECONDS, 0);

/** Total narration words that land at the middle of the 55-60 s window for a given scene count. */
export const targetWords = (sceneCount: number): number =>
  Math.round((MID_SECONDS - sceneCount * TAIL_SECONDS) * WORDS_PER_SECOND);
```

`src/skill/adviceLint.ts`:

```ts
import type { Storyboard } from "../schema/storyboard";

const PATTERNS: RegExp[] = [
  /\byou (?:should|must|need to|ought to) (?:buy|sell|invest|hold|short|own)\b/i,
  /\b(?:guaranteed?|risk[- ]free|sure thing|get rich)\b/i,
  /\b(?:can'?t|cannot|won'?t) (?:lose|fail)\b/i,
  /\b(?:buy|sell) (?:now|today|immediately)\b/i,
  /\bnot financial advice\b/i,
];

/** Advice-style or certainty phrasing in narration: the videos are educational and historical, never advice. */
export function adviceLint(sb: Storyboard): { sceneId: string; phrase: string }[] {
  const hits: { sceneId: string; phrase: string }[] = [];
  for (const scene of sb.scenes) {
    for (const pattern of PATTERNS) {
      const match = scene.narration.match(pattern);
      if (match) hits.push({ sceneId: scene.id, phrase: match[0] });
    }
  }
  return hits;
}
```

`src/skill/check.ts`:

```ts
import { VIDEO } from "../design/tokens";
import { assertSceneTiming } from "../pipeline/assertSceneTiming";
import { composeScenes } from "../pipeline/resolveScene";
import { parseFacts, type Facts } from "../schema/facts";
import { parseStoryboard, type Storyboard } from "../schema/storyboard";
import {
  assertCuesSupported, assertFactsTraceable, assertHeadlinesFit, assertMapRegions, assertTextScenes, assertVariety,
} from "../schema/validate";
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
 * Runs every validation stage independently so one pass reports everything that is wrong. Cue
 * timing uses synthetic word timings; `produce` re-checks against the real voice.
 */
export function checkStoryboard(storyboardJson: unknown, factsJson: unknown): CheckReport {
  const issues: Issue[] = [];
  const warnings: string[] = [];
  const sb: Storyboard | undefined = attempt(issues, "storyboard schema", () => parseStoryboard(storyboardJson));
  const facts: Facts | undefined = attempt(issues, "facts schema", () => parseFacts(factsJson));
  if (!sb) return { ok: false, issues, warnings, stats: null };

  attempt(issues, "variety", () => assertVariety(sb));
  attempt(issues, "cues", () => assertCuesSupported(sb));
  attempt(issues, "headlines", () => assertHeadlinesFit(sb));
  attempt(issues, "text scenes", () => assertTextScenes(sb));
  attempt(issues, "map regions", () => assertMapRegions(sb));
  if (facts) attempt(issues, "fact tracing", () => assertFactsTraceable(sb, facts));
  attempt(issues, "timing", () => {
    const words = Object.fromEntries(sb.scenes.map((s) => [s.id, synthWords(s.narration)]));
    assertSceneTiming(composeScenes(sb, words, VIDEO.fps));
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
```

`scripts/check.ts`:

```ts
import fs from "node:fs";
import { checkStoryboard, formatReport } from "../src/skill/check";
import { parseFlags } from "../src/skill/flags";

try {
  const { values, flags } = parseFlags(process.argv.slice(2), { values: ["--storyboard", "--facts"], booleans: ["--json"] });
  const need = (flag: string): string => {
    const v = values.get(flag);
    if (!v) throw new Error(`Missing required flag ${flag}`);
    return v;
  };
  const read = (file: string): unknown => JSON.parse(fs.readFileSync(file, "utf-8"));
  const report = checkStoryboard(read(need("--storyboard")), read(need("--facts")));
  console.log(flags.has("--json") ? JSON.stringify(report, null, 2) : formatReport(report));
  process.exit(report.ok ? 0 : 1);
} catch (error) {
  console.error(`check failed: ${(error as Error).message}`);
  process.exit(2);
}
```

`package.json` scripts: add `"check": "tsx scripts/check.ts"`. `vitest.config.ts`: add `"src/skill/**"` to `coverage.include` and `"src/skill/sheetRender.ts"` to `coverage.exclude`.

- [ ] **Step 4: Run to verify GREEN**

Run: `npm run typecheck && npx vitest run tests/unit`
Expected: clean, all PASS. If the multi-issue test's `cpi` cue assertion fails because the timing stage did not run after earlier issues, that is by design for unrelated stages: the `timing` stage runs independently; if `composeScenes` throws `CueResolutionError` its message already names the scene (`Scene "cpi": ...`). Adjust the test's regex only if the message format differs, not the collector.

- [ ] **Step 5: Try it**

Run: `npm run check -- --storyboard fixtures/ancient.storyboard.json --facts fixtures/ancient.facts.json`
Expected: prints `OK` plus a length warning (the demo is about 30 s) and exits 0.

- [ ] **Step 6: Checkpoint (only if asked)**

`git add -A && git commit -m "feat: storyboard checker with issue collection, length estimate and advice lint"`

---

### Task 2: The schema catalog (generated, drift-tested)

**Files:**
- Create: `src/skill/catalog.ts`, `scripts/catalog.ts`, `.claude/skills/make-explainer/storyboard.schema.json` (generated), `tests/unit/catalog.test.ts`
- Modify: `src/schema/storyboard.ts`, `package.json`

**Interfaces:**
- Produces: `SCENE_TYPES: readonly Scene["type"][]` exported from `src/schema/storyboard.ts` (derived from the union's options, so adding a scene type updates it); `buildCatalog(): string` (pretty JSON Schema of the storyboard, trailing newline); `npm run catalog` writes `.claude/skills/make-explainer/storyboard.schema.json`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/catalog.test.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SCENE_TYPES } from "../../src/schema/storyboard";
import { buildCatalog } from "../../src/skill/catalog";

const SCHEMA_FILE = path.resolve(".claude/skills/make-explainer/storyboard.schema.json");

describe("SCENE_TYPES", () => {
  it("lists every scene type the renderer supports", () => {
    expect([...SCENE_TYPES].sort()).toEqual(
      ["bar-race", "big-number", "compare", "kinetic-text", "line-chart", "map", "quote", "timeline", "title"],
    );
  });
});

describe("buildCatalog", () => {
  const catalog = JSON.parse(buildCatalog());
  const text = buildCatalog();

  it("is valid JSON Schema text that names every scene type and the strictness of the contract", () => {
    for (const type of SCENE_TYPES) expect(text).toContain(`"${type}"`);
    expect(text).toContain('"additionalProperties": false');
    expect(catalog.type).toBe("object");
    expect(text.endsWith("\n")).toBe(true);
  });

  it("matches the committed file exactly, so schema changes must be regenerated with `npm run catalog`", () => {
    expect(fs.existsSync(SCHEMA_FILE)).toBe(true);
    expect(fs.readFileSync(SCHEMA_FILE, "utf-8")).toBe(buildCatalog());
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npx vitest run tests/unit/catalog.test.ts`
Expected: FAIL (no `SCENE_TYPES`, no catalog module).

- [ ] **Step 3: Implement**

In `src/schema/storyboard.ts` after `SceneSchema` is defined add:

```ts
export const SCENE_TYPES: readonly Scene["type"][] = SceneSchema.options.map((option) => option.shape.type.value);
```
(`Scene` is the type alias defined below the schema; if TypeScript complains about use-before-define for the type, move this line below the `Scene` type alias. If `.value` is not the Zod 4 literal accessor in the installed version, use `option.shape.type.def.values[0]`; run `node -e` against the schema to confirm and ledger it.)

`src/skill/catalog.ts`:

```ts
import { z } from "zod";
import { StoryboardSchema } from "../schema/storyboard";

/** JSON Schema of the storyboard contract. Refinements (cue rules, fact tracing, fit checks) are not representable and live in rules.md. */
export function buildCatalog(): string {
  const schema = z.toJSONSchema(StoryboardSchema, { unrepresentable: "any" });
  return `${JSON.stringify(schema, null, 2)}\n`;
}
```

`scripts/catalog.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import { buildCatalog } from "../src/skill/catalog";

const file = path.resolve(".claude/skills/make-explainer/storyboard.schema.json");
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, buildCatalog());
console.log(`wrote ${file}`);
```

`package.json` scripts: add `"catalog": "tsx scripts/catalog.ts"`.

- [ ] **Step 4: Generate and verify GREEN**

Run: `npm run catalog && npm run typecheck && npx vitest run tests/unit/catalog.test.ts`
Expected: file written; tests PASS. Open the generated file and confirm it contains the `timeline`, `map` and `compare` props with their limits (`maxItems`, `maxLength`); record its size in the ledger.

- [ ] **Step 5: Checkpoint (only if asked)**

`git add -A && git commit -m "feat: generated storyboard JSON Schema catalog with drift test"`

---

### Task 3: The review sheet

**Files:**
- Create: `src/skill/review.ts`, `src/skill/sheetRender.ts`, `scripts/sheet.ts`, `tests/unit/review.test.ts`, `tests/render/sheet.test.ts`
- Modify: `package.json`, `.gitignore`

**Interfaces:**
- Consumes: `checkStoryboard`, `estimateSeconds`, `adviceLint` (Task 1); `VerifyResult` (Task 4 produces it; the sheet accepts it optionally, so define the type in this task's file `src/skill/verifyTypes.ts` and import it from Task 4).
- Produces:
  - `type VerifyStatus = "supported" | "partial" | "not-found" | "unreachable" | "blocked"`, `type VerifyResult = { factId: string; url: string; status: VerifyStatus; found: string[]; missing: string[]; detail?: string }` in `src/skill/verifyTypes.ts`.
  - `escapeHtml(text: string): string`; `buildReviewModel(sb, facts, opts: { images: Record<string, string>; verify?: VerifyResult[] }): ReviewModel`; `renderReviewHtml(model): string`.
  - `ReviewModel = { title; scenes: { id; type; narration; image?: string; cues: string[]; factIds: string[] }[]; facts: { id; claim; sourceName; sourceUrl; verify?: VerifyStatus; flags: string[] }[]; warnings: string[]; stats: { scenes; words; estimatedSeconds } }`.
  - `npm run sheet -- --storyboard <p> --facts <p> --out <dir> [--verify <verify.json>]` writes `<dir>/review.html` (self-contained: stills embedded as data URIs, no scripts).
  - Review warnings (strings): digits in a title headline or kicker; callout text (`not traced to a fact; verify it`); digits in chart/race/compare/timeline/map titles; facts whose claim matches `/demo data|verify before publishing|placeholder|TODO/i`; facts no scene references; advice phrases; estimated length outside 55-60 s; every verify result that is not `supported`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/review.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import facts from "../../fixtures/finance.facts.json";
import storyboard from "../../fixtures/finance.storyboard.json";
import { parseFacts } from "../../src/schema/facts";
import { parseStoryboard } from "../../src/schema/storyboard";
import { buildReviewModel, escapeHtml, renderReviewHtml } from "../../src/skill/review";

const sb = parseStoryboard(storyboard);
const fx = parseFacts(facts);
const images = Object.fromEntries(sb.scenes.map((s) => [s.id, `data:image/png;base64,AAAA`]));

describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;");
  });
});

describe("buildReviewModel", () => {
  const model = buildReviewModel(sb, fx, { images });

  it("lists every scene with narration, cues, fact ids and its image", () => {
    expect(model.scenes.map((s) => s.id)).toEqual(sb.scenes.map((s) => s.id));
    const sp = model.scenes.find((s) => s.id === "sp500")!;
    expect(sp.factIds).toEqual(["f-sp"]);
    expect(sp.cues.join(" ")).toMatch(/callout.*2008: 903/);
    expect(sp.image).toBe(images.sp500);
  });

  it("warns about untraced on-screen text: title digits, callout text, chart titles", () => {
    const text = model.warnings.join("\n");
    expect(text).toMatch(/Scene "intro" \(title\).*17 Years of the S&P 500/);
    expect(text).toMatch(/Scene "sp500" callout "2008: 903" is not traced to a fact/);
  });

  it("flags placeholder facts (demo data) and unused facts", () => {
    expect(model.facts.find((f) => f.id === "f-sp")!.flags.join(" ")).toMatch(/placeholder/i);
    const extra = parseFacts({ facts: [...fx.facts, { id: "f-unused", claim: "c", value: 1, source: { name: "n", url: "https://example.com/" } }] });
    const m = buildReviewModel(sb, extra, { images });
    expect(m.warnings.join("\n")).toMatch(/fact "f-unused" is not used by any scene/);
  });

  it("turns verify results into per-fact status and warnings for anything not supported", () => {
    const m = buildReviewModel(sb, fx, {
      images,
      verify: [
        { factId: "f-sp", url: "https://x.test/", status: "supported", found: ["1468.36"], missing: [] },
        { factId: "f-drop", url: "https://x.test/", status: "not-found", found: [], missing: ["57"] },
      ],
    });
    expect(m.facts.find((f) => f.id === "f-sp")!.verify).toBe("supported");
    expect(m.warnings.join("\n")).toMatch(/fact "f-drop".*not-found/);
    expect(m.warnings.join("\n")).not.toMatch(/fact "f-sp".*supported/);
  });
});

describe("renderReviewHtml", () => {
  it("escapes model-written text everywhere and never emits a script tag or javascript: link", () => {
    const evilSb = parseStoryboard({
      schemaVersion: 1,
      meta: { title: "<script>alert(1)</script>", theme: "bold-flat", voice: "v" },
      audio: { music: null },
      scenes: [{ id: "s", type: "title", narration: `Hi <img src=x onerror=alert(1)> "quoted"`, props: { headline: "<b>H</b>" } }],
    });
    const evilFacts = parseFacts({
      facts: [{ id: "f", claim: `<script>x()</script>`, value: 1, source: { name: `"><script>`, url: "https://example.com/?a=1&b=<2>" } }],
    });
    const html = renderReviewHtml(buildReviewModel(evilSb, evilFacts, { images: { s: "data:image/png;base64,AAAA" } }));
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<img src=x/);
    expect(html).not.toMatch(/javascript:/i);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain('href="https://example.com/?a=1&amp;b=&lt;2&gt;"');
  });

  it("only links http(s) source URLs; embeds the stills as data URIs; is a complete document", () => {
    const html = renderReviewHtml(buildReviewModel(sb, fx, { images }));
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect((html.match(/<img /g) ?? []).length).toBe(sb.scenes.length);
    expect(html).toContain('src="data:image/png;base64,AAAA"');
    expect(html).toContain("Content-Security-Policy");
  });

  it("refuses an image that is not a PNG data URI", () => {
    const bad = buildReviewModel(sb, fx, { images: { ...images, intro: "https://evil.test/x.png" } });
    expect(() => renderReviewHtml(bad)).toThrow(/data URI/);
  });
});
```

`tests/render/sheet.test.ts`:

```ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderSheet } from "../../src/skill/sheetRender";

describe("renderSheet (history demo)", () => {
  it("writes a self-contained review.html with one embedded still per scene", async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "sheet-"));
    const file = await renderSheet({
      storyboardPath: path.resolve("fixtures/history.storyboard.json"),
      factsPath: path.resolve("fixtures/history.facts.json"),
      outDir: out,
    });
    const html = fs.readFileSync(file, "utf-8");
    expect(path.basename(file)).toBe("review.html");
    expect((html.match(/<img /g) ?? []).length).toBe(5);
    expect(html).toContain("data:image/png;base64,");
    expect(html).not.toMatch(/<script/i);
    for (const id of ["intro", "east-west", "people", "census", "veni"]) expect(html).toContain(id);
  }, 240000);
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npx vitest run tests/unit/review.test.ts`
Expected: FAIL, modules missing.

- [ ] **Step 3: Implement the model and HTML**

`src/skill/verifyTypes.ts`:

```ts
export type VerifyStatus = "supported" | "partial" | "not-found" | "unreachable" | "blocked";
export type VerifyResult = { factId: string; url: string; status: VerifyStatus; found: string[]; missing: string[]; detail?: string };
```

`src/skill/review.ts`:

```ts
import type { Facts } from "../schema/facts";
import type { Scene, Storyboard } from "../schema/storyboard";
import { adviceLint } from "./adviceLint";
import { TARGET_SECONDS, countWords, estimateSeconds } from "./estimate";
import type { VerifyResult, VerifyStatus } from "./verifyTypes";

export type ReviewModel = {
  title: string;
  scenes: { id: string; type: string; narration: string; image?: string; cues: string[]; factIds: string[] }[];
  facts: { id: string; claim: string; sourceName: string; sourceUrl: string; verify?: VerifyStatus; flags: string[] }[];
  warnings: string[];
  stats: { scenes: number; words: number; estimatedSeconds: number };
};

export const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const PLACEHOLDER = /demo data|verify before publishing|placeholder|todo/i;
const HAS_DIGIT = /\d/;

function factIdsOf(scene: Scene): string[] {
  switch (scene.type) {
    case "compare": return [scene.props.left.factId, scene.props.right.factId];
    case "title": case "kinetic-text": return [];
    default: return [scene.props.factId];
  }
}

function titleOf(scene: Scene): string | undefined {
  return scene.type === "title" || scene.type === "kinetic-text" || scene.type === "big-number" || scene.type === "quote"
    ? undefined
    : scene.props.title;
}

function untracedTextWarnings(scene: Scene): string[] {
  const out: string[] = [];
  if (scene.type === "title") {
    for (const text of [scene.props.headline, scene.props.kicker]) {
      if (text && HAS_DIGIT.test(text)) out.push(`Scene "${scene.id}" (title) shows a number that is not tied to a fact: "${text}"; verify it`);
    }
  }
  const title = titleOf(scene);
  if (title && HAS_DIGIT.test(title)) out.push(`Scene "${scene.id}" (${scene.type}) title contains a number that is not tied to a fact: "${title}"; verify it`);
  for (const cue of scene.cues) {
    if (cue.do === "callout" && cue.text) out.push(`Scene "${scene.id}" callout "${cue.text}" is not traced to a fact; verify it`);
  }
  return out;
}

export function buildReviewModel(
  sb: Storyboard,
  facts: Facts,
  opts: { images: Record<string, string>; verify?: VerifyResult[] },
): ReviewModel {
  const verifyById = new Map((opts.verify ?? []).map((v) => [v.factId, v]));
  const used = new Set(sb.scenes.flatMap(factIdsOf));
  const warnings: string[] = sb.scenes.flatMap(untracedTextWarnings);
  const narrations = sb.scenes.map((s) => s.narration);
  const estimatedSeconds = Math.round(estimateSeconds(narrations) * 10) / 10;
  if (estimatedSeconds < TARGET_SECONDS.min || estimatedSeconds > TARGET_SECONDS.max) {
    warnings.push(`estimated length ${estimatedSeconds} s is outside ${TARGET_SECONDS.min}-${TARGET_SECONDS.max} s`);
  }
  for (const hit of adviceLint(sb)) warnings.push(`Scene "${hit.sceneId}" narration contains advice-style phrasing: "${hit.phrase}"`);
  for (const fact of facts.facts) {
    if (!used.has(fact.id)) warnings.push(`fact "${fact.id}" is not used by any scene`);
    const v = verifyById.get(fact.id);
    if (v && v.status !== "supported") warnings.push(`fact "${fact.id}" source check: ${v.status}${v.detail ? ` (${v.detail})` : ""}`);
  }
  return {
    title: sb.meta.title,
    scenes: sb.scenes.map((s) => ({
      id: s.id,
      type: s.type,
      narration: s.narration,
      image: opts.images[s.id],
      cues: s.cues.map((c) => `${c.do} on "${c.atWord}"${c.text ? `: ${c.text}` : ""}${c.x !== undefined ? ` (x ${c.x})` : ""}`),
      factIds: factIdsOf(s),
    })),
    facts: facts.facts.map((f) => ({
      id: f.id,
      claim: f.claim,
      sourceName: f.source.name,
      sourceUrl: f.source.url,
      verify: verifyById.get(f.id)?.status,
      flags: PLACEHOLDER.test(f.claim) ? ["placeholder wording in the claim: replace with the verified claim"] : [],
    })),
    warnings,
    stats: { scenes: sb.scenes.length, words: narrations.reduce((n, t) => n + countWords(t), 0), estimatedSeconds },
  };
}

const IMAGE_URI = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;
const HTTP_URL = /^https?:\/\//i;

export function renderReviewHtml(model: ReviewModel): string {
  const e = escapeHtml;
  const scenes = model.scenes
    .map((s) => {
      if (s.image !== undefined && !IMAGE_URI.test(s.image)) throw new Error(`Scene "${s.id}": image must be a PNG data URI`);
      return `<section class="scene"><h3>${e(s.id)} <small>${e(s.type)}</small></h3>${
        s.image ? `<img src="${s.image}" alt="${e(s.id)}" width="270">` : ""
      }<p>${e(s.narration)}</p>${s.cues.length ? `<ul>${s.cues.map((c) => `<li>${e(c)}</li>`).join("")}</ul>` : ""}${
        s.factIds.length ? `<p class="meta">facts: ${s.factIds.map(e).join(", ")}</p>` : ""
      }</section>`;
    })
    .join("");
  const facts = model.facts
    .map((f) => {
      const link = HTTP_URL.test(f.sourceUrl) ? `<a href="${e(f.sourceUrl)}" rel="noopener noreferrer">${e(f.sourceName)}</a>` : e(f.sourceName);
      return `<tr><td>${e(f.id)}</td><td>${e(f.claim)}${f.flags.map((x) => `<br><b>${e(x)}</b>`).join("")}</td><td>${link}</td><td>${e(f.verify ?? "not checked")}</td></tr>`;
    })
    .join("");
  const warnings = model.warnings.length
    ? `<h2>Warnings</h2><ul>${model.warnings.map((w) => `<li>${e(w)}</li>`).join("")}</ul>`
    : "<h2>Warnings</h2><p>None.</p>";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>Review: ${e(model.title)}</title><style>body{font:14px system-ui;margin:24px;max-width:1200px;background:#fafafa;color:#111}.scene{display:inline-block;vertical-align:top;width:290px;margin:0 12px 24px 0}.scene img{border:1px solid #ccc;display:block}.meta,small{color:#666}table{border-collapse:collapse}td{border:1px solid #ddd;padding:4px 8px;vertical-align:top}</style></head><body><h1>${e(model.title)}</h1><p>${model.stats.scenes} scenes, ${model.stats.words} words, about ${model.stats.estimatedSeconds} s</p>${warnings}<h2>Scenes</h2>${scenes}<h2>Facts</h2><table><tr><td>id</td><td>claim</td><td>source</td><td>source check</td></tr>${facts}</table></body></html>`;
}
```

- [ ] **Step 4: Run to verify GREEN (unit)**

Run: `npm run typecheck && npx vitest run tests/unit/review.test.ts`
Expected: PASS. If the `escapeHtml` expectation for `'` differs, the test and implementation must agree on `&#39;`; fix the test only if the implementation is the documented behavior.

- [ ] **Step 5: Implement the renderer and CLI**

`src/skill/sheetRender.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import { renderStill, selectComposition } from "@remotion/renderer";
import { VIDEO } from "../design/tokens";
import { buildVideo } from "../pipeline/buildVideo";
import { getServeUrl } from "../pipeline/bundle";
import { parseFacts } from "../schema/facts";
import { parseStoryboard } from "../schema/storyboard";
import { synthWords } from "../voice/synthWords";
import { buildReviewModel, renderReviewHtml } from "./review";
import type { VerifyResult } from "./verifyTypes";

const SETTLE_MARGIN = 10; // frames before the exit fade, as in the snapshot tests

export type SheetOptions = { storyboardPath: string; factsPath: string; outDir: string; verifyPath?: string };

/** One settled still per scene (synthetic timing, no voice needed) plus review.html. Returns the html path. */
export async function renderSheet(opts: SheetOptions): Promise<string> {
  const read = (file: string): unknown => JSON.parse(fs.readFileSync(file, "utf-8"));
  const storyboardJson = read(opts.storyboardPath);
  const factsJson = read(opts.factsPath);
  const built = buildVideo(
    storyboardJson, factsJson,
    (sb) => Object.fromEntries(sb.scenes.map((s) => [s.id, synthWords(s.narration)])),
    VIDEO.fps,
  );
  fs.mkdirSync(opts.outDir, { recursive: true });
  const serveUrl = await getServeUrl();
  const inputProps = { scenes: built.scenes, captions: built.captions, totalFrames: built.totalFrames };
  const composition = await selectComposition({ serveUrl, id: "Production", inputProps });
  const images: Record<string, string> = {};
  for (const scene of built.scenes) {
    const file = path.join(opts.outDir, `${scene.id}.png`);
    const frame = scene.startFrame + Math.max(0, scene.durationFrames - SETTLE_MARGIN);
    await renderStill({ composition, serveUrl, output: file, frame, inputProps });
    images[scene.id] = `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
  }
  const verify = opts.verifyPath && fs.existsSync(opts.verifyPath) ? (read(opts.verifyPath) as VerifyResult[]) : undefined;
  const model = buildReviewModel(parseStoryboard(storyboardJson), parseFacts(factsJson), { images, verify });
  const htmlPath = path.join(opts.outDir, "review.html");
  fs.writeFileSync(htmlPath, renderReviewHtml(model));
  return htmlPath;
}
```

`scripts/sheet.ts`:

```ts
import path from "node:path";
import { parseFlags } from "../src/skill/flags";
import { renderSheet } from "../src/skill/sheetRender";

const { values } = parseFlags(process.argv.slice(2), { values: ["--storyboard", "--facts", "--out", "--verify"] });
const need = (flag: string): string => {
  const v = values.get(flag);
  if (!v) {
    console.error(`sheet failed: Missing required flag ${flag}`);
    process.exit(2);
  }
  return path.resolve(v);
};
renderSheet({
  storyboardPath: need("--storyboard"),
  factsPath: need("--facts"),
  outDir: need("--out"),
  verifyPath: values.get("--verify") ? path.resolve(values.get("--verify") as string) : undefined,
})
  .then((file) => console.log(`Review sheet: ${file}`))
  .catch((error: Error) => {
    console.error(`sheet failed: ${error.message}`);
    process.exit(1);
  });
```

`package.json` scripts: add `"sheet": "tsx scripts/sheet.ts"`. `.gitignore`: add `videos/*/review/`.

Note: if `Production` composition's `calculateMetadata` needs `totalFrames` in inputProps (it does) the object above supplies it; if `selectComposition` complains about extra props, match exactly what `produce.ts` passes and ledger it.

- [ ] **Step 6: Run the render test and look at the sheet**

Run: `npx vitest run tests/render/sheet.test.ts --testTimeout=240000 --no-file-parallelism`
Expected: PASS. Then run `npm run sheet -- --storyboard fixtures/history.storyboard.json --facts fixtures/history.facts.json --out out/sheet-check` and Read two of the produced PNGs (`out/sheet-check/people.png`, `veni.png`) to confirm they are settled frames of the right scenes.

- [ ] **Step 7: Checkpoint (only if asked)**

`git add -A && git commit -m "feat: self-contained review sheet with stills, facts and warnings"`

---

### Task 4: Fact verification (advisory, SSRF-guarded)

**Files:**
- Create: `src/skill/verifyFacts.ts`, `scripts/verify-facts.ts`, `tests/unit/verifyFacts.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `VerifyResult`, `VerifyStatus` (Task 3's `verifyTypes.ts`), `Facts`.
- Produces:
  - `isBlockedUrl(url: string): boolean` (non-http(s); hosts `localhost`, `*.localhost`, `*.local`, `*.internal`, `*.home.arpa`; IPv4 in 0/8, 10/8, 127/8, 169.254/16, 172.16/12, 192.168/16, 100.64/10; IPv6 loopback, unique-local `fc/fd`, link-local `fe80`; numeric or hex host forms that resolve to those).
  - `factTokens(fact): string[]` (deduped number strings to look for: plain, with thousands separators, for `value` facts, or every finite number in `dataset` as absolute values; BC years as their absolute value).
  - `htmlToText(html: string): string` (drops script/style, tags, decodes common entities, collapses whitespace).
  - `verifyFact(fact, fetchImpl, opts?): Promise<VerifyResult>`; `verifyFacts(facts: Facts, fetchImpl?): Promise<VerifyResult[]>`.
  - Status rules: blocked URL, `blocked`; fetch error, timeout or non-2xx, `unreachable` (detail says why); no tokens, `partial` with detail "nothing numeric to check"; coverage 1, `supported`; coverage >= 0.6, `partial`; otherwise `not-found`. Limits: 15 s timeout, 2 MB body cap, at most 3 redirects each re-checked with `isBlockedUrl`, content type must be text/html or text/plain or application/json (else `unreachable`).
  - `npm run verify-facts -- --facts <p> [--out <p>]` prints a table and writes the JSON array when `--out` is given; always exit 0 (advisory) unless the arguments are wrong (2).

- [ ] **Step 1: Write the failing tests**

`tests/unit/verifyFacts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseFacts } from "../../src/schema/facts";
import { factTokens, htmlToText, isBlockedUrl, verifyFact, verifyFacts } from "../../src/skill/verifyFacts";

const fact = (extra: Record<string, unknown>, url = "https://example.org/page") =>
  parseFacts({ facts: [{ id: "f", claim: "c", source: { name: "n", url }, ...extra }] }).facts[0];

const page = (body: string, init: ResponseInit = {}) =>
  new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" }, ...init });
const fetchOf = (...responses: (Response | Error)[]): typeof fetch => {
  const queue = [...responses];
  return (async () => {
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return next ?? page("");
  }) as unknown as typeof fetch;
};

describe("isBlockedUrl", () => {
  it("blocks non-http schemes, localhost, private, link-local and shared ranges", () => {
    for (const url of [
      "file:///etc/passwd", "ftp://example.org/x", "http://localhost/x", "http://api.localhost/", "http://printer.local/",
      "http://service.internal/", "http://127.0.0.1/", "http://10.1.2.3/", "http://172.16.0.1/", "http://172.31.255.255/",
      "http://192.168.1.1/", "http://169.254.169.254/latest/meta-data", "http://100.64.0.1/", "http://0.0.0.0/",
      "http://[::1]/", "http://[fd00::1]/", "http://[fe80::1]/", "http://2130706433/", "http://0x7f000001/",
    ]) {
      expect(isBlockedUrl(url), url).toBe(true);
    }
  });
  it("allows ordinary public https hosts, and 172.32 which is outside the private block", () => {
    expect(isBlockedUrl("https://www.bls.gov/cpi/")).toBe(false);
    expect(isBlockedUrl("https://en.wikipedia.org/wiki/Han_dynasty")).toBe(false);
    expect(isBlockedUrl("http://172.32.0.1/")).toBe(false);
  });
});

describe("factTokens", () => {
  it("uses the value in plain and comma forms", () => {
    expect(factTokens(fact({ value: 1468.36 }))).toEqual(expect.arrayContaining(["1468.36", "1,468.36"]));
    expect(factTokens(fact({ value: 57 }))).toEqual(["57"]);
  });
  it("uses every number in a dataset as absolute values (BC years included), deduped", () => {
    const tokens = factTokens(fact({ dataset: [{ year: -753, label: "x" }, { year: 476, label: "y" }, { year: 476, label: "z" }] }));
    expect(tokens).toEqual(expect.arrayContaining(["753", "476"]));
    expect(new Set(tokens).size).toBe(tokens.length);
  });
  it("is empty when the fact has no numbers", () => {
    expect(factTokens(fact({ dataset: ["Italy", "Spain"] }))).toEqual([]);
  });
});

describe("htmlToText", () => {
  it("drops scripts and styles, strips tags, decodes entities and collapses space", () => {
    const text = htmlToText("<style>a{}</style><script>var x=999;</script><p>A&nbsp;&amp;&nbsp;B <b>57.7</b></p>\n\n<p>million</p>");
    expect(text).toBe("A & B 57.7 million");
  });
});

describe("verifyFact", () => {
  it("is supported when every token appears as a whole number on the page", async () => {
    const r = await verifyFact(fact({ value: 57.7 }), fetchOf(page("<p>The census recorded 57.7 million people</p>")));
    expect(r.status).toBe("supported");
    expect(r.found).toContain("57.7");
  });
  it("does not accept a token that is only part of a larger number", async () => {
    const r = await verifyFact(fact({ value: 57 }), fetchOf(page("<p>about 157 and 570 and 5.7</p>")));
    expect(r.status).toBe("not-found");
  });
  it("is partial for 60 percent or more and not-found below", async () => {
    const f = fact({ dataset: [{ x: 11, y: 12 }, { x: 13, y: 14 }, { x: 15, y: 16 }] });
    expect((await verifyFact(f, fetchOf(page("11 12 13 14")))).status).toBe("partial");
    expect((await verifyFact(f, fetchOf(page("11 12")))).status).toBe("not-found");
  });
  it("is unreachable on network errors, timeouts, non-2xx and non-text content", async () => {
    const f = fact({ value: 5 });
    expect((await verifyFact(f, fetchOf(new Error("ECONNREFUSED")))).status).toBe("unreachable");
    expect((await verifyFact(f, fetchOf(new Response("no", { status: 404 })))).status).toBe("unreachable");
    expect((await verifyFact(f, fetchOf(new Response("%PDF", { status: 200, headers: { "content-type": "application/pdf" } })))).status).toBe("unreachable");
    const slow = (async (_u: unknown, init?: RequestInit) =>
      new Promise((_r, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))))) as unknown as typeof fetch;
    expect((await verifyFact(f, slow, { timeoutMs: 20 })).status).toBe("unreachable");
  });
  it("never fetches a blocked URL", async () => {
    let called = false;
    const spy = (async () => { called = true; return page(""); }) as unknown as typeof fetch;
    const r = await verifyFact(fact({ value: 5 }, "http://169.254.169.254/latest/meta-data"), spy);
    expect(r.status).toBe("blocked");
    expect(called).toBe(false);
  });
  it("re-checks every redirect hop and stops at three hops", async () => {
    const redirect = (to: string) => new Response(null, { status: 302, headers: { location: to } });
    const toPrivate = await verifyFact(fact({ value: 5 }), fetchOf(redirect("http://127.0.0.1/admin")));
    expect(toPrivate.status).toBe("blocked");
    const loop = await verifyFact(
      fact({ value: 5 }),
      fetchOf(redirect("https://a.test/1"), redirect("https://a.test/2"), redirect("https://a.test/3"), redirect("https://a.test/4")),
    );
    expect(loop.status).toBe("unreachable");
    expect(loop.detail).toMatch(/redirect/);
  });
  it("caps the body it reads and says nothing numeric when there is nothing to check", async () => {
    const huge = "x".repeat(3_000_000) + " 57.7";
    expect((await verifyFact(fact({ value: 57.7 }), fetchOf(page(huge)))).status).toBe("not-found");
    expect((await verifyFact(fact({ dataset: ["Italy"] }), fetchOf(page("Italy")))).detail).toMatch(/nothing numeric/);
  });
});

describe("verifyFacts", () => {
  it("returns one result per fact, in order", async () => {
    const facts = parseFacts({
      facts: [
        { id: "a", claim: "c", value: 1, source: { name: "n", url: "https://example.org/a" } },
        { id: "b", claim: "c", value: 2, source: { name: "n", url: "https://example.org/b" } },
      ],
    });
    const results = await verifyFacts(facts, fetchOf(page("1"), page("nothing")));
    expect(results.map((r) => [r.factId, r.status])).toEqual([["a", "supported"], ["b", "not-found"]]);
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npx vitest run tests/unit/verifyFacts.test.ts`
Expected: FAIL, module missing.

- [ ] **Step 3: Implement**

`src/skill/verifyFacts.ts`:

```ts
import type { Facts } from "../schema/facts";
import type { VerifyResult } from "./verifyTypes";

type Fact = Facts["facts"][number];
type FetchLike = typeof fetch;

const MAX_BODY_BYTES = 2_000_000;
const MAX_REDIRECTS = 3;
const DEFAULT_TIMEOUT_MS = 15_000;
const TEXT_TYPES = /^(text\/html|text\/plain|application\/json|application\/xhtml\+xml)/i;
const SUPPORTED_AT = 0.6;

function ipv4Octets(host: string): number[] | null {
  if (/^0x[0-9a-f]+$/i.test(host) || /^\d+$/.test(host)) {
    const n = host.startsWith("0x") || host.startsWith("0X") ? parseInt(host, 16) : Number(host);
    if (!Number.isFinite(n) || n > 0xffffffff) return null;
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  }
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  return m ? m.slice(1).map(Number) : null;
}

/** True for URLs the verifier must never fetch: non-web schemes, local names, and private/loopback/link-local addresses. */
export function isBlockedUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return true;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return true;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || /\.(localhost|local|internal)$/.test(host) || host.endsWith(".home.arpa")) return true;
  if (host.includes(":")) return host === "::1" || host === "::" || /^f[cd]/.test(host) || /^fe[89ab]/.test(host);
  const o = ipv4Octets(host);
  if (!o) return false;
  const [a, b] = o;
  return (
    a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
  );
}

function collectNumbers(value: unknown, out: number[]): void {
  if (typeof value === "number" && Number.isFinite(value)) out.push(Math.abs(value));
  else if (Array.isArray(value)) value.forEach((v) => collectNumbers(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => collectNumbers(v, out));
}

const withCommas = (n: number): string => n.toLocaleString("en-US", { maximumFractionDigits: 10 });

/** Number strings a page should contain if it backs the fact. */
export function factTokens(fact: Fact): string[] {
  const numbers: number[] = [];
  if (fact.value !== undefined) numbers.push(Math.abs(fact.value));
  collectNumbers(fact.dataset, numbers);
  const tokens = new Set<string>();
  for (const n of numbers) {
    tokens.add(String(n));
    if (Math.abs(n) >= 1000) tokens.add(withCommas(n));
  }
  return [...tokens];
}

const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'" };

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|amp|lt|gt|quot|apos|#39);/g, (e) => ENTITIES[e] ?? e)
    .replace(/\s+/g, " ")
    .trim();
}

const hasToken = (text: string, token: string): boolean =>
  new RegExp(`(?<![\\d.,])${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\d])`).test(text);

async function readCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return (await response.text()).slice(0, MAX_BODY_BYTES);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BODY_BYTES) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    size += value.length;
  }
  await reader.cancel().catch(() => undefined);
  return new TextDecoder().decode(Buffer.concat(chunks)).slice(0, MAX_BODY_BYTES);
}

export async function verifyFact(
  fact: Fact,
  fetchImpl: FetchLike = fetch,
  opts: { timeoutMs?: number } = {},
): Promise<VerifyResult> {
  const base = { factId: fact.id, url: fact.source.url, found: [] as string[], missing: [] as string[] };
  const tokens = factTokens(fact);
  let url = fact.source.url;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      if (isBlockedUrl(url)) return { ...base, status: "blocked", detail: `refusing to fetch ${url}` };
      const response = await fetchImpl(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": "motion-explainers-fact-check/1.0", accept: "text/html,text/plain,application/json" },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return { ...base, status: "unreachable", detail: "redirect without a location" };
        url = new URL(location, url).toString();
        continue;
      }
      if (response.status < 200 || response.status >= 300) return { ...base, status: "unreachable", detail: `HTTP ${response.status}` };
      if (!TEXT_TYPES.test(response.headers.get("content-type") ?? "")) {
        return { ...base, status: "unreachable", detail: `content type ${response.headers.get("content-type") ?? "unknown"} is not checkable text` };
      }
      if (tokens.length === 0) return { ...base, status: "partial", detail: "nothing numeric to check; read the source yourself" };
      const text = htmlToText(await readCapped(response));
      const found = tokens.filter((t) => hasToken(text, t));
      const missing = tokens.filter((t) => !found.includes(t));
      const coverage = found.length / tokens.length;
      const status = coverage === 1 ? "supported" : coverage >= SUPPORTED_AT ? "partial" : "not-found";
      return { ...base, status, found, missing };
    }
    return { ...base, status: "unreachable", detail: "too many redirects" };
  } catch (error) {
    return { ...base, status: "unreachable", detail: (error as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

/** Sequential on purpose: polite to the sources. */
export async function verifyFacts(facts: Facts, fetchImpl: FetchLike = fetch): Promise<VerifyResult[]> {
  const results: VerifyResult[] = [];
  for (const fact of facts.facts) results.push(await verifyFact(fact, fetchImpl));
  return results;
}
```

Note on the coverage rule: a fact's `supported` status only means the numbers appear on the page. It does not prove they mean what the claim says; the skill and the sheet say so, and the human gate decides. A dataset whose years appear on the page but whose values do not is `partial` or `not-found` by the 0.6 rule only when the values outnumber the years; the sheet shows the missing tokens so the reviewer can see which.

`scripts/verify-facts.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import { parseFacts } from "../src/schema/facts";
import { parseFlags } from "../src/skill/flags";
import { verifyFacts } from "../src/skill/verifyFacts";

try {
  const { values } = parseFlags(process.argv.slice(2), { values: ["--facts", "--out"] });
  const factsPath = values.get("--facts");
  if (!factsPath) throw new Error("Missing required flag --facts");
  const facts = parseFacts(JSON.parse(fs.readFileSync(factsPath, "utf-8")));
  verifyFacts(facts).then((results) => {
    for (const r of results) {
      const missing = r.missing.length ? ` missing: ${r.missing.slice(0, 8).join(", ")}` : "";
      console.log(`${r.status.padEnd(11)} ${r.factId}  ${r.url}${r.detail ? `  (${r.detail})` : ""}${missing}`);
    }
    console.log("Advisory only: a number on the page does not prove it means what the claim says. Read the source.");
    const out = values.get("--out");
    if (out) fs.writeFileSync(path.resolve(out), `${JSON.stringify(results, null, 2)}\n`);
  });
} catch (error) {
  console.error(`verify-facts failed: ${(error as Error).message}`);
  process.exit(2);
}
```

`package.json` scripts: add `"verify-facts": "tsx scripts/verify-facts.ts"`.

- [ ] **Step 4: Run to verify GREEN**

Run: `npm run typecheck && npx vitest run tests/unit/verifyFacts.test.ts`
Expected: PASS. If the "caps the body" test is slow, the 3 MB string is the cause; keep it (it pins the cap) but ensure it finishes under a second.

- [ ] **Step 5: Try it on real sources**

Run: `npm run verify-facts -- --facts fixtures/finance.facts.json`
Expected: a status line per fact. The demo facts are flagged "demo data", so `not-found` or `partial` results are expected and informative (they show the tool is not rubber-stamping). Record the statuses in the ledger.

- [ ] **Step 6: Checkpoint (only if asked)**

`git add -A && git commit -m "feat: advisory fact verification with a guarded fetcher"`

---

### Task 5: The skill and its guard tests

**Files:**
- Create: `.claude/skills/make-explainer/SKILL.md`, `.claude/skills/make-explainer/rules.md`, `tests/unit/skillFiles.test.ts`

**Interfaces:**
- Consumes: the four npm scripts (`check`, `sheet`, `verify-facts`, `produce`), `SCENE_TYPES`, the generated `storyboard.schema.json`, the three example storyboards.
- Produces: a discoverable project skill `make-explainer`. Guard tests: SKILL.md frontmatter (`name` equals the directory name, a `description` under 1024 characters that mentions `explainer` and `video`), at most 200 lines; every `npm run <script>` it or `rules.md` mentions exists in `package.json`; every `fixtures/...` or `src/...` path mentioned exists; `rules.md` has a `### <type>` heading for every `SCENE_TYPES` entry; SKILL.md contains the hard-rule phrases (`STOP`, `never edit`, `review gate`).

- [ ] **Step 1: Write the failing guard tests**

`tests/unit/skillFiles.test.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SCENE_TYPES } from "../../src/schema/storyboard";

const DIR = path.resolve(".claude/skills/make-explainer");
const skill = fs.readFileSync(path.join(DIR, "SKILL.md"), "utf-8");
const rules = fs.readFileSync(path.join(DIR, "rules.md"), "utf-8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf-8")) as { scripts: Record<string, string> };

const frontmatter = (text: string): Record<string, string> => {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) throw new Error("no frontmatter");
  return Object.fromEntries(m[1].split("\n").map((l) => [l.slice(0, l.indexOf(":")).trim(), l.slice(l.indexOf(":") + 1).trim()]));
};

describe("SKILL.md", () => {
  it("has valid frontmatter whose name matches its directory", () => {
    const fm = frontmatter(skill);
    expect(fm.name).toBe("make-explainer");
    expect(path.basename(DIR)).toBe(fm.name);
    expect(fm.description.length).toBeGreaterThan(40);
    expect(fm.description.length).toBeLessThanOrEqual(1024);
    expect(fm.description.toLowerCase()).toContain("explainer");
    expect(fm.description.toLowerCase()).toContain("video");
  });
  it("stays short enough to be read in full", () => {
    expect(skill.split("\n").length).toBeLessThanOrEqual(200);
  });
  it("keeps the hard rules and the human gate", () => {
    expect(skill).toMatch(/never edit/i);
    expect(skill).toMatch(/STOP/);
    expect(skill).toMatch(/review gate/i);
    expect(skill).toMatch(/never type a (figure|number)/i);
  });
});

describe("skill files reference real things", () => {
  const text = `${skill}\n${rules}`;
  it("every `npm run <script>` mentioned exists in package.json", () => {
    const scripts = [...text.matchAll(/npm run ([a-z][a-z0-9:-]*)/g)].map((m) => m[1]);
    expect(scripts.length).toBeGreaterThan(0);
    for (const s of scripts) expect(pkg.scripts[s], `npm run ${s}`).toBeDefined();
    for (const s of ["check", "sheet", "verify-facts", "produce", "catalog"]) expect(text).toContain(`npm run ${s}`);
  });
  it("every repo path mentioned exists", () => {
    const paths = [...text.matchAll(/`((?:fixtures|src|scripts)\/[A-Za-z0-9_./-]+)`/g)].map((m) => m[1]);
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) expect(fs.existsSync(p), p).toBe(true);
  });
  it("the schema and the example storyboards it points to are present", () => {
    expect(fs.existsSync(path.join(DIR, "storyboard.schema.json"))).toBe(true);
    for (const f of ["finance", "history", "ancient"]) expect(skill).toContain(`fixtures/${f}.storyboard.json`);
  });
});

describe("rules.md", () => {
  it("documents every scene type under its own heading", () => {
    for (const type of SCENE_TYPES) expect(rules, type).toContain(`### ${type}`);
  });
  it("covers cues, narration style, facts and finance safety", () => {
    for (const heading of ["## Cues", "## Narration style", "## Facts", "## Finance and investing"]) expect(rules).toContain(heading);
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npx vitest run tests/unit/skillFiles.test.ts`
Expected: FAIL (files missing).

- [ ] **Step 3: Write `.claude/skills/make-explainer/SKILL.md`**

```markdown
---
name: make-explainer
description: Use when the user asks to make, script or produce a 60-second vertical animated explainer video about finance, investing or history in this repo ("make a video about X", "/make-explainer <topic>"). Runs research, sourced facts, a validated storyboard, a human review gate and the final narrated render.
---

# Make a 60-second explainer

Turn a topic into a finished 1080x1920 video with this repo's pipeline. It costs nothing: you do the research, writing and repair; the scripts check and render. Work from the repo root. Read `.claude/skills/make-explainer/rules.md` before writing a storyboard.

## Hard rules

- Every number, date, name and quote on screen comes from a fact in `facts.json` whose source you actually opened with WebFetch. Never type a figure from memory. If you cannot source a claim, cut it.
- Never edit `src/`, `tests/`, the validators or this skill to make a storyboard pass. Fix the storyboard or the facts. Never change a fact's data to match a storyboard, or the reverse, without re-reading the source.
- STOP at the review gate (step 6). Do not run `npm run produce` until the user approves the review sheet.
- Finance and investing are educational and historical: no advice, no predictions, no "you should". Name the period and the source for every figure.

## Workflow

Everything for a video lives in `videos/<slug>/` (lowercase letters, digits, hyphens): `facts.json`, `storyboard.json`, `review/`.

1. **Brief.** Settle the topic, a one-sentence claim the video proves, and the audience. Ask one question only if the claim is unclear. Default voice `en-US-AndrewNeural`, music `null`.
2. **Research.** WebSearch, then WebFetch primary sources (BLS, Federal Reserve, SEC, company filings; Wikipedia or museum and library pages for history dates). Copy numbers from the page. Write 5 to 8 facts: `id`, `claim` (a full sentence with units and period, as the source states it), `value` for one number or `dataset` for the exact data a chart or list will show, and `source` with name and url. Never leave "demo data" wording in a claim.
3. **Verify.** `npm run verify-facts -- --facts videos/<slug>/facts.json --out videos/<slug>/verify.json`. For every `not-found`, `partial` or `unreachable`: reopen the source, fix or drop the fact. The tool is advisory; you own accuracy.
4. **Script and storyboard.** About 143 words of narration in total (55 to 60 seconds), 6 to 10 scenes, a hook in scene 1, one idea per scene, scene types varied (never three alike in a row). Use `storyboard.schema.json` for exact fields and limits and copy the shape of `fixtures/finance.storyboard.json`, `fixtures/history.storyboard.json` and `fixtures/ancient.storyboard.json`. Write `videos/<slug>/storyboard.json`.
5. **Check and repair.** `npm run check -- --storyboard videos/<slug>/storyboard.json --facts videos/<slug>/facts.json`. Fix every issue (each message names the scene and the fix) and re-run, at most 6 rounds; if something still blocks, report exactly what. Treat warnings (length, advice phrasing, untraced text) as things to fix or justify.
6. **Review gate.** `npm run sheet -- --storyboard videos/<slug>/storyboard.json --facts videos/<slug>/facts.json --verify videos/<slug>/verify.json --out videos/<slug>/review`. Tell the user to open `videos/<slug>/review/review.html`. Summarize: the claim, scene list, word count and estimated length, each fact with its source check, and every warning. Ask for approval or edits. STOP and wait.
7. **Produce.** After approval: `npm run produce -- --storyboard videos/<slug>/storyboard.json --facts videos/<slug>/facts.json --out out/<slug>`. It takes about two minutes. If it rejects the length or a scene is too short, change the narration, re-run `check`, produce again (voice audio is cached by text). Report the file path, length and loudness. Say plainly what you did not judge: voice quality, pronunciation, pacing and taste. Ask the user to watch it.

## When something goes wrong

- **A check message you do not understand:** it names a scene id; open that scene in `rules.md` for its limits. Do not guess the fix.
- **The fact and the scene disagree:** reopen the source. Correct whichever is wrong from the source, never by copying one onto the other.
- **A map region is not found:** use the atlas spelling the message suggests ("United States of America"); regions must overlap the `focus` box.
- **Voice problems (network):** `npm run produce` needs internet for Edge TTS; `--voice standin` gives silent-ish placeholder audio for a dry run only.
- **Setup missing:** run `npm install` and `npm run setup:tts` once.

## Output to the user

Keep it short: the file path, what the video claims, length, loudness, the facts and sources used, and any warning you accepted and why.
```

- [ ] **Step 4: Write `.claude/skills/make-explainer/rules.md`**

Write the file with these sections, each concise and exact (limits copied from the schemas; if a limit in this text disagrees with `storyboard.schema.json`, the schema is right and this file must be corrected):

```markdown
# Rules for storyboards

Read `storyboard.schema.json` for fields and limits. These rules cover what the schema cannot express. `npm run check` enforces them; run it often.

## Structure

`schemaVersion: 1`, `meta { title, theme: "bold-flat", voice }`, `audio { music: null }`, `scenes[]`. Scene ids are lowercase letters, digits and hyphens. Duration is never specified: each scene lasts as long as its narration plus a short tail.

## Scene types

Pick the scene type by the beat, not at random. No three of the same type in a row.

### title
Hook or section opener. `headline` (<= 80 chars, large text that must fit), optional `kicker` (<= 40). No cues. Numbers in a headline are not tied to a fact: keep them to what a source states and expect a review warning.

### big-number
One striking figure. `value`, `prefix`, `suffix`, `decimals`, `label`, `factId`. `value` must equal the fact's `value` exactly and display without rounding at `decimals` (use `decimals: 1` for 57.7). One optional `callout` cue (text <= 24).

### line-chart
A series over time. `points` (2-60, x strictly increasing) must equal the fact's `dataset` exactly (`[{x, y}]`). `xFormat: "year"` for years, `baseline: "zero"` unless the data is far from zero. The last value must display exactly at `decimals`. Up to 3 `callout` cues, each needs an `x` inside the chart range, and cues must be spoken left to right. Title <= 32 chars.

### bar-race
Ranking over time. `frames` (2-20, each `{label, values[{name,value}]}`) must equal the fact's `dataset`. At most 8 distinct names, `topN` 3-8, labels unique. One optional `callout` cue.

### kinetic-text
A statement as 1-4 big lines (each <= 14 chars, no digits: spell numbers out or use big-number). Up to 2 `emphasize` cues; each cue's `text` is a single word on screen.

### compare
Two values head to head. `left` and `right` are `{label (<= 14), value >= 0, factId}`, each equal to its own fact's `value`; shared `prefix`, `suffix`, `decimals`. One optional `callout` cue.

### quote
A sourced quotation. `quote` (<= 140) must appear in the fact's `claim` as the source words it, `attribution` (<= 28), `factId`. No cues.

### timeline
2-6 dated events, years strictly increasing, no year 0 (negative is BC). `events` must equal the fact's `dataset` (`[{year, label}]`, label <= 26). Exactly one `emphasize` cue per event, each cue's `text` a single word of that event's label, events spoken in chronological order.

### map
Countries lit on their spoken names (modern borders, shown as approximate). `regions` (1-6 atlas country names, e.g. "United States of America", "Czechia") must equal the fact's `dataset` (a string array, same order). `focus` is `[west, south, east, north]` with latitudes within +/-80 and every region overlapping it. Exactly one `emphasize` cue per region, `text` a single word of the region name.

## Cues

`{ "atWord": <word spoken in this scene's narration>, "occurrence": 1, "do": "callout" | "emphasize", "text": ..., "x": ... }`. `atWord` is matched to the narration ignoring case and punctuation; `occurrence` picks the nth repeat. A cue needs `text`. `x` is only for line-chart callouts. The visual lands on the spoken word, so put the cue on the word that names the thing.

## Narration style

- 143 words in total is the target for 55-60 seconds; `check` estimates it.
- Spell numbers out in narration ("fifty seven percent", "two thousand eight"); the screen shows the digits. Write "percent" and "dollars", never symbols.
- Short sentences. One idea per scene. Scene 1 is a hook, the last scene lands the claim. Narration must contain every cue word.

## Facts

`facts.json`: `{ "facts": [ { "id", "claim", "value"?, "dataset"?, "source": { "name", "url" } } ] }`. `url` is the page you opened. `claim` states what the source says, with units and period. Scene data must equal the fact exactly; `check` fails otherwise. Chart titles, callout text and title headlines are not traced, so keep them to what a fact states.

## Finance and investing

Educational and historical only. Past data stays in the past tense with its period. No recommendations, no predictions, no certainty words ("guaranteed", "risk-free"). If the topic is a product or strategy, describe how it works and its trade-offs, not whether to use it.
```

- [ ] **Step 5: Run to verify GREEN**

Run: `npm run typecheck && npx vitest run tests/unit/skillFiles.test.ts tests/unit/catalog.test.ts`
Expected: PASS. If the path-existence test finds a backticked path that is an illustrative example rather than a real file, change the text (do not loosen the test).

- [ ] **Step 6: Checkpoint (only if asked)**

`git add -A && git commit -m "feat: make-explainer skill with guard tests"`

---

### Task 6: Rehearsal (three real videos), README and docs

**Files:**
- Create: `videos/<slug-1>/`, `videos/<slug-2>/`, `videos/<slug-3>/` (each `facts.json`, `storyboard.json`), `README.md`
- Modify: `.claude/skills/make-explainer/SKILL.md` and `rules.md` (only if the rehearsal shows an unclear instruction; guard tests must stay green), `docs/superpowers/specs/2026-10-05-motion-explainers-design.md`, `spikes/RESULTS.md`, `.superpowers/progress.md` (ledger, gitignored)

**Rehearsal contract:** the executor follows `SKILL.md` exactly, as the skill's user would, for three topics, one per category. The human review gate in step 6 is **waived for this rehearsal only**, so execution can finish unattended: the executor builds the review sheet, reads it and the warnings itself, records its own review in the ledger as `Rehearsal: gate waived — user to review outputs`, and the resulting videos are labeled drafts. The skill text keeps the gate for real use. Topics (executor may swap one for an equivalent if a topic cannot be sourced from a page it can open, recording a ruling):
1. Finance: US inflation, 2015 to 2023, from the BLS CPI-U annual averages (line-chart plus a big-number).
2. Investing: compound interest and the Rule of 72 (computed figures sourced from a page that states the formula or an Investor.gov calculator; use compare or big-number, and a kinetic-text).
3. History: the Roman Republic's last century or another dated sequence with a Wikipedia source (timeline plus a map or a quote).

- [ ] **Step 1: Run the skill for topic 1 (finance)**

Follow SKILL.md steps 1 to 5 literally. Use WebSearch and WebFetch to open each source; copy numbers from the page. Run `npm run verify-facts`, fix or drop anything not found, write `storyboard.json`, run `npm run check` until `OK` (count the repair rounds). Expected: `OK`, estimated length 55-60 s (or a justified warning), verify statuses `supported` for the numeric facts.

- [ ] **Step 2: Sheet, self-review, produce**

Run `npm run sheet ...` as in step 6, Read the stills and the warnings, and record the executor's review in the ledger. Run `npm run produce ...` as in step 7 with `--out out/<slug>`. Expected: produced mp4 between 55 and 60 s (the produce gate enforces it), loudness within -14 +/- 1 LUFS. Extract two frames at cue moments and Read them. If produce rejects the length, adjust narration and repeat (this exercises the skill's guidance).

- [ ] **Step 3: Repeat for topics 2 and 3**

Same procedure. For each video record in the ledger: topic, number of facts, `verify-facts` statuses, repair rounds, warnings accepted and why, produce time, final length, loudness, and anything in the skill's instructions that was unclear or wrong. Expected: three videos under `out/`, three folders under `videos/`.

- [ ] **Step 4: Fix the skill where the rehearsal exposed gaps**

For each unclear instruction or missing rule found, edit `SKILL.md` or `rules.md` (and add or adjust the guard test if the change adds a script or scene reference). Ledger each change as `Ruling:` with the evidence from the rehearsal. Do not weaken a hard rule.

- [ ] **Step 5: README and docs**

`README.md` (accurate, under 80 lines): what the project is; one-time setup (`npm install`, `npm run setup:tts`, system `ffmpeg`, Python 3); the one command (`/make-explainer <topic>` in Claude Code); the manual commands (`check`, `verify-facts`, `sheet`, `produce`, `catalog`, `test`, `test:render`, `studio`); the folder layout (`videos/<slug>/`, `out/<slug>/`, `fixtures/`, `docs/superpowers/`); the guarantees (every on-screen number traces to a fact; the human gate) and the limits (Edge TTS needs internet, modern borders on maps, no investment advice, taste is human-judged).

Spec: replace section 7's `skill/` location and flow with the as-built description (project skill at `.claude/skills/make-explainer/`, outputs in `videos/<slug>/`, scripts `check`, `verify-facts`, `sheet`, `catalog`, the hard rules and the gate, advice lint, estimated length from 2.68 words/s); mark milestone 7 done with the three rehearsal videos. `spikes/RESULTS.md`: "Plan 6 results" (per-video table from the ledger, repair rounds, verify outcomes, what the rehearsal changed in the skill, produce times) and "Open items" (what the user must judge: voice, pacing, taste; carried gaps: titles/callouts/chart titles untraced, quote truncation undetected, fonts from Google at render time, single-process rendering, Edge TTS needs internet).

- [ ] **Step 6: Full verification**

Run: `npm run typecheck && npm run test:cov && npm run test:render`
Expected: typecheck clean; unit tests PASS with coverage >= 80% on every included glob (including `src/skill/**`); render tests PASS serially (including `sheet.test.ts`). Report exact counts.

- [ ] **Step 7: Checkpoint (only if asked)**

`git add -A && git commit -m "feat: three rehearsal videos, README and skill documentation"`
