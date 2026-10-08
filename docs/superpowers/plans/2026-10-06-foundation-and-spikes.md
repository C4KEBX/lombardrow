# Motion Explainers: Plan 1 (Spikes + Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the two riskiest assumptions (free word-level TTS timings, render speed on this Intel Mac) and build the tested foundation: storyboard contract, cue timing, design tokens, motion primitives, and a rendered hello-world video.

**Architecture:** A Zod-validated `storyboard.json` + `facts.json` contract feeds a pure TypeScript layer (timing, validation, scene composition) that hands resolved scenes (frames, cue frames) to Remotion React components. Visuals are pure functions of `frame`. Non-visual logic is unit-tested with Vitest; visuals are covered by still-frame snapshots and one golden render.

**Tech Stack:** Node 24, TypeScript 5, Remotion 4.0.533 (all `remotion*` packages pinned to the same exact version), React 19, Zod 4, Vitest 5, pngjs, Python 3.11 + `edge-tts` 7.x (spike only), ffmpeg/ffprobe (installed).

**Spec:** `docs/superpowers/specs/2026-10-05-motion-explainers-design.md`

**Scope note:** This is Plan 1 of several. It covers spec milestones 1-2 plus the shared timing/validation code. Plan 2 (charts: `line-chart`, `bar-race`) is written after Task 11, because it depends on the spike results. Not in this plan: audio/captions/music (milestone 6), more scene types, the Claude Code skill.

## Global Constraints

- Output 1080x1920 (9:16), 30fps, h264 MP4.
- All `remotion` and `@remotion/*` packages pinned to the exact same version `4.0.533` (no `^`).
- Safe zones: top 8% (154px) and bottom 20% (384px) of 1920 stay clear of core content; side padding 60px.
- Data values animate with ease-out and **never overshoot**; springs (overshoot) only for objects/labels.
- Every number rendered on screen must trace to a `facts.json` entry with a source, and its value must equal the fact's value.
- No 3 identical scene types in a row.
- Total narration length 55-60s (enforced by `assertDuration`; hello-world is shorter and does not call it).
- Files under 800 lines; organized by feature; immutable data (no mutation of inputs).
- Zero paid services. TTS is Edge TTS (free) unless the spike fails.
- TDD for all non-visual logic; 80% coverage minimum on `src/schema`, `src/pipeline`, `src/design/motion.ts`, `src/design/layout.ts`.
- **No git commits unless the user explicitly asks** (user's global rule). Every "Checkpoint" step below shows the intended commit message; run it only if the user has asked. Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

Failure modes the spec implies but happy-path tests would miss, most likely first. Each has a pinning test in the task named.

1. Cue word typo'd by the LLM, absent from narration: must raise a clear error naming scene and word, never silently skip (Tasks 4, 8).
2. Cue word that repeats in narration ("the", "of"): `occurrence` must pick the right one (Task 4).
3. Symbol/punctuation mismatch between narration and cue: "S&P", "$1.5", "57%" must match their cue words (Task 4).
4. Big numbers: negative, decimal, very long (e.g. `-1,234,567.89`) must fit the 960px lane, and a count-up from zero must never display `-0` (Task 7).
5. Displayed value differs from the sourced fact (56.8 vs 57), or fact has no value to verify: rejected (Task 6).
6. `NaN`/`Infinity` values, empty narration word list, unknown scene type, duplicate fact ids: rejected with readable messages (Tasks 4, 5, 6).

## File Structure

```
package.json, tsconfig.json, .gitignore
spikes/                      word_timings.py, requirements.txt, RESULTS.md   (throwaway, results kept)
fixtures/                    hello.storyboard.json, hello.facts.json, hello.words.json
src/index.ts                 registerRoot
src/Root.tsx                 Composition list
src/spikes/RenderStress.tsx  render-speed benchmark composition
src/schema/timing.ts         WordTiming, resolveCue, msToFrame, sceneDurationMs
src/schema/storyboard.ts     Zod storyboard schema, parseStoryboard, StoryboardError
src/schema/facts.ts          Zod facts schema, parseFacts
src/schema/validate.ts       assertVariety, assertFactsTraceable, assertDuration
src/pipeline/resolveScene.ts composeScenes: storyboard + word timings -> frames
src/design/tokens.ts         VIDEO, SAFE, PALETTE
src/design/fonts.ts          Google font loading
src/design/motion.ts         easing + motion primitives
src/design/layout.ts         fitFontSize, formatNumber
src/scenes/types.ts          SceneRenderProps, ResolvedCue
src/scenes/title/Title.tsx
src/scenes/big-number/BigNumber.tsx
src/compose/Video.tsx        Series of scenes
src/testing/imageDiff.ts     PNG diff ratio
src/testing/renderHelpers.ts bundle once
tests/unit/*.test.ts         fast unit tests
tests/render/*.test.ts       slow snapshot + golden render tests
```

---

### Task 1: Scaffold project and tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `vitest.config.ts`

**Interfaces:**
- Produces: `npm test` (unit), `npm run test:cov`, `npm run test:render`, `npm run typecheck`, `npm run studio`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "motion-explainers",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run tests/unit",
    "test:cov": "vitest run tests/unit --coverage",
    "test:render": "vitest run tests/render --testTimeout=240000",
    "typecheck": "tsc --noEmit",
    "studio": "remotion studio src/index.ts",
    "bench": "remotion render src/index.ts RenderStress out/stress.mp4",
    "render:hello": "remotion render src/index.ts HelloBigNumber out/hello.mp4",
    "still:hello": "remotion still src/index.ts HelloBigNumber out/hello.png --frame=100"
  },
  "dependencies": {
    "@remotion/bundler": "4.0.533",
    "@remotion/cli": "4.0.533",
    "@remotion/google-fonts": "4.0.533",
    "@remotion/renderer": "4.0.533",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "remotion": "4.0.533",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "@types/pngjs": "^6.0.0",
    "@types/react": "^19.0.0",
    "@vitest/coverage-v8": "^5.0.0",
    "pngjs": "^7.0.0",
    "typescript": "^5.9.0",
    "vitest": "^5.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "types": ["node"]
  },
  "include": ["src", "tests", "fixtures", "vitest.config.ts"]
}
```

- [ ] **Step 3: Create `.gitignore` and `vitest.config.ts`**

`.gitignore`:
```
node_modules/
out/
coverage/
spikes/.venv/
spikes/out/
tests/render/_tmp/
.DS_Store
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      include: [
        "src/schema/**",
        "src/pipeline/**",
        "src/design/motion.ts",
        "src/design/layout.ts",
      ],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
```

- [ ] **Step 4: Install and verify**

Run: `cd "/Users/justinmason/Claude Code/motion-explainers" && git init && npm install`
Expected: install succeeds, `node_modules/` exists. (`git init` is not a commit.)

Run: `npx vitest run tests/unit`
Expected: "No test files found" (exit code 1 is fine here; real tests arrive in Task 4).

- [ ] **Step 5: Checkpoint** (commit only if the user asked): `chore: scaffold remotion + vitest project`

---

### Task 2: Spike A. Word-level timings from free TTS

**Files:**
- Create: `spikes/requirements.txt`, `spikes/word_timings.py`, `spikes/RESULTS.md`

**Interfaces:**
- Produces: the normalized word-timing JSON shape used everywhere later: `[{ "text": string, "startMs": number, "endMs": number }]`, plus a PASS/FAIL verdict on whether Edge TTS gives usable word boundaries.

This is a feasibility spike: its output is an answer, recorded in `spikes/RESULTS.md`. The script is throwaway; the JSON shape is not.

- [ ] **Step 1: Create `spikes/requirements.txt`**

```
edge-tts>=7.2,<8
```

- [ ] **Step 2: Create `spikes/word_timings.py`**

```python
"""Spike: does Edge TTS give usable word-level timings? Writes spikes/out/."""
import asyncio
import json
import re
import subprocess
import sys
from pathlib import Path

import edge_tts

TEXT = (
    "Between 2007 and 2009, the S&P 500 lost more than half of its value. "
    "Then it climbed for eleven straight years."
)
OUT = Path(__file__).parent / "out"
TICKS_PER_MS = 10_000  # Edge reports offsets in 100ns ticks


async def synth(voice: str):
    comm = edge_tts.Communicate(TEXT, voice, boundary="WordBoundary")
    audio, words = bytearray(), []
    async for chunk in comm.stream():
        if chunk["type"] == "audio":
            audio += chunk["data"]
        elif chunk["type"] == "WordBoundary":
            words.append({
                "text": chunk["text"],
                "startMs": chunk["offset"] / TICKS_PER_MS,
                "endMs": (chunk["offset"] + chunk["duration"]) / TICKS_PER_MS,
            })
    return bytes(audio), words


def audio_duration_ms(path: Path) -> float:
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=nw=1:nk=1", str(path),
    ])
    return float(out) * 1000


def verdict(words, audio_ms: float) -> list[str]:
    problems = []
    expected = len(re.findall(r"\S+", TEXT))
    if len(words) < expected * 0.9:
        problems.append(f"only {len(words)} word events for ~{expected} words")
    starts = [w["startMs"] for w in words]
    if starts != sorted(starts):
        problems.append("start offsets are not monotonic")
    if words and abs(words[-1]["endMs"] - audio_ms) > 400:
        problems.append(f"last word ends {words[-1]['endMs']:.0f}ms vs audio {audio_ms:.0f}ms")
    return problems


async def main(voice: str) -> int:
    OUT.mkdir(exist_ok=True)
    try:
        audio, words = await synth(voice)
    except Exception as exc:  # report, do not hide: this is the spike's answer
        print(f"FAIL: {type(exc).__name__}: {exc}")
        return 1
    mp3 = OUT / "narration.mp3"
    mp3.write_bytes(audio)
    (OUT / "words.json").write_text(json.dumps(words, indent=2))
    problems = verdict(words, audio_duration_ms(mp3))
    print(f"voice={voice} words={len(words)} sample={words[:3]}")
    print("PASS" if not problems else "FAIL: " + "; ".join(problems))
    return 0 if not problems else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "en-US-AndrewNeural")))
```

- [ ] **Step 3: Run the spike**

Run:
```bash
cd "/Users/justinmason/Claude Code/motion-explainers/spikes" && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && .venv/bin/python word_timings.py
```
Expected: a `voice=... words=N sample=[...]` line and either `PASS` or `FAIL: <reason>`. Needs internet (Edge TTS is a free online service).

- [ ] **Step 4: If PASS, listen and sanity-check; if FAIL, run the fallback**

PASS path: `open spikes/out/narration.mp3` and confirm the voice quality is acceptable to the user. Also run once with a second voice: `.venv/bin/python word_timings.py en-US-AriaNeural` to compare.

FAIL path (only if Step 3 failed): install whisper.cpp alignment and re-derive word timings from the audio.
```bash
brew install whisper-cpp ffmpeg
mkdir -p spikes/out && curl -L -o spikes/out/ggml-base.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
ffmpeg -y -i spikes/out/narration.mp3 -ar 16000 -ac 1 spikes/out/narration.wav
whisper-cli -m spikes/out/ggml-base.en.bin -f spikes/out/narration.wav -ojf -ml 1 -of spikes/out/aligned
```
Expected: `spikes/out/aligned.json` with one token per entry and millisecond offsets. Convert it to the `{text,startMs,endMs}` shape and re-run the same `verdict` checks. If the free `kokoro` route is preferred instead, note that in RESULTS.md as the next thing to try rather than starting it here.

- [ ] **Step 5: Record the result in `spikes/RESULTS.md`**

```markdown
# Spike Results

## A. Word-level TTS timings (date: 2026-10-06)
- Method tried: <edge-tts WordBoundary | whisper.cpp alignment>
- Verdict: <PASS | FAIL>
- Words returned vs expected: <n> / <n>
- Voice(s) tested and quality notes: <...>
- Decision for the pipeline: <use Edge TTS WordBoundary | use whisper.cpp alignment | other>
```
Fill every `<...>` with the actual observed values before moving on. Do not leave angle-bracket placeholders.

- [ ] **Step 6: Checkpoint** (commit only if the user asked): `chore: spike word-level tts timings`

---

### Task 3: Spike B. Render speed on this Mac

**Files:**
- Create: `src/spikes/RenderStress.tsx`, `src/Root.tsx`, `src/index.ts`
- Modify: `spikes/RESULTS.md`

**Interfaces:**
- Produces: `RenderStress` composition id (300 frames, 1080x1920, 30fps) and a measured seconds-per-frame figure for planning.

- [ ] **Step 1: Create the stress composition `src/spikes/RenderStress.tsx`**

A representative load: 60 springing SVG circles, a drawing path, and large text.

```tsx
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const DOTS = Array.from({ length: 60 }, (_, i) => i);

export const RenderStress: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: "#15133b" }}>
      <svg width={width} height={height}>
        {DOTS.map((i) => {
          const p = spring({ frame: frame - i * 2, fps, config: { damping: 12 } });
          const x = (i % 6) * 170 + 120;
          const y = Math.floor(i / 6) * 150 + 300 + Math.sin((frame + i * 5) / 15) * 30;
          return <circle key={i} cx={x} cy={y} r={20 + p * 30} fill={i % 2 ? "#ff5d5d" : "#ffd23f"} />;
        })}
        <path
          d="M60 1600 C 300 1200, 700 1900, 1020 1300"
          stroke="#2ee59d"
          strokeWidth={24}
          fill="none"
          strokeDasharray={1400}
          strokeDashoffset={interpolate(frame, [0, 240], [1400, 0], { extrapolateRight: "clamp" })}
        />
      </svg>
      <div style={{ position: "absolute", top: 120, left: 60, fontSize: 140, fontWeight: 900, color: "#fff7e8" }}>
        Render test
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Create `src/Root.tsx` and `src/index.ts`**

`src/Root.tsx`:
```tsx
import React from "react";
import { Composition } from "remotion";
import { RenderStress } from "./spikes/RenderStress";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="RenderStress"
      component={RenderStress}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
    />
  </>
);
```

`src/index.ts`:
```ts
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
```

- [ ] **Step 3: Measure**

Run: `cd "/Users/justinmason/Claude Code/motion-explainers" && time npm run bench`
Expected: progress output ending in `Rendered ... out/stress.mp4` (first run downloads headless Chrome, so run it twice and use the second timing). Note the real (wall) seconds.

- [ ] **Step 4: Compute and record**

Seconds per frame = wall seconds / 300. A 60s video is 1800 frames: estimate = 6 x the 300-frame time. Append to `spikes/RESULTS.md`:

```markdown
## B. Render speed (date: 2026-10-06)
- Machine: Intel Mac, 8 cores, 16 GB, macOS 12.6.3
- RenderStress, 300 frames, 1080x1920@30: <wall seconds> s  (<s/frame> s/frame)
- Estimated 60s video (1800 frames): <minutes> min
- Verdict: <acceptable (<10 min) | too slow, mitigation: ...>
```
Fill every `<...>` with measured numbers. If the estimate is over 10 minutes, record mitigations to try (lower concurrency/higher, `--scale`, fewer simultaneous SVG nodes) and re-measure one.

- [ ] **Step 5: Checkpoint** (commit only if the user asked): `chore: spike remotion render speed`

---

### Task 4: Cue timing resolver (TDD)

**Files:**
- Create: `src/schema/timing.ts`
- Test: `tests/unit/timing.test.ts`

**Interfaces:**
- Produces:
  - `type WordTiming = { text: string; startMs: number; endMs: number }`
  - `class CueResolutionError extends Error`
  - `normalizeWord(w: string): string`
  - `resolveCue(words: readonly WordTiming[], atWord: string, occurrence?: number): number` (returns startMs)
  - `msToFrame(ms: number, fps: number): number`
  - `sceneDurationMs(words: readonly WordTiming[], tailPadMs?: number): number`

- [ ] **Step 1: Write the failing tests `tests/unit/timing.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  CueResolutionError,
  msToFrame,
  normalizeWord,
  resolveCue,
  sceneDurationMs,
  type WordTiming,
} from "../../src/schema/timing";

const w = (text: string, startMs: number, endMs: number): WordTiming => ({ text, startMs, endMs });

const words = [
  w("It", 0, 150), w("lost", 150, 500), w("more", 500, 800), w("than", 800, 1000),
  w("half", 1000, 1500), w("of", 1500, 1650), w("its", 1650, 1800), w("value.", 1800, 2300),
];

describe("normalizeWord", () => {
  it("lowercases and strips punctuation and symbols", () => {
    expect(normalizeWord("S&P")).toBe("sp");
    expect(normalizeWord("57%")).toBe("57");
    expect(normalizeWord("$1.5")).toBe("15");
    expect(normalizeWord("value.")).toBe("value");
  });
  it("keeps non-ASCII letters", () => {
    expect(normalizeWord("Café")).toBe("café");
  });
});

describe("resolveCue", () => {
  it("returns the start of the matching word", () => {
    expect(resolveCue(words, "half")).toBe(1000);
  });
  it("matches regardless of case and trailing punctuation", () => {
    expect(resolveCue(words, "VALUE")).toBe(1800);
  });
  it("picks the requested occurrence of a repeated word", () => {
    const rep = [w("the", 0, 100), w("market", 100, 400), w("the", 400, 500), w("crash", 500, 900)];
    expect(resolveCue(rep, "the")).toBe(0);
    expect(resolveCue(rep, "the", 2)).toBe(400);
  });
  it("matches symbol-heavy tokens against their cue words", () => {
    const sym = [w("S&P", 0, 300), w("fell", 300, 600), w("57%", 600, 1100), w("to", 1100, 1200), w("$1.5", 1200, 1700)];
    expect(resolveCue(sym, "S&P")).toBe(0);
    expect(resolveCue(sym, "57")).toBe(600);
    expect(resolveCue(sym, "1.5")).toBe(1200);
  });
  it("throws a clear error when the cue word is not in the narration", () => {
    expect(() => resolveCue(words, "crash")).toThrow(CueResolutionError);
    expect(() => resolveCue(words, "crash")).toThrow(/"crash".*not found/);
  });
  it("throws when the requested occurrence does not exist", () => {
    expect(() => resolveCue(words, "half", 2)).toThrow(/occurrence 2/);
  });
  it("throws when the cue word has no letters or digits", () => {
    expect(() => resolveCue(words, "...")).toThrow(/no letters or digits/);
  });
  it("throws when there are no word timings", () => {
    expect(() => resolveCue([], "half")).toThrow(CueResolutionError);
  });
});

describe("msToFrame", () => {
  it("converts milliseconds to the nearest frame", () => {
    expect(msToFrame(1000, 30)).toBe(30);
    expect(msToFrame(2600, 30)).toBe(78);
    expect(msToFrame(0, 30)).toBe(0);
  });
});

describe("sceneDurationMs", () => {
  it("is the last word end plus the tail pad", () => {
    expect(sceneDurationMs(words)).toBe(2300 + 400);
    expect(sceneDurationMs(words, 1000)).toBe(3300);
  });
  it("throws on empty word timings", () => {
    expect(() => sceneDurationMs([])).toThrow(CueResolutionError);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/timing.test.ts`
Expected: FAIL, cannot resolve `../../src/schema/timing`.

- [ ] **Step 3: Implement `src/schema/timing.ts`**

```ts
export type WordTiming = { text: string; startMs: number; endMs: number };

export class CueResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CueResolutionError";
  }
}

export const DEFAULT_TAIL_PAD_MS = 400;

export const normalizeWord = (word: string): string =>
  word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

export function resolveCue(words: readonly WordTiming[], atWord: string, occurrence = 1): number {
  const target = normalizeWord(atWord);
  if (!target) {
    throw new CueResolutionError(`Cue word "${atWord}" has no letters or digits`);
  }
  let seen = 0;
  for (const word of words) {
    if (normalizeWord(word.text) === target) {
      seen += 1;
      if (seen === occurrence) return word.startMs;
    }
  }
  throw new CueResolutionError(
    `Cue word "${atWord}" (occurrence ${occurrence}) not found in narration`,
  );
}

export const msToFrame = (ms: number, fps: number): number => Math.round((ms / 1000) * fps);

export function sceneDurationMs(
  words: readonly WordTiming[],
  tailPadMs = DEFAULT_TAIL_PAD_MS,
): number {
  if (words.length === 0) {
    throw new CueResolutionError("Cannot derive scene duration from empty word timings");
  }
  return words[words.length - 1].endMs + tailPadMs;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/unit/timing.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Checkpoint** (commit only if the user asked): `feat: word-timing cue resolver`

---

### Task 5: Storyboard and facts schemas (TDD)

**Files:**
- Create: `src/schema/storyboard.ts`, `src/schema/facts.ts`
- Test: `tests/unit/storyboard.test.ts`, `tests/unit/facts.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `StoryboardError extends Error`
  - `StoryboardSchema`, `type Storyboard`, `type Scene`, `type TitleProps`, `type BigNumberProps`, `const TONES`
  - `parseStoryboard(input: unknown): Storyboard`
  - `FactsSchema`, `type Facts`, `parseFacts(input: unknown): Facts`
  - After parsing, `scene.cues` is always an array and `cue.occurrence` is always a number (defaults applied); `BigNumberProps` has `prefix`, `suffix` (default `""`), `decimals` (default 0), `tone` (default `"highlight"`).

- [ ] **Step 1: Write failing tests `tests/unit/storyboard.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { parseStoryboard, StoryboardError } from "../../src/schema/storyboard";

const valid = () => ({
  schemaVersion: 1,
  meta: { title: "Test", theme: "bold-flat", voice: "en-US-AndrewNeural" },
  audio: { music: null },
  scenes: [
    { id: "intro", type: "title", narration: "Hello there.", props: { headline: "Hello" } },
    {
      id: "n1", type: "big-number", narration: "It lost half.",
      props: { value: 57, suffix: "%", label: "drop", factId: "f1" },
      cues: [{ atWord: "half", do: "callout", text: "Half gone" }],
    },
  ],
});

describe("parseStoryboard", () => {
  it("accepts a valid storyboard and applies defaults", () => {
    const sb = parseStoryboard(valid());
    expect(sb.scenes[0].cues).toEqual([]);
    const n = sb.scenes[1];
    if (n.type !== "big-number") throw new Error("expected big-number");
    expect(n.props).toMatchObject({ prefix: "", suffix: "%", decimals: 0, tone: "highlight" });
    expect(n.cues[0].occurrence).toBe(1);
  });

  it("does not mutate its input", () => {
    const input = valid();
    const snapshot = JSON.stringify(input);
    parseStoryboard(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("rejects an unknown scene type", () => {
    const bad = valid();
    (bad.scenes[0] as { type: string }).type = "hologram";
    expect(() => parseStoryboard(bad)).toThrow(StoryboardError);
  });

  it("rejects a wrong schema version", () => {
    expect(() => parseStoryboard({ ...valid(), schemaVersion: 2 })).toThrow(StoryboardError);
  });

  it("rejects empty narration and empty scene list", () => {
    const a = valid();
    a.scenes[0].narration = "";
    expect(() => parseStoryboard(a)).toThrow(StoryboardError);
    expect(() => parseStoryboard({ ...valid(), scenes: [] })).toThrow(StoryboardError);
  });

  it("rejects NaN and Infinity values", () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      const sb = valid();
      (sb.scenes[1].props as { value: number }).value = bad;
      expect(() => parseStoryboard(sb)).toThrow(StoryboardError);
    }
  });

  it("rejects bad scene ids and out-of-range decimals", () => {
    const a = valid();
    a.scenes[0].id = "Has Spaces";
    expect(() => parseStoryboard(a)).toThrow(StoryboardError);
    const b = valid();
    (b.scenes[1].props as { decimals?: number }).decimals = 9;
    expect(() => parseStoryboard(b)).toThrow(StoryboardError);
  });

  it("rejects duplicate scene ids with a readable message", () => {
    const a = valid();
    a.scenes[1].id = "intro";
    expect(() => parseStoryboard(a)).toThrow(/duplicate scene id "intro"/i);
  });

  it("produces a human-readable error message", () => {
    expect(() => parseStoryboard({})).toThrow(/schemaVersion|meta|scenes/);
  });
});
```

`tests/unit/facts.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseFacts } from "../../src/schema/facts";
import { StoryboardError } from "../../src/schema/storyboard";

const fact = (id: string) => ({
  id, claim: "c", value: 57, source: { name: "S&P DJI", url: "https://www.spglobal.com/" },
});

describe("parseFacts", () => {
  it("accepts valid facts", () => {
    expect(parseFacts({ facts: [fact("f1"), fact("f2")] }).facts).toHaveLength(2);
  });
  it("rejects duplicate fact ids", () => {
    expect(() => parseFacts({ facts: [fact("f1"), fact("f1")] })).toThrow(StoryboardError);
  });
  it("rejects a fact without a valid source url", () => {
    const bad = { ...fact("f1"), source: { name: "x", url: "not a url" } };
    expect(() => parseFacts({ facts: [bad] })).toThrow(StoryboardError);
  });
  it("rejects an empty facts list", () => {
    expect(() => parseFacts({ facts: [] })).toThrow(StoryboardError);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/storyboard.test.ts tests/unit/facts.test.ts`
Expected: FAIL, cannot resolve the schema modules.

- [ ] **Step 3: Implement `src/schema/storyboard.ts`**

```ts
import { z } from "zod";

export class StoryboardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoryboardError";
  }
}

export const TONES = ["positive", "negative", "neutral", "highlight"] as const;

export const CueSchema = z.object({
  atWord: z.string().min(1),
  occurrence: z.number().int().min(1).default(1),
  do: z.enum(["callout", "emphasize"]),
  text: z.string().min(1).optional(),
});

const sceneBase = {
  id: z.string().regex(/^[a-z0-9-]+$/, "scene id must be lowercase letters, digits, hyphens"),
  narration: z.string().min(1),
  cues: z.array(CueSchema).default([]),
};

const TitleSceneSchema = z.object({
  ...sceneBase,
  type: z.literal("title"),
  props: z.object({
    headline: z.string().min(1).max(80),
    kicker: z.string().min(1).max(40).optional(),
  }),
});

const BigNumberSceneSchema = z.object({
  ...sceneBase,
  type: z.literal("big-number"),
  props: z.object({
    value: z.number(),
    prefix: z.string().max(4).default(""),
    suffix: z.string().max(6).default(""),
    decimals: z.number().int().min(0).max(4).default(0),
    label: z.string().min(1).max(60),
    factId: z.string().min(1),
    tone: z.enum(TONES).default("highlight"),
  }),
});

const SceneSchema = z.discriminatedUnion("type", [TitleSceneSchema, BigNumberSceneSchema]);

export const StoryboardSchema = z
  .object({
    schemaVersion: z.literal(1),
    meta: z.object({
      title: z.string().min(1),
      theme: z.literal("bold-flat"),
      voice: z.string().min(1),
    }),
    audio: z.object({ music: z.string().min(1).nullable() }),
    scenes: z.array(SceneSchema).min(1),
  })
  .superRefine((sb, ctx) => {
    const seen = new Set<string>();
    sb.scenes.forEach((scene, index) => {
      if (seen.has(scene.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["scenes", index, "id"],
          message: `duplicate scene id "${scene.id}"`,
        });
      }
      seen.add(scene.id);
    });
  });

export type Storyboard = z.output<typeof StoryboardSchema>;
export type Scene = Storyboard["scenes"][number];
export type TitleProps = Extract<Scene, { type: "title" }>["props"];
export type BigNumberProps = Extract<Scene, { type: "big-number" }>["props"];

export function parseStoryboard(input: unknown): Storyboard {
  const result = StoryboardSchema.safeParse(input);
  if (!result.success) throw new StoryboardError(z.prettifyError(result.error));
  return result.data;
}
```

`src/schema/facts.ts`:
```ts
import { z } from "zod";
import { StoryboardError } from "./storyboard";

const FactSchema = z.object({
  id: z.string().min(1),
  claim: z.string().min(1),
  value: z.number().optional(),
  source: z.object({ name: z.string().min(1), url: z.url() }),
});

export const FactsSchema = z
  .object({ facts: z.array(FactSchema).min(1) })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    data.facts.forEach((fact, index) => {
      if (seen.has(fact.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["facts", index, "id"],
          message: `duplicate fact id "${fact.id}"`,
        });
      }
      seen.add(fact.id);
    });
  });

export type Facts = z.output<typeof FactsSchema>;

export function parseFacts(input: unknown): Facts {
  const result = FactsSchema.safeParse(input);
  if (!result.success) throw new StoryboardError(z.prettifyError(result.error));
  return result.data;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/unit/storyboard.test.ts tests/unit/facts.test.ts && npm run typecheck`
Expected: all PASS, typecheck clean. If `z.prettifyError`, `z.url()` or `code: "custom"` is rejected by the installed Zod version, check the installed Zod 4 API with `grep -rn "prettifyError" node_modules/zod/package.json node_modules/zod/v4/core/*.d.ts | head` and adapt the call, keeping the tests unchanged.

- [ ] **Step 5: Checkpoint** (commit only if the user asked): `feat: storyboard and facts schemas`

---

### Task 6: Cross-field validation rules (TDD)

**Files:**
- Create: `src/schema/validate.ts`
- Test: `tests/unit/validate.test.ts`

**Interfaces:**
- Consumes: `Storyboard`, `StoryboardError` from `storyboard.ts`; `Facts` from `facts.ts`.
- Produces:
  - `assertVariety(sb: Storyboard): void`
  - `assertFactsTraceable(sb: Storyboard, facts: Facts): void`
  - `MIN_VIDEO_MS = 55_000`, `MAX_VIDEO_MS = 60_000`
  - `assertDuration(totalMs: number): void`

- [ ] **Step 1: Write the failing tests `tests/unit/validate.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { parseFacts } from "../../src/schema/facts";
import { parseStoryboard, StoryboardError } from "../../src/schema/storyboard";
import {
  assertDuration,
  assertFactsTraceable,
  assertVariety,
  MAX_VIDEO_MS,
  MIN_VIDEO_MS,
} from "../../src/schema/validate";

const title = (id: string) => ({ id, type: "title", narration: "Hi.", props: { headline: "Hi" } });
const num = (id: string, value: number, factId = "f1") => ({
  id, type: "big-number", narration: "Num.", props: { value, label: "l", factId },
});
const board = (scenes: unknown[]) =>
  parseStoryboard({
    schemaVersion: 1,
    meta: { title: "t", theme: "bold-flat", voice: "v" },
    audio: { music: null },
    scenes,
  });
const facts = (value?: number) =>
  parseFacts({ facts: [{ id: "f1", claim: "c", value, source: { name: "n", url: "https://example.com/" } }] });

describe("assertVariety", () => {
  it("passes when no 3 consecutive scenes share a type", () => {
    expect(() => assertVariety(board([title("a"), title("b"), num("c", 1), title("d")]))).not.toThrow();
  });
  it("rejects 3 identical consecutive scene types, naming them", () => {
    const sb = board([title("a"), title("b"), title("c")]);
    expect(() => assertVariety(sb)).toThrow(StoryboardError);
    expect(() => assertVariety(sb)).toThrow(/"a".*"b".*"c"/);
  });
  it("handles storyboards with fewer than 3 scenes", () => {
    expect(() => assertVariety(board([title("a")]))).not.toThrow();
  });
});

describe("assertFactsTraceable", () => {
  it("passes when the displayed value equals the sourced fact", () => {
    expect(() => assertFactsTraceable(board([num("n", 57)]), facts(57))).not.toThrow();
  });
  it("rejects a reference to an unknown fact id", () => {
    expect(() => assertFactsTraceable(board([num("n", 57, "nope")]), facts(57))).toThrow(/unknown fact "nope"/);
  });
  it("rejects a displayed value that differs from the fact", () => {
    expect(() => assertFactsTraceable(board([num("n", 57)]), facts(56.8))).toThrow(/57.*56\.8/);
  });
  it("rejects a fact that has no value to verify against", () => {
    expect(() => assertFactsTraceable(board([num("n", 57)]), facts(undefined))).toThrow(/no value/);
  });
  it("ignores scenes that show no number", () => {
    expect(() => assertFactsTraceable(board([title("a")]), facts(1))).not.toThrow();
  });
});

describe("assertDuration", () => {
  it("accepts 55s to 60s inclusive", () => {
    expect(() => assertDuration(MIN_VIDEO_MS)).not.toThrow();
    expect(() => assertDuration(MAX_VIDEO_MS)).not.toThrow();
  });
  it("rejects shorter and longer videos with the actual length", () => {
    expect(() => assertDuration(54_999)).toThrow(/55.*60/);
    expect(() => assertDuration(60_001)).toThrow(/60\.0/);
  });
  it("rejects NaN", () => {
    expect(() => assertDuration(NaN)).toThrow(StoryboardError);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/validate.test.ts`
Expected: FAIL, cannot resolve `../../src/schema/validate`.

- [ ] **Step 3: Implement `src/schema/validate.ts`**

```ts
import type { Facts } from "./facts";
import { StoryboardError, type Storyboard } from "./storyboard";

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

export function assertFactsTraceable(sb: Storyboard, facts: Facts): void {
  const byId = new Map(facts.facts.map((fact) => [fact.id, fact]));
  for (const scene of sb.scenes) {
    if (scene.type !== "big-number") continue;
    const fact = byId.get(scene.props.factId);
    if (!fact) {
      throw new StoryboardError(`Scene "${scene.id}" references unknown fact "${scene.props.factId}"`);
    }
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
  }
}

export function assertDuration(totalMs: number): void {
  if (!Number.isFinite(totalMs) || totalMs < MIN_VIDEO_MS || totalMs > MAX_VIDEO_MS) {
    throw new StoryboardError(
      `Video length ${(totalMs / 1000).toFixed(1)}s is outside the required ${MIN_VIDEO_MS / 1000}-${MAX_VIDEO_MS / 1000}s`,
    );
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/unit/validate.test.ts`
Expected: all PASS. (`(54999/1000).toFixed(1)` is `"55.0"`; the first duration assertion matches `/55.*60/` through the message's "required 55-60s" part, and `60.0` matches the second.)

- [ ] **Step 5: Checkpoint** (commit only if the user asked): `feat: storyboard validation rules`

---

### Task 7: Design tokens, motion primitives, layout helpers (TDD)

**Files:**
- Create: `src/design/tokens.ts`, `src/design/motion.ts`, `src/design/layout.ts`, `src/design/fonts.ts`
- Test: `tests/unit/tokens.test.ts`, `tests/unit/motion.test.ts`, `tests/unit/layout.test.ts`

**Interfaces:**
- Produces:
  - `VIDEO = { width: 1080, height: 1920, fps: 30 }`, `SAFE = { top: 154, bottom: 384, side: 60 }`, `PALETTE` with keys `ground, ink, positive, negative, neutral, highlight`
  - `clamp01(t)`, `easeOutCubic(t)`, `dataProgress(frame, startFrame, durationFrames)`, `staggerDelay(index, gapFrames?)`, `popIn(frame, fps, delayFrames?)`, `countUp(target, progress, decimals)`, `sustainDrift(frame, amplitudePx, periodFrames)`
  - `fitFontSize(text, maxWidthPx, maxSizePx, charWidthEm?)`, `formatNumber(value, decimals)`
  - `DISPLAY_FONT`, `BODY_FONT` (CSS font-family strings; not unit-tested because loading needs the Remotion runtime)

- [ ] **Step 1: Write failing tests**

`tests/unit/tokens.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { PALETTE, SAFE, VIDEO } from "../../src/design/tokens";

describe("tokens", () => {
  it("is 1080x1920 at 30fps", () => {
    expect(VIDEO).toEqual({ width: 1080, height: 1920, fps: 30 });
  });
  it("keeps the top 8% and bottom 20% safe", () => {
    expect(SAFE.top).toBe(Math.ceil(VIDEO.height * 0.08));
    expect(SAFE.bottom).toBe(Math.ceil(VIDEO.height * 0.2));
    expect(SAFE.side).toBe(60);
  });
  it("defines semantic palette colors as hex", () => {
    for (const color of Object.values(PALETTE)) expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(PALETTE.positive).not.toBe(PALETTE.negative);
  });
});
```

`tests/unit/motion.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  clamp01, countUp, dataProgress, easeOutCubic, popIn, staggerDelay, sustainDrift,
} from "../../src/design/motion";

describe("easeOutCubic (data easing)", () => {
  it("hits 0 and 1 at the ends", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });
  it("is monotonic and never overshoots 1, even for t beyond the range", () => {
    let prev = -1;
    for (let t = -0.5; t <= 2; t += 0.01) {
      const v = easeOutCubic(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(0);
      prev = v;
    }
  });
});

describe("dataProgress", () => {
  it("is 0 before start and exactly 1 after the duration", () => {
    expect(dataProgress(5, 10, 30)).toBe(0);
    expect(dataProgress(40, 10, 30)).toBe(1);
    expect(dataProgress(400, 10, 30)).toBe(1);
  });
  it("is partway in the middle", () => {
    const mid = dataProgress(25, 10, 30);
    expect(mid).toBeGreaterThan(0.5);
    expect(mid).toBeLessThan(1);
  });
  it("rejects a non-positive duration", () => {
    expect(() => dataProgress(1, 0, 0)).toThrow(RangeError);
  });
});

describe("countUp", () => {
  it("ends exactly at the target and never exceeds it", () => {
    for (const target of [57, 56.8, 1234567.89, -57]) {
      expect(countUp(target, 1, 2)).toBeCloseTo(target, 2);
      for (let p = 0; p <= 1; p += 0.05) {
        expect(Math.abs(countUp(target, p, 2))).toBeLessThanOrEqual(Math.abs(target) + 1e-9);
      }
    }
  });
  it("never produces negative zero", () => {
    expect(Object.is(countUp(-57, 0, 0), -0)).toBe(false);
    expect(Object.is(countUp(-0.001, 0.5, 0), -0)).toBe(false);
  });
  it("clamps progress outside 0..1", () => {
    expect(countUp(10, -1, 0)).toBe(0);
    expect(countUp(10, 5, 0)).toBe(10);
  });
});

describe("popIn (object spring)", () => {
  it("starts at 0, overshoots 1, and settles near 1", () => {
    expect(popIn(0, 30, 0)).toBe(0);
    const peak = Math.max(...Array.from({ length: 40 }, (_, f) => popIn(f, 30, 0)));
    expect(peak).toBeGreaterThan(1);
    expect(popIn(120, 30, 0)).toBeCloseTo(1, 2);
  });
  it("respects the delay", () => {
    expect(popIn(5, 30, 10)).toBe(0);
  });
});

describe("staggerDelay / sustainDrift / clamp01", () => {
  it("spaces items by the gap", () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(3)).toBe(12);
    expect(staggerDelay(2, 5)).toBe(10);
  });
  it("drifts within the amplitude and is periodic", () => {
    for (let f = 0; f < 200; f += 7) expect(Math.abs(sustainDrift(f, 10, 90))).toBeLessThanOrEqual(10);
    expect(sustainDrift(0, 10, 90)).toBeCloseTo(0, 6);
    expect(sustainDrift(90, 10, 90)).toBeCloseTo(0, 6);
  });
  it("clamps to 0..1", () => {
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(3)).toBe(1);
    expect(clamp01(0.4)).toBe(0.4);
  });
});
```

`tests/unit/layout.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { fitFontSize, formatNumber } from "../../src/design/layout";

describe("fitFontSize", () => {
  it("uses the max size for short text", () => {
    expect(fitFontSize("57%", 960, 340)).toBe(340);
  });
  it("shrinks long text so it fits the lane", () => {
    const text = "-$1,234,567.89";
    const size = fitFontSize(text, 960, 340);
    expect(size).toBeLessThan(340);
    expect(text.length * size * 0.68).toBeLessThanOrEqual(960);
  });
  it("handles empty text and rejects bad bounds", () => {
    expect(fitFontSize("", 960, 340)).toBe(340);
    expect(() => fitFontSize("x", 0, 340)).toThrow(RangeError);
    expect(() => fitFontSize("x", 960, -1)).toThrow(RangeError);
  });
});

describe("formatNumber", () => {
  it("groups thousands and fixes decimals", () => {
    expect(formatNumber(1234567.891, 2)).toBe("1,234,567.89");
    expect(formatNumber(57, 0)).toBe("57");
    expect(formatNumber(56.8, 1)).toBe("56.8");
  });
  it("never renders negative zero", () => {
    expect(formatNumber(-0, 0)).toBe("0");
  });
  it("keeps the sign of real negatives", () => {
    expect(formatNumber(-57, 0)).toBe("-57");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/tokens.test.ts tests/unit/motion.test.ts tests/unit/layout.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `src/design/tokens.ts`**

```ts
export const VIDEO = { width: 1080, height: 1920, fps: 30 } as const;

/** Pixels kept clear of platform UI: top 8%, bottom 20% of the height; fixed side padding. */
export const SAFE = {
  top: Math.ceil(VIDEO.height * 0.08),
  bottom: Math.ceil(VIDEO.height * 0.2),
  side: 60,
} as const;

/** Bold flat palette. Semantic roles are fixed: gains/losses are never decorative. */
export const PALETTE = {
  ground: "#15133b",
  ink: "#fff7e8",
  positive: "#2ee59d",
  negative: "#ff5d5d",
  neutral: "#7c8cff",
  highlight: "#ffd23f",
} as const;
```

`src/design/motion.ts`:
```ts
import { spring } from "remotion";

export const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/** Data easing: smooth deceleration, never overshoots. */
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3);

export function dataProgress(frame: number, startFrame: number, durationFrames: number): number {
  if (durationFrames <= 0) throw new RangeError("durationFrames must be positive");
  return easeOutCubic((frame - startFrame) / durationFrames);
}

export const staggerDelay = (index: number, gapFrames = 4): number => index * gapFrames;

/** Object easing: light overshoot spring. For shapes and labels, never for data values. */
export function popIn(frame: number, fps: number, delayFrames = 0): number {
  return spring({ frame: frame - delayFrames, fps, config: { damping: 11, stiffness: 140, mass: 0.7 } });
}

export function countUp(target: number, progress: number, decimals: number): number {
  const factor = 10 ** decimals;
  const value = Math.round(target * clamp01(progress) * factor) / factor;
  return value === 0 ? 0 : value; // normalizes -0 to 0
}

export const sustainDrift = (frame: number, amplitudePx: number, periodFrames: number): number =>
  Math.sin((frame / periodFrames) * 2 * Math.PI) * amplitudePx;
```

`src/design/layout.ts`:
```ts
/** Approximate advance width of the display face's digits, in em. Verified visually in Task 9. */
export const DISPLAY_CHAR_WIDTH_EM = 0.68;

export function fitFontSize(
  text: string,
  maxWidthPx: number,
  maxSizePx: number,
  charWidthEm = DISPLAY_CHAR_WIDTH_EM,
): number {
  if (maxWidthPx <= 0 || maxSizePx <= 0) throw new RangeError("maxWidthPx and maxSizePx must be positive");
  const chars = Math.max(1, text.length);
  return Math.min(maxSizePx, Math.floor(maxWidthPx / (chars * charWidthEm)));
}

export function formatNumber(value: number, decimals: number): string {
  const safe = value === 0 ? 0 : value; // -0 -> 0
  return safe.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
```

`src/design/fonts.ts`:
```ts
import { loadFont as loadBody } from "@remotion/google-fonts/Inter";
import { loadFont as loadDisplay } from "@remotion/google-fonts/ArchivoBlack";

export const DISPLAY_FONT = loadDisplay("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;
export const BODY_FONT = loadBody("normal", { weights: ["600"], subsets: ["latin"] }).fontFamily;
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/unit/tokens.test.ts tests/unit/motion.test.ts tests/unit/layout.test.ts && npm run typecheck`
Expected: all PASS, typecheck clean. If `spring` cannot be imported in plain Node (error from the `remotion` package in vitest), note the exact error and wrap the import with `vi.mock` only for that test file; do not change the primitive's behavior.

- [ ] **Step 5: Checkpoint** (commit only if the user asked): `feat: design tokens, motion primitives, layout helpers`

---

### Task 8: Compose scenes from storyboard + timings (TDD) and fixtures

**Files:**
- Create: `src/pipeline/resolveScene.ts`, `fixtures/hello.storyboard.json`, `fixtures/hello.facts.json`, `fixtures/hello.words.json`
- Test: `tests/unit/resolveScene.test.ts`

**Interfaces:**
- Consumes: `Storyboard`, `Scene` (Task 5); `resolveCue`, `msToFrame`, `sceneDurationMs`, `CueResolutionError`, `WordTiming` (Task 4).
- Produces:
  - `type ResolvedCue = { frame: number; do: "callout" | "emphasize"; text?: string }`
  - `type ComposedScene = { id: string; scene: Scene; cues: ResolvedCue[]; durationFrames: number }`
  - `composeScenes(sb: Storyboard, wordsByScene: Record<string, readonly WordTiming[]>, fps: number): ComposedScene[]`

- [ ] **Step 1: Create the hand-written fixtures**

`fixtures/hello.storyboard.json`:
```json
{
  "schemaVersion": 1,
  "meta": { "title": "Hello Big Number", "theme": "bold-flat", "voice": "en-US-AndrewNeural" },
  "audio": { "music": null },
  "scenes": [
    {
      "id": "intro",
      "type": "title",
      "narration": "In two thousand eight, the market broke.",
      "props": { "headline": "The S&P 500 in 2008", "kicker": "FINANCE" }
    },
    {
      "id": "drop",
      "type": "big-number",
      "narration": "It lost more than half of its value.",
      "props": { "value": 57, "suffix": "%", "label": "peak-to-trough drop", "factId": "f1", "tone": "negative" },
      "cues": [{ "atWord": "half", "do": "callout", "text": "Half gone" }]
    }
  ]
}
```

`fixtures/hello.facts.json` (fixture data for tests, not a vetted market fact):
```json
{
  "facts": [
    {
      "id": "f1",
      "claim": "S&P 500 peak-to-trough decline, Oct 2007 to Mar 2009 (fixture)",
      "value": 57,
      "source": { "name": "S&P Dow Jones Indices", "url": "https://www.spglobal.com/spdji/en/indices/equity/sp-500/" }
    }
  ]
}
```

`fixtures/hello.words.json`:
```json
{
  "intro": [
    { "text": "In", "startMs": 0, "endMs": 200 },
    { "text": "two", "startMs": 200, "endMs": 450 },
    { "text": "thousand", "startMs": 450, "endMs": 800 },
    { "text": "eight,", "startMs": 800, "endMs": 1100 },
    { "text": "the", "startMs": 1100, "endMs": 1250 },
    { "text": "market", "startMs": 1250, "endMs": 1650 },
    { "text": "broke.", "startMs": 1650, "endMs": 2200 }
  ],
  "drop": [
    { "text": "It", "startMs": 0, "endMs": 150 },
    { "text": "lost", "startMs": 150, "endMs": 500 },
    { "text": "more", "startMs": 500, "endMs": 800 },
    { "text": "than", "startMs": 800, "endMs": 1000 },
    { "text": "half", "startMs": 1000, "endMs": 1500 },
    { "text": "of", "startMs": 1500, "endMs": 1650 },
    { "text": "its", "startMs": 1650, "endMs": 1800 },
    { "text": "value.", "startMs": 1800, "endMs": 2300 }
  ]
}
```

- [ ] **Step 2: Write the failing test `tests/unit/resolveScene.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import facts from "../../fixtures/hello.facts.json";
import storyboard from "../../fixtures/hello.storyboard.json";
import words from "../../fixtures/hello.words.json";
import { composeScenes } from "../../src/pipeline/resolveScene";
import { parseFacts } from "../../src/schema/facts";
import { parseStoryboard } from "../../src/schema/storyboard";
import { CueResolutionError } from "../../src/schema/timing";
import { assertFactsTraceable, assertVariety } from "../../src/schema/validate";

const sb = () => parseStoryboard(storyboard);

describe("hello fixtures", () => {
  it("pass the validation rules", () => {
    expect(() => assertVariety(sb())).not.toThrow();
    expect(() => assertFactsTraceable(sb(), parseFacts(facts))).not.toThrow();
  });
});

describe("composeScenes", () => {
  it("derives scene durations in frames from the word timings", () => {
    const composed = composeScenes(sb(), words, 30);
    expect(composed.map((s) => s.durationFrames)).toEqual([78, 81]);
    expect(composed.map((s) => s.id)).toEqual(["intro", "drop"]);
  });

  it("resolves cue words to frames", () => {
    const [, drop] = composeScenes(sb(), words, 30);
    expect(drop.cues).toEqual([{ frame: 30, do: "callout", text: "Half gone" }]);
  });

  it("does not mutate the storyboard or the timings", () => {
    const board = sb();
    const before = JSON.stringify([board, words]);
    composeScenes(board, words, 30);
    expect(JSON.stringify([board, words])).toBe(before);
  });

  it("names the scene when word timings are missing", () => {
    expect(() => composeScenes(sb(), { intro: words.intro }, 30)).toThrow(/No word timings for scene "drop"/);
  });

  it("names the scene and word when a cue word is not in the narration", () => {
    const bad = parseStoryboard({
      ...storyboard,
      scenes: [
        storyboard.scenes[0],
        { ...storyboard.scenes[1], cues: [{ atWord: "crash", do: "callout", text: "x" }] },
      ],
    });
    expect(() => composeScenes(bad, words, 30)).toThrow(CueResolutionError);
    expect(() => composeScenes(bad, words, 30)).toThrow(/Scene "drop".*"crash"/);
  });

  it("rejects a scene whose word timings are empty", () => {
    expect(() => composeScenes(sb(), { intro: words.intro, drop: [] }, 30)).toThrow(CueResolutionError);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run tests/unit/resolveScene.test.ts`
Expected: FAIL, cannot resolve `../../src/pipeline/resolveScene`.

- [ ] **Step 4: Implement `src/pipeline/resolveScene.ts`**

```ts
import type { Scene, Storyboard } from "../schema/storyboard";
import {
  CueResolutionError,
  msToFrame,
  resolveCue,
  sceneDurationMs,
  type WordTiming,
} from "../schema/timing";

export type ResolvedCue = { frame: number; do: "callout" | "emphasize"; text?: string };

export type ComposedScene = {
  id: string;
  scene: Scene;
  cues: ResolvedCue[];
  durationFrames: number;
};

export function composeScenes(
  sb: Storyboard,
  wordsByScene: Record<string, readonly WordTiming[]>,
  fps: number,
): ComposedScene[] {
  return sb.scenes.map((scene) => {
    const words = wordsByScene[scene.id];
    if (!words) throw new CueResolutionError(`No word timings for scene "${scene.id}"`);
    try {
      const cues = scene.cues.map((cue) => ({
        frame: msToFrame(resolveCue(words, cue.atWord, cue.occurrence), fps),
        do: cue.do,
        text: cue.text,
      }));
      return { id: scene.id, scene, cues, durationFrames: msToFrame(sceneDurationMs(words), fps) };
    } catch (error) {
      if (error instanceof CueResolutionError) {
        throw new CueResolutionError(`Scene "${scene.id}": ${error.message}`);
      }
      throw error;
    }
  });
}
```

- [ ] **Step 5: Run to verify pass, then full unit suite with coverage**

Run: `npx vitest run tests/unit/resolveScene.test.ts && npm run test:cov`
Expected: PASS, and coverage thresholds (80% on the included globs) pass. If coverage fails, add the missing-branch tests to the owning module's test file before continuing.

- [ ] **Step 6: Checkpoint** (commit only if the user asked): `feat: compose scenes from storyboard and word timings`

---

### Task 9: Hello-world scenes, video, and composition (visual)

**Files:**
- Create: `src/scenes/types.ts`, `src/scenes/title/Title.tsx`, `src/scenes/big-number/BigNumber.tsx`, `src/compose/Video.tsx`
- Modify: `src/Root.tsx` (replace with the version below)

**Interfaces:**
- Consumes: `ComposedScene`, `ResolvedCue` (Task 8); `TitleProps`, `BigNumberProps`, `Scene` (Task 5); `PALETTE`, `SAFE`, `VIDEO` (Task 7); `popIn`, `dataProgress`, `countUp`, `staggerDelay`, `sustainDrift` (Task 7); `fitFontSize`, `formatNumber` (Task 7); `DISPLAY_FONT`, `BODY_FONT` (Task 7).
- Produces: composition id `HelloBigNumber`; `Video` component with prop `{ scenes: ComposedScene[] }`; `SceneRenderProps<P>`.

Visual work is verified by rendering and looking, then locked in by Task 10's snapshot.

- [ ] **Step 1: Create `src/scenes/types.ts`**

```ts
import type { ResolvedCue } from "../pipeline/resolveScene";

export type SceneRenderProps<P> = {
  props: P;
  cues: ResolvedCue[];
  durationFrames: number;
};
```

- [ ] **Step 2: Create `src/scenes/title/Title.tsx`**

```tsx
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BODY_FONT, DISPLAY_FONT } from "../../design/fonts";
import { popIn, staggerDelay, sustainDrift } from "../../design/motion";
import { PALETTE, SAFE } from "../../design/tokens";
import type { TitleProps } from "../../schema/storyboard";
import type { SceneRenderProps } from "../types";

export const Title: React.FC<SceneRenderProps<TitleProps>> = ({ props, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = props.headline.split(/\s+/);
  const exit = interpolate(frame, [durationFrames - 8, durationFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const kickerIn = popIn(frame, fps, 0);
  const drift = sustainDrift(frame, 8, 80);

  return (
    <AbsoluteFill
      style={{
        background: PALETTE.ground,
        opacity: exit,
        justifyContent: "center",
        padding: `${SAFE.top}px ${SAFE.side}px ${SAFE.bottom}px`,
      }}
    >
      {props.kicker && (
        <div
          style={{
            fontFamily: BODY_FONT,
            fontSize: 44,
            letterSpacing: 8,
            color: PALETTE.highlight,
            transform: `scale(${kickerIn})`,
            transformOrigin: "left center",
            marginBottom: 32,
          }}
        >
          {props.kicker}
        </div>
      )}
      <div style={{ transform: `translateY(${drift}px)`, display: "flex", flexWrap: "wrap", gap: "0 28px" }}>
        {words.map((word, i) => (
          <span
            key={`${word}-${i}`}
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: 190,
              lineHeight: 1.02,
              color: i % 2 === 0 ? PALETTE.ink : PALETTE.highlight,
              display: "inline-block",
              transform: `scale(${popIn(frame, fps, 6 + staggerDelay(i))})`,
              transformOrigin: "left bottom",
            }}
          >
            {word}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 3: Create `src/scenes/big-number/BigNumber.tsx`**

```tsx
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BODY_FONT, DISPLAY_FONT } from "../../design/fonts";
import { fitFontSize, formatNumber } from "../../design/layout";
import { countUp, dataProgress, popIn, staggerDelay, sustainDrift } from "../../design/motion";
import { PALETTE, SAFE, VIDEO } from "../../design/tokens";
import type { BigNumberProps } from "../../schema/storyboard";
import type { SceneRenderProps } from "../types";

const render = (p: BigNumberProps, value: number) =>
  `${p.prefix}${formatNumber(value, p.decimals)}${p.suffix}`;

export const BigNumber: React.FC<SceneRenderProps<BigNumberProps>> = ({ props, cues, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tone = PALETTE[props.tone];

  const progress = dataProgress(frame, 6, 45);
  const text = render(props, countUp(props.value, progress, props.decimals));
  const size = fitFontSize(render(props, props.value), VIDEO.width - 2 * SAFE.side - 120, 340);

  const block = popIn(frame, fps, 0);
  const numIn = popIn(frame, fps, staggerDelay(1));
  const labelIn = popIn(frame, fps, staggerDelay(2));
  const exit = interpolate(frame, [durationFrames - 8, durationFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const drift = sustainDrift(frame, 10, 90);
  const callout = cues.find((c) => c.do === "callout" && c.text);
  const calloutIn = callout ? popIn(frame, fps, callout.frame) : 0;

  return (
    <AbsoluteFill
      style={{
        background: PALETTE.ground,
        opacity: exit,
        justifyContent: "center",
        alignItems: "center",
        padding: `${SAFE.top}px ${SAFE.side}px ${SAFE.bottom}px`,
      }}
    >
      <div style={{ position: "relative", transform: `translateY(${drift}px)` }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: tone,
            transform: `translate(28px, 28px) rotate(-3deg) scale(${block})`,
          }}
        />
        <div
          style={{
            position: "relative",
            background: PALETTE.ink,
            padding: "40px 56px",
            transform: `rotate(-3deg) scale(${block})`,
          }}
        >
          <div
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: size,
              lineHeight: 1,
              color: PALETTE.ground,
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
              transform: `scale(${numIn})`,
            }}
          >
            {text}
          </div>
        </div>
        {callout && (
          <div
            style={{
              position: "absolute",
              top: -90,
              right: -20,
              background: tone,
              color: PALETTE.ground,
              fontFamily: DISPLAY_FONT,
              fontSize: 56,
              padding: "14px 30px",
              transform: `rotate(5deg) scale(${calloutIn})`,
            }}
          >
            {callout.text}
          </div>
        )}
      </div>
      <div
        style={{
          marginTop: 110,
          fontFamily: BODY_FONT,
          fontSize: 54,
          color: PALETTE.ink,
          textAlign: "center",
          transform: `scale(${labelIn})`,
        }}
      >
        {props.label}
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 4: Create `src/compose/Video.tsx`**

```tsx
import React from "react";
import { AbsoluteFill, Series } from "remotion";
import type { ComposedScene } from "../pipeline/resolveScene";
import { BigNumber } from "../scenes/big-number/BigNumber";
import { Title } from "../scenes/title/Title";
import { PALETTE } from "../design/tokens";

const SceneSwitch: React.FC<{ composed: ComposedScene }> = ({ composed }) => {
  const { scene, cues, durationFrames } = composed;
  switch (scene.type) {
    case "title":
      return <Title props={scene.props} cues={cues} durationFrames={durationFrames} />;
    case "big-number":
      return <BigNumber props={scene.props} cues={cues} durationFrames={durationFrames} />;
    default: {
      const unreachable: never = scene;
      throw new Error(`Unhandled scene type: ${JSON.stringify(unreachable)}`);
    }
  }
};

export const Video: React.FC<{ scenes: ComposedScene[] }> = ({ scenes }) => (
  <AbsoluteFill style={{ background: PALETTE.ground }}>
    <Series>
      {scenes.map((composed) => (
        <Series.Sequence key={composed.id} durationInFrames={composed.durationFrames}>
          <SceneSwitch composed={composed} />
        </Series.Sequence>
      ))}
    </Series>
  </AbsoluteFill>
);
```

- [ ] **Step 5: Replace `src/Root.tsx`**

```tsx
import React from "react";
import { Composition } from "remotion";
import facts from "../fixtures/hello.facts.json";
import storyboardJson from "../fixtures/hello.storyboard.json";
import words from "../fixtures/hello.words.json";
import { Video } from "./compose/Video";
import { VIDEO } from "./design/tokens";
import { composeScenes } from "./pipeline/resolveScene";
import { parseFacts } from "./schema/facts";
import { parseStoryboard } from "./schema/storyboard";
import { assertFactsTraceable, assertVariety } from "./schema/validate";
import { RenderStress } from "./spikes/RenderStress";

const storyboard = parseStoryboard(storyboardJson);
assertVariety(storyboard);
assertFactsTraceable(storyboard, parseFacts(facts));
const helloScenes = composeScenes(storyboard, words, VIDEO.fps);
const helloFrames = helloScenes.reduce((sum, s) => sum + s.durationFrames, 0);

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="HelloBigNumber"
      component={Video}
      durationInFrames={helloFrames}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
      defaultProps={{ scenes: helloScenes }}
    />
    <Composition
      id="RenderStress"
      component={RenderStress}
      durationInFrames={300}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
    />
  </>
);
```

- [ ] **Step 6: Typecheck, render stills, and look at them**

Run:
```bash
cd "/Users/justinmason/Claude Code/motion-explainers" && npm run typecheck
npx remotion still src/index.ts HelloBigNumber out/title.png --frame=40
npx remotion still src/index.ts HelloBigNumber out/number-early.png --frame=100
npx remotion still src/index.ts HelloBigNumber out/number-late.png --frame=150
```
Expected: typecheck clean, three PNGs in `out/`. **Open each PNG with the Read tool and check against this list:** headline words are readable and inside the safe zones; the number fits inside the card at full value (frame 150 shows `57%`, frame 100 shows a partial count-up); the callout badge "Half gone" appears at/after frame 30 of the second scene (frame 78+30=108, so visible in `number-late.png`, absent or just starting in `number-early.png`); the hard-offset color block sits behind the number card; nothing is cut off at the 1080x1920 edges. Fix visual defects before moving on. Adjust `DISPLAY_CHAR_WIDTH_EM` in `src/design/layout.ts` if the number is visibly wider or narrower than its card, then re-run `npm test`.

- [ ] **Step 7: Render the hello video and watch it**

Run: `npm run render:hello && open out/hello.mp4`
Expected: ~5.3s video. Confirm motion: title words pop in staggered with gentle drift, scene cut to the number, count-up with no overshoot past 57, the callout pops on the word "half". Note anything that looks unpolished (feeds Plan 2's design pass).

- [ ] **Step 8: Checkpoint** (commit only if the user asked): `feat: hello-world title and big-number scenes`

---

### Task 10: Render tests (snapshot + golden render)

**Files:**
- Create: `src/testing/imageDiff.ts`, `src/testing/renderHelpers.ts`
- Test: `tests/unit/imageDiff.test.ts`, `tests/render/hello.snapshot.test.ts`, `tests/render/hello.render.test.ts`
- Create (generated on first run, then reviewed): `tests/render/golden/hello-frame-100.png`, `tests/render/golden/hello-frame-150.png`

**Interfaces:**
- Consumes: composition id `HelloBigNumber` (Task 9).
- Produces: `diffRatio(a: PNG, b: PNG): number`; `getServeUrl(): Promise<string>`; `npm run test:render` as the visual regression gate.

- [ ] **Step 1: Write the failing unit test `tests/unit/imageDiff.test.ts`**

```ts
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { diffRatio } from "../../src/testing/imageDiff";

const solid = (w: number, h: number, rgb: [number, number, number]): PNG => {
  const png = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i += 1) {
    png.data[i * 4] = rgb[0];
    png.data[i * 4 + 1] = rgb[1];
    png.data[i * 4 + 2] = rgb[2];
    png.data[i * 4 + 3] = 255;
  }
  return png;
};

describe("diffRatio", () => {
  it("is 0 for identical images", () => {
    expect(diffRatio(solid(10, 10, [1, 2, 3]), solid(10, 10, [1, 2, 3]))).toBe(0);
  });
  it("is 1 for completely different images", () => {
    expect(diffRatio(solid(10, 10, [0, 0, 0]), solid(10, 10, [255, 255, 255]))).toBe(1);
  });
  it("ignores tiny antialiasing-level differences", () => {
    expect(diffRatio(solid(10, 10, [100, 100, 100]), solid(10, 10, [102, 100, 100]))).toBe(0);
  });
  it("is 1 when the sizes differ", () => {
    expect(diffRatio(solid(10, 10, [0, 0, 0]), solid(10, 12, [0, 0, 0]))).toBe(1);
  });
  it("measures the changed fraction", () => {
    const a = solid(10, 10, [0, 0, 0]);
    const b = solid(10, 10, [0, 0, 0]);
    for (let i = 0; i < 10; i += 1) b.data[i * 4] = 255; // first 10 of 100 pixels
    expect(diffRatio(a, b)).toBeCloseTo(0.1, 5);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/imageDiff.test.ts`
Expected: FAIL, cannot resolve `../../src/testing/imageDiff`.

- [ ] **Step 3: Implement `src/testing/imageDiff.ts` and `src/testing/renderHelpers.ts`**

`src/testing/imageDiff.ts`:
```ts
import type { PNG } from "pngjs";

const CHANNEL_SUM_THRESHOLD = 48; // ignores antialiasing-level noise

export function diffRatio(a: PNG, b: PNG): number {
  if (a.width !== b.width || a.height !== b.height) return 1;
  const pixels = a.width * a.height;
  let changed = 0;
  for (let i = 0; i < pixels; i += 1) {
    const o = i * 4;
    const delta =
      Math.abs(a.data[o] - b.data[o]) +
      Math.abs(a.data[o + 1] - b.data[o + 1]) +
      Math.abs(a.data[o + 2] - b.data[o + 2]);
    if (delta > CHANNEL_SUM_THRESHOLD) changed += 1;
  }
  return changed / pixels;
}
```

`src/testing/renderHelpers.ts`:
```ts
import path from "node:path";
import { bundle } from "@remotion/bundler";

let cached: Promise<string> | undefined;

/** Bundles the Remotion project once per test process. */
export function getServeUrl(): Promise<string> {
  cached ??= bundle({ entryPoint: path.resolve("src/index.ts") });
  return cached;
}
```

- [ ] **Step 4: Run to verify the unit test passes**

Run: `npx vitest run tests/unit/imageDiff.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the snapshot test `tests/render/hello.snapshot.test.ts`**

```ts
import fs from "node:fs";
import path from "node:path";
import { renderStill, selectComposition } from "@remotion/renderer";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { diffRatio } from "../../src/testing/imageDiff";
import { getServeUrl } from "../../src/testing/renderHelpers";

const GOLDEN_DIR = path.resolve("tests/render/golden");
const TMP_DIR = path.resolve("tests/render/_tmp");
const MAX_DIFF = 0.002; // 0.2% of pixels
const FRAMES = [100, 150]; // number mid count-up; number settled with callout

describe("HelloBigNumber visual snapshots", () => {
  for (const frame of FRAMES) {
    it(`frame ${frame} matches the golden image`, async () => {
      fs.mkdirSync(GOLDEN_DIR, { recursive: true });
      fs.mkdirSync(TMP_DIR, { recursive: true });
      const serveUrl = await getServeUrl();
      const composition = await selectComposition({ serveUrl, id: "HelloBigNumber" });
      const output = path.join(TMP_DIR, `hello-frame-${frame}.png`);
      await renderStill({ composition, serveUrl, output, frame });

      const golden = path.join(GOLDEN_DIR, `hello-frame-${frame}.png`);
      if (process.env.UPDATE_SNAPSHOTS === "1" || !fs.existsSync(golden)) {
        fs.copyFileSync(output, golden);
        return; // golden (re)written; review it by eye before trusting it
      }
      const ratio = diffRatio(PNG.sync.read(fs.readFileSync(output)), PNG.sync.read(fs.readFileSync(golden)));
      expect(ratio).toBeLessThanOrEqual(MAX_DIFF);
    });
  }
});
```

- [ ] **Step 6: Write the golden render test `tests/render/hello.render.test.ts`**

```ts
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { describe, expect, it } from "vitest";
import { getServeUrl } from "../../src/testing/renderHelpers";

describe("HelloBigNumber golden render", () => {
  it("produces a 1080x1920 30fps h264 video of the expected length", async () => {
    const tmp = path.resolve("tests/render/_tmp");
    fs.mkdirSync(tmp, { recursive: true });
    const outputLocation = path.join(tmp, "hello.mp4");
    const serveUrl = await getServeUrl();
    const composition = await selectComposition({ serveUrl, id: "HelloBigNumber" });
    await renderMedia({ composition, serveUrl, codec: "h264", outputLocation });

    const probe = JSON.parse(
      execFileSync("ffprobe", [
        "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=codec_name,width,height,r_frame_rate,duration",
        "-of", "json", outputLocation,
      ]).toString(),
    ).streams[0];

    expect(probe.codec_name).toBe("h264");
    expect(probe.width).toBe(1080);
    expect(probe.height).toBe(1920);
    expect(probe.r_frame_rate).toBe("30/1");
    expect(Number(probe.duration)).toBeCloseTo(composition.durationInFrames / composition.fps, 1);
    expect(composition.durationInFrames).toBe(159); // 78 + 81 frames from the fixtures
  });
});
```

- [ ] **Step 7: Generate goldens, review by eye, then run for real**

Run: `UPDATE_SNAPSHOTS=1 npm run test:render`
Expected: tests pass and `tests/render/golden/hello-frame-100.png` and `hello-frame-150.png` exist. **Open both with the Read tool and confirm they look correct** (same checklist as Task 9 Step 6) before trusting them as goldens.

Run: `npm run test:render`
Expected: both snapshot tests and the golden render PASS without `UPDATE_SNAPSHOTS`. Then change something visible on purpose (for example the `rotate(-3deg)` in `BigNumber.tsx` to `rotate(-8deg)`), re-run, confirm the snapshot test **fails**, and revert the change. This proves the gate actually catches regressions.

Note: `loadFont` fetches from Google Fonts at render time, so these tests need internet; a font load failure shows up as a render error, not a silent fallback.

- [ ] **Step 8: Checkpoint** (commit only if the user asked): `test: snapshot and golden render tests for hello-world`

---

### Task 11: Record results, amend the spec, hand off to Plan 2

**Files:**
- Modify: `spikes/RESULTS.md`, `docs/superpowers/specs/2026-10-05-motion-explainers-design.md`

- [ ] **Step 1: Run the full suite one last time**

Run: `npm run typecheck && npm run test:cov && npm run test:render`
Expected: all green, coverage thresholds met.

- [ ] **Step 2: Amend the spec with what the spikes proved**

In the spec's section 5 ("Voice, timing and captions"), replace the "Unverified assumption" bullet with the actual outcome copied from `spikes/RESULTS.md` (chosen timing method, voice, measured render speed). In section 11 (Risks), update the "Word-level timing" and "Render time" rows to reflect measured results and remove the "(not yet measured)" wording. Do not otherwise change the spec.

- [ ] **Step 3: Write the Plan 2 brief at the end of `spikes/RESULTS.md`**

```markdown
## Inputs for Plan 2 (charts)
- Timing method to build the voice step on: <from Spike A>
- Measured render budget: <s/frame>, so a 60s video costs about <minutes> min; chart scenes must stay within <guidance>
- Visual issues noticed in the hello render that the chart design pass should fix: <list from Task 9 Step 7>
- Scene library next: line-chart, bar-race (spec milestone 3)
```
Fill every `<...>` with the real values.

- [ ] **Step 4: Report to the user**

Summarize: spike verdicts, render time estimate, test/coverage status, link to `out/hello.mp4`, and ask whether to proceed to writing Plan 2 (charts). Ask whether they want the repo committed now (nothing has been committed so far).

- [ ] **Step 5: Checkpoint** (commit only if the user asked): `docs: record spike results and amend spec`
