# Motion Explainers: Plan 3 (Voice, Captions, Audio Finish) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a validated storyboard into a finished `final.mp4` with free narration, word-synced captions, a ducked music bed and normalized loudness, from one command.

**Architecture:** A voice provider returns `{audioPath, words, audioMs}` per scene. The real provider wraps Edge TTS (Python) and a pure alignment step that splits Edge's merged number events into per-token timings; a deterministic stand-in provider (gated noise) keeps tests and offline runs free. Scene durations come from the audio. Captions are a pure chunker plus a Remotion overlay in a fixed lane. Audio is mixed entirely with the system ffmpeg (narration clips delayed to scene starts, music ducked by sidechain compression, two-pass loudnorm to -14 LUFS) and muxed onto the frame-encoded video. A `produce` orchestrator and CLI run the whole chain.

**Tech Stack:** Existing stack plus `tsx` (CLI runner), Python 3.11 `edge-tts` 7.x in `tts/.venv`, system ffmpeg 9 (verified to have `sidechaincompress`, `loudnorm`, `anoisesrc`, `amix normalize=0`, `adelay`, `apad`).

**Spec:** `docs/superpowers/specs/2026-10-05-motion-explainers-design.md` (sections 5, 6, 8 milestone 6). Previous plans: `2026-10-06-foundation-and-spikes.md`, `2026-10-06-animated-charts.md`. Findings: `spikes/RESULTS.md` (sections A and C and the "Inputs for Plan 3" brief).

**Scope note:** Not in this plan: scene transitions, camera push, `kinetic-text`/`timeline`/`map`/`compare`/`quote` scenes, the script/fact-check Claude Code skill (Plan 4+). Music is a procedurally generated ambient bed (original, no license) or a user-supplied file from `music/`; no third-party tracks are bundled.

## Verified before writing this plan (on this machine)

- ffmpeg two-pass chain on synthetic clips: measured `-22.75` LUFS in, `-14.18` LUFS on the final AAC, 6.00s duration, stereo 44.1 kHz.
- Ducking: music mean level `-40.2 dB` without ducking vs `-54.6 dB` under narration, returning to `-31.4 dB` when narration stops (a graph label that is unused must be sunk with `anullsink`).
- Remotion 4.0.533 `Composition` accepts `calculateMetadata` returning `durationInFrames`; `selectComposition`/`renderFrames` accept `inputProps`.
- Edge TTS (spike): word events are one-per-word for plain words but merge any phrase containing digits ("$1.5 trillion to $700 billion" is one event); event `text` mirrors the source text.

## Global Constraints

- Everything from Plans 1 and 2 still applies: 1080x1920 @ 30fps; all `remotion*` pinned `4.0.533`; zod pinned `4.5.4`; data eases with no overshoot; files < 800 lines; immutable data; zero paid services; TDD with 80% coverage on `src/schema`, `src/pipeline`, `src/charts`, `src/voice`, `src/audio`, `src/captions`, `src/design/{motion,layout}.ts` (`src/pipeline/produce.ts` and `src/pipeline/bundle.ts` are excluded from unit coverage and covered by the end-to-end render test).
- **System ffmpeg only.** Remotion's bundled ffmpeg crashes on macOS 12; never use `renderMedia`, `remotion render` to MP4, or Remotion's `<Audio>`. Frames are rendered as JPEG sequences and everything audio is done with system ffmpeg.
- Loudness target `-14 LUFS` integrated, true peak `<= -1.5 dBTP`, tolerance +/- 1 LU in tests. Output audio AAC stereo 44.1 kHz.
- Captions live in a fixed lane (`CAPTION_LANE`, y 1340 to 1536, inside the safe zones). No scene content may enter the lane.
- Voice narration text is exactly the scene's `narration`; the cache key is `sha256(voice + "\n" + narration)` so a changed word or voice never reuses stale audio.
- Network access is only used by Edge TTS. All automated tests use the stand-in voice or injected fakes; the one live Edge test is skipped unless `RUN_NETWORK_TESTS=1`.
- **No git commits unless the user explicitly asks.** Each "Checkpoint" step names the intended message; run it only if asked. Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

Failure modes the spec implies but happy-path tests would miss, most likely first. Each has a pinning test in the task named.

1. Edge merges number/date phrases into one event: alignment must keep order, preserve the event's total span, and let a cue on a digit token ("2007") resolve to a plausible time (Tasks 2, 3).
2. The voice reads different text than the narration (dropped or extra words): a loud `VoiceAlignmentError`, never a silently shifted timeline (Task 2).
3. Narration tokens that normalize to nothing ("—", "&" alone) must not break alignment (Task 2).
4. Cue-token collisions: "$1.5" vs "15", "1,200" vs "1200" (Task 1).
5. Audio longer than its word timings (tail breath, trailing silence): the scene must be at least as long as the audio so narration is never cut (Task 4).
6. Voice/network failure: a clear error that names the fix; a failed run must not leave a cache entry that later looks valid (Task 3).
7. Music selection: `"ambient"` generates; a file name with `/`, `..` or other unsafe characters, or a missing file, is rejected; music shorter than the video loops (Tasks 7, 9).
8. Loudness of silent or near-silent audio cannot be normalized: a clear error, not a NaN filter graph (Task 8).
9. Captions: a single word longer than the line limit, empty word lists, long pauses, sentence ends (Task 5); captions never overlap chart or title content (Task 6).
10. Audio shorter than video (tail) is padded so the mux never truncates the video; total length enforcement of 55-60s (Tasks 8, 9).
11. Known gap, not tested: the quality and pronunciation of the Edge voice itself (needs a human listener).

## File Structure

```
package.json                         modify: tsx, scripts (setup:tts, produce)
vitest.config.ts                     modify: coverage globs and exclusions
tts/tts.py, tts/requirements.txt     create: Edge TTS adapter (python)
music/README.md                      create: music policy and license note
scripts/produce.ts                   create: CLI entry
src/schema/timing.ts                 modify: normalizeWord keeps decimal points
src/schema/validate.ts               (unchanged)
src/voice/align.ts                   create: alignEvents, spokenWeight, VoiceAlignmentError
src/voice/types.ts                   create: VoiceResult, VoiceProvider
src/voice/edge.ts                    create: Edge provider with cache
src/voice/standin.ts                 create: synthWords (moved), gated-noise provider
src/voice/index.ts                   create: makeVoiceProvider
src/audio/probe.ts                   create: probeDurationMs, meanVolumeDb
src/audio/graph.ts                   create: buildAudioGraph, parseLoudnorm
src/audio/music.ts                   create: ambient bed generator, resolveMusic
src/audio/mix.ts                     create: mixAudio, measureLoudness, runFfmpeg
src/captions/chunk.ts                create: chunkWords, chunkAt, activeWordIndex, buildCaptions
src/captions/Captions.tsx            create: caption overlay component
src/pipeline/resolveScene.ts         modify: words, startFrame, audio-derived durations
src/pipeline/buildVideo.ts           modify: audioMsByScene, captions
src/pipeline/finish.ts               create: muxVideoAudio
src/pipeline/bundle.ts               create: getServeUrl (moved)
src/pipeline/cli.ts                  create: parseArgs
src/pipeline/produce.ts              create: orchestrator
src/design/tokens.ts, src/charts/layout.ts, scenes/*  modify: caption lane layout
src/compose/Video.tsx, src/Root.tsx  modify: captions overlay, Production composition
fixtures/synthWords.ts               delete (moved to src/voice/standin.ts)
tests/unit/*.test.ts, tests/render/produce.test.ts, tests/render/edge.live.test.ts
```

---

### Task 1: Cue-token collisions (carry-over, TDD)

**Files:**
- Modify: `src/schema/timing.ts`, `tests/unit/timing.test.ts`
- Test: `tests/unit/normalizeWord.test.ts`

**Interfaces:**
- Produces: `normalizeWord` that keeps a decimal point between digits: `"$1.5"` -> `"1.5"`, `"15"` -> `"15"`, `"1,200"` -> `"1200"`, `"U.S."` -> `"us"`, `"3.14."` -> `"3.14"`.

- [ ] **Step 1: Write the failing tests `tests/unit/normalizeWord.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { normalizeWord, resolveCue, type WordTiming } from "../../src/schema/timing";

const w = (text: string, startMs: number, endMs: number): WordTiming => ({ text, startMs, endMs });

describe("normalizeWord keeps decimals distinct from integers", () => {
  it("keeps a decimal point between digits", () => {
    expect(normalizeWord("$1.5")).toBe("1.5");
    expect(normalizeWord("56.8")).toBe("56.8");
    expect(normalizeWord("3.14.")).toBe("3.14");
  });
  it("strips thousands separators and other punctuation", () => {
    expect(normalizeWord("1,200")).toBe("1200");
    expect(normalizeWord("57%")).toBe("57");
    expect(normalizeWord("value.")).toBe("value");
    expect(normalizeWord("S&P")).toBe("sp");
    expect(normalizeWord("U.S.")).toBe("us");
  });
  it("no longer lets '$1.5' and '15' collide", () => {
    expect(normalizeWord("$1.5")).not.toBe(normalizeWord("15"));
    const words = [w("15", 0, 300), w("$1.5", 300, 800)];
    expect(resolveCue(words, "1.5")).toBe(300);
    expect(resolveCue(words, "15")).toBe(0);
  });
  it("treats '2,007' and '2007' as the same token", () => {
    expect(normalizeWord("2,007")).toBe(normalizeWord("2007"));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/normalizeWord.test.ts`
Expected: FAIL (`"$1.5"` currently normalizes to `"15"`).

- [ ] **Step 3: Implement**

In `src/schema/timing.ts` replace `normalizeWord` with:
```ts
/** Lowercase letters/digits; a '.' survives only between two digits ("1.5" != "15"). */
export const normalizeWord = (word: string): string =>
  word
    .toLowerCase()
    .replace(/[^\p{L}\p{N}.]/gu, "")
    .replace(/(?<!\d)\.|\.(?!\d)/g, "");
```
In `tests/unit/timing.test.ts` update the two assertions that encoded the collision: change `expect(normalizeWord("$1.5")).toBe("15");` to `expect(normalizeWord("$1.5")).toBe("1.5");` (the `resolveCue(sym, "1.5")` assertion stays and still passes because both sides now normalize to `"1.5"`).

- [ ] **Step 4: Run to verify pass**

Run: `npm run typecheck && npm test`
Expected: all pass.

- [ ] **Step 5: Checkpoint** (only if asked): `fix: keep decimal points distinct in cue token normalization`

---

### Task 2: Voice alignment (TDD, pure)

**Files:**
- Create: `src/voice/align.ts`, `src/voice/types.ts`
- Test: `tests/unit/align.test.ts`

**Interfaces:**
- Consumes: `normalizeWord`, `WordTiming`, `assertValidWords` from `src/schema/timing.ts`.
- Produces:
  - `type RawEvent = { text: string; startMs: number; endMs: number }`
  - `class VoiceAlignmentError extends Error`
  - `spokenWeight(token: string): number` (letters 1, digits 2, `%` 6, `$` 6, `&` 3; at least 1)
  - `alignEvents(narration: string, events: readonly RawEvent[]): WordTiming[]` (one `WordTiming` per narration token that has letters or digits; merged events are split proportionally to `spokenWeight`)
  - (`types.ts`) `type VoiceResult = { audioPath: string; words: WordTiming[]; audioMs: number }`, `type VoiceProvider = (narration: string, voice: string) => Promise<VoiceResult>`

- [ ] **Step 1: Write the failing tests `tests/unit/align.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { VoiceAlignmentError, alignEvents, spokenWeight, type RawEvent } from "../../src/voice/align";
import { assertValidWords } from "../../src/schema/timing";

const ev = (text: string, startMs: number, endMs: number): RawEvent => ({ text, startMs, endMs });
const byText = (words: { text: string; startMs: number; endMs: number }[], text: string) =>
  words.find((w) => w.text === text)!;

describe("spokenWeight", () => {
  it("weights letters 1, digits 2, % and $ 6, & 3, and never below 1", () => {
    expect(spokenWeight("In")).toBe(2);
    expect(spokenWeight("2008,")).toBe(8);
    expect(spokenWeight("57%")).toBe(10);
    expect(spokenWeight("$700")).toBe(12);
    expect(spokenWeight("S&P")).toBe(5);
    expect(spokenWeight("...")).toBe(1);
  });
});

describe("alignEvents with one event per word", () => {
  it("passes timings through and keeps the narration's own token text", () => {
    const words = alignEvents("Stocks fell today.", [
      ev("Stocks", 100, 500), ev("fell", 500, 800), ev("today", 800, 1300),
    ]);
    expect(words).toEqual([
      { text: "Stocks", startMs: 100, endMs: 500 },
      { text: "fell", startMs: 500, endMs: 800 },
      { text: "today.", startMs: 800, endMs: 1300 },
    ]);
  });
});

describe("alignEvents splits merged number events", () => {
  const narration = "In 2008, the market fell 57% by March 2009.";
  const events = [
    ev("In 2008", 0, 1000), ev("the", 1000, 1200), ev("market", 1200, 1700), ev("fell", 1700, 2000),
    ev("57%", 2000, 2800), ev("by", 2800, 3000), ev("March 2009", 3000, 4400),
  ];
  it("returns one timing per narration token", () => {
    expect(alignEvents(narration, events).map((w) => w.text)).toEqual(
      ["In", "2008,", "the", "market", "fell", "57%", "by", "March", "2009."],
    );
  });
  it("splits a merged event proportionally to spoken weight and keeps its total span", () => {
    const words = alignEvents(narration, events);
    const inn = byText(words, "In");
    const year = byText(words, "2008,");
    expect(inn.startMs).toBe(0);
    expect(inn.endMs).toBeCloseTo(200, 6); // weight 2 of 10
    expect(year.startMs).toBeCloseTo(200, 6);
    expect(year.endMs).toBeCloseTo(1000, 6);
    const march = byText(words, "March");
    expect(march.startMs).toBe(3000);
    expect(march.endMs).toBeCloseTo(3000 + (1400 * 5) / 13, 6);
    expect(byText(words, "2009.").endMs).toBeCloseTo(4400, 6);
  });
  it("produces ordered, finite, valid timings", () => {
    expect(() => assertValidWords(alignEvents(narration, events))).not.toThrow();
  });
  it("splits a long merged money phrase by weight", () => {
    const text = "It rose from $1.5 trillion to $700 billion in 12 months.";
    const words = alignEvents(text, [
      ev("It", 0, 200), ev("rose", 200, 500), ev("from", 500, 800),
      ev("$1.5 trillion to $700 billion", 800, 4000),
      ev("in", 4000, 4200), ev("12", 4200, 4700), ev("months.", 4700, 5200),
    ]);
    expect(byText(words, "$1.5")).toMatchObject({ startMs: 800 });
    expect(byText(words, "$1.5").endMs).toBeCloseTo(1600, 6);
    expect(byText(words, "trillion").endMs).toBeCloseTo(2320, 6);
    expect(byText(words, "to").endMs).toBeCloseTo(2480, 6);
    expect(byText(words, "$700").endMs).toBeCloseTo(3440, 6);
    expect(byText(words, "billion").endMs).toBeCloseTo(4000, 6);
  });
});

describe("alignEvents robustness", () => {
  it("drops tokens with no letters or digits (a spoken dash)", () => {
    const words = alignEvents("Rates rose — then fell.", [
      ev("Rates", 0, 400), ev("rose", 400, 800), ev("then", 800, 1100), ev("fell", 1100, 1500),
    ]);
    expect(words.map((w) => w.text)).toEqual(["Rates", "rose", "then", "fell."]);
  });
  it("gives a token that spans two events the span of both", () => {
    const words = alignEvents("A well-known fact", [
      ev("A", 0, 100), ev("well", 100, 400), ev("known", 400, 800), ev("fact", 800, 1200),
    ]);
    expect(byText(words, "well-known")).toMatchObject({ startMs: 100, endMs: 800 });
  });
  it("ignores punctuation-only events", () => {
    const words = alignEvents("Hi there", [ev("Hi", 0, 300), ev("-", 300, 320), ev("there", 320, 700)]);
    expect(words.map((w) => w.text)).toEqual(["Hi", "there"]);
  });
  it("throws when the voice read different text than the narration", () => {
    expect(() => alignEvents("Hello world", [ev("Hello", 0, 300), ev("there", 300, 700)]))
      .toThrow(VoiceAlignmentError);
    expect(() => alignEvents("Hello world", [ev("Hello", 0, 300), ev("there", 300, 700)]))
      .toThrow(/differs from the narration/);
  });
  it("throws when the voice dropped a word", () => {
    expect(() => alignEvents("one two three", [ev("one", 0, 200), ev("three", 200, 500)]))
      .toThrow(/differs from the narration/);
  });
  it("throws when there are no events for non-empty narration", () => {
    expect(() => alignEvents("Hi", [])).toThrow(/no word events/);
  });
  it("returns an empty list for blank or symbol-only narration", () => {
    expect(alignEvents("   ", [])).toEqual([]);
    expect(alignEvents("— —", [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/align.test.ts`
Expected: FAIL, cannot resolve `../../src/voice/align`.

- [ ] **Step 3: Implement `src/voice/types.ts` and `src/voice/align.ts`**

`src/voice/types.ts`:
```ts
import type { WordTiming } from "../schema/timing";

export type VoiceResult = { audioPath: string; words: WordTiming[]; audioMs: number };
export type VoiceProvider = (narration: string, voice: string) => Promise<VoiceResult>;
```

`src/voice/align.ts`:
```ts
import { normalizeWord, type WordTiming } from "../schema/timing";

export type RawEvent = { text: string; startMs: number; endMs: number };

export class VoiceAlignmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VoiceAlignmentError";
  }
}

/** Rough spoken length of a token: digits and symbols take longer to say than their characters suggest. */
export function spokenWeight(token: string): number {
  let weight = 0;
  for (const ch of token) {
    if (/\p{L}/u.test(ch)) weight += 1;
    else if (/\p{N}/u.test(ch)) weight += 2;
    else if (ch === "%" || ch === "$") weight += 6;
    else if (ch === "&") weight += 3;
  }
  return Math.max(weight, 1);
}

const normalizedEventText = (text: string): string =>
  text.split(/\s+/).filter(Boolean).map(normalizeWord).join("");

type Range = { start: number; end: number };

function ranges(parts: readonly string[]): Range[] {
  let cursor = 0;
  return parts.map((part) => {
    const range = { start: cursor, end: cursor + part.length };
    cursor = range.end;
    return range;
  });
}

/**
 * Maps voice word events onto the narration's own tokens. Events may merge several tokens (Edge
 * does this for numbers and dates) or split one token; the narration and the events must spell the
 * same letters and digits. Merged events are divided between their tokens by spoken weight.
 */
export function alignEvents(narration: string, events: readonly RawEvent[]): WordTiming[] {
  const tokens = narration.split(/\s+/).filter(Boolean);
  const kept = tokens
    .map((text, index) => ({ text, index, norm: normalizeWord(text) }))
    .filter((t) => t.norm.length > 0);
  if (kept.length === 0) return [];

  const usable = events
    .map((event) => ({ event, norm: normalizedEventText(event.text) }))
    .filter((e) => e.norm.length > 0);
  if (usable.length === 0) throw new VoiceAlignmentError("The voice returned no word events for the narration");

  const tokenStream = kept.map((t) => t.norm).join("");
  const eventStream = usable.map((e) => e.norm).join("");
  if (tokenStream !== eventStream) {
    let i = 0;
    while (i < tokenStream.length && tokenStream[i] === eventStream[i]) i += 1;
    throw new VoiceAlignmentError(
      `The voice's words differ from the narration near "${tokenStream.slice(Math.max(0, i - 8), i + 12)}" (voice said "${eventStream.slice(Math.max(0, i - 8), i + 12)}")`,
    );
  }

  const tokenRanges = ranges(kept.map((t) => t.norm));
  const eventRanges = ranges(usable.map((e) => e.norm));
  const starts = new Array<number>(kept.length).fill(Infinity);
  const ends = new Array<number>(kept.length).fill(-Infinity);

  usable.forEach(({ event }, ei) => {
    const er = eventRanges[ei];
    const pieces: { token: number; weight: number }[] = [];
    kept.forEach((token, ti) => {
      const tr = tokenRanges[ti];
      const overlap = Math.min(tr.end, er.end) - Math.max(tr.start, er.start);
      if (overlap > 0) {
        pieces.push({ token: ti, weight: (spokenWeight(token.text) * overlap) / (tr.end - tr.start) });
      }
    });
    const total = pieces.reduce((sum, p) => sum + p.weight, 0);
    const span = event.endMs - event.startMs;
    let cursor = event.startMs;
    for (const piece of pieces) {
      const length = (span * piece.weight) / total;
      starts[piece.token] = Math.min(starts[piece.token], cursor);
      ends[piece.token] = Math.max(ends[piece.token], cursor + length);
      cursor += length;
    }
  });

  return kept.map((token, ti) => ({ text: token.text, startMs: starts[ti], endMs: ends[ti] }));
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run typecheck && npx vitest run tests/unit/align.test.ts`
Expected: all pass. If a `toBeCloseTo` expectation differs in the last digits because of floating-point accumulation, keep the value but loosen to `toBeCloseTo(x, 3)`; do not change the algorithm.

- [ ] **Step 5: Checkpoint** (only if asked): `feat: align voice word events to narration tokens`

---

### Task 3: Edge TTS adapter and cache (TDD with injected fakes)

**Files:**
- Create: `tts/tts.py`, `tts/requirements.txt`, `src/audio/probe.ts`, `src/voice/edge.ts`, `tests/render/edge.live.test.ts`
- Modify: `package.json` (`setup:tts`, `tsx`)
- Test: `tests/unit/edge.test.ts`, `tests/unit/probe.test.ts`

**Interfaces:**
- Consumes: `alignEvents`, `RawEvent` (Task 2), `VoiceProvider`/`VoiceResult` types.
- Produces:
  - `probeDurationMs(file: string): Promise<number>`; `meanVolumeDb(file: string, startSec: number, durSec: number): Promise<number>`
  - `voiceCacheKey(voice, narration): string` (16 hex chars)
  - `ttsArgs(voice, textFile, outMp3, outJson): string[]`
  - `parseEvents(raw: string): RawEvent[]` (throws a readable error on bad JSON/shape)
  - `type EdgeDeps = { runTts(args: string[]): Promise<void>; probe(file: string): Promise<number> }`
  - `makeEdgeProvider(cacheDir: string, deps?: EdgeDeps): VoiceProvider`

- [ ] **Step 1: Create the Python adapter and setup script**

`tts/requirements.txt`:
```
edge-tts>=7.2,<8
```
`tts/tts.py`:
```python
"""Synthesize narration with Edge TTS (free, no key). Writes an mp3 and a JSON list of word events."""
import argparse
import asyncio
import json
import sys
from pathlib import Path

import edge_tts

TICKS_PER_MS = 10_000  # Edge reports offsets in 100ns ticks


async def synth(text: str, voice: str):
    comm = edge_tts.Communicate(text, voice, boundary="WordBoundary")
    audio, events = bytearray(), []
    async for chunk in comm.stream():
        if chunk["type"] == "audio":
            audio += chunk["data"]
        elif chunk["type"] == "WordBoundary":
            events.append({
                "text": chunk["text"],
                "startMs": chunk["offset"] / TICKS_PER_MS,
                "endMs": (chunk["offset"] + chunk["duration"]) / TICKS_PER_MS,
            })
    return bytes(audio), events


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--voice", required=True)
    parser.add_argument("--text-file", required=True)
    parser.add_argument("--out-mp3", required=True)
    parser.add_argument("--out-json", required=True)
    args = parser.parse_args()
    text = Path(args.text_file).read_text(encoding="utf-8").strip()
    if not text:
        print("narration is empty", file=sys.stderr)
        return 2
    try:
        audio, events = asyncio.run(synth(text, args.voice))
    except Exception as exc:
        print(f"edge-tts failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1
    if not audio or not events:
        print("edge-tts returned no audio or no word events", file=sys.stderr)
        return 1
    Path(args.out_mp3).write_bytes(audio)
    Path(args.out_json).write_text(json.dumps(events), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```
In `package.json` add scripts `"setup:tts": "python3 -m venv tts/.venv && tts/.venv/bin/pip install -q -r tts/requirements.txt"` and install the CLI runner: `npm install -D tsx@^4`. Add `tts/.venv/`, `music/generated/` and `out/` to `.gitignore` if not present. Run `npm run setup:tts` (needs network).
Expected: `tts/.venv/bin/python -c "import edge_tts"` exits 0.

- [ ] **Step 2: Write the failing tests**

`tests/unit/probe.test.ts`:
```ts
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { meanVolumeDb, probeDurationMs } from "../../src/audio/probe";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "probe-"));
const tone = path.join(tmp, "tone.wav");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=f=440:d=1.5", tone]);

describe("probeDurationMs", () => {
  it("returns the duration in milliseconds", async () => {
    expect(await probeDurationMs(tone)).toBeCloseTo(1500, -1);
  });
  it("rejects a missing or unreadable file with a readable error", async () => {
    await expect(probeDurationMs(path.join(tmp, "nope.wav"))).rejects.toThrow(/nope\.wav/);
  });
});

describe("meanVolumeDb", () => {
  it("measures a window of the file", async () => {
    const level = await meanVolumeDb(tone, 0.2, 0.5);
    expect(level).toBeGreaterThan(-30);
    expect(level).toBeLessThan(0);
  });
});
```

`tests/unit/edge.test.ts`:
```ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { makeEdgeProvider, parseEvents, ttsArgs, voiceCacheKey, type EdgeDeps } from "../../src/voice/edge";

describe("voiceCacheKey", () => {
  it("is stable and depends on both voice and narration", () => {
    expect(voiceCacheKey("v", "hello")).toBe(voiceCacheKey("v", "hello"));
    expect(voiceCacheKey("v", "hello")).not.toBe(voiceCacheKey("w", "hello"));
    expect(voiceCacheKey("v", "hello")).not.toBe(voiceCacheKey("v", "hello!"));
    expect(voiceCacheKey("v", "hello")).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("ttsArgs", () => {
  it("builds the python adapter argument list", () => {
    const args = ttsArgs("en-US-AndrewNeural", "/t/in.txt", "/t/out.mp3", "/t/out.json");
    expect(args.slice(1)).toEqual([
      "--voice", "en-US-AndrewNeural", "--text-file", "/t/in.txt",
      "--out-mp3", "/t/out.mp3", "--out-json", "/t/out.json",
    ]);
    expect(args[0]).toMatch(/tts\/tts\.py$/);
  });
});

describe("parseEvents", () => {
  it("parses a valid event list", () => {
    expect(parseEvents('[{"text":"Hi","startMs":0,"endMs":300}]')).toEqual([{ text: "Hi", startMs: 0, endMs: 300 }]);
  });
  it("rejects malformed JSON and wrong shapes readably", () => {
    expect(() => parseEvents("not json")).toThrow(/events/i);
    expect(() => parseEvents('[{"text":"Hi"}]')).toThrow(/events/i);
    expect(() => parseEvents('{"a":1}')).toThrow(/events/i);
  });
});

describe("makeEdgeProvider", () => {
  const fakeDeps = (calls: string[][]): EdgeDeps => ({
    runTts: async (args) => {
      calls.push(args);
      const get = (flag: string) => args[args.indexOf(flag) + 1];
      fs.writeFileSync(get("--out-mp3"), "mp3");
      fs.writeFileSync(
        get("--out-json"),
        JSON.stringify([{ text: "Hello", startMs: 100, endMs: 500 }, { text: "world", startMs: 500, endMs: 900 }]),
      );
    },
    probe: async () => 1200,
  });

  it("synthesizes once, aligns words to the narration and reuses the cache", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "edge-"));
    const calls: string[][] = [];
    const provider = makeEdgeProvider(dir, fakeDeps(calls));
    const first = await provider("Hello world.", "v");
    expect(first.words).toEqual([
      { text: "Hello", startMs: 100, endMs: 500 },
      { text: "world.", startMs: 500, endMs: 900 },
    ]);
    expect(first.audioMs).toBe(1200);
    expect(fs.existsSync(first.audioPath)).toBe(true);
    await provider("Hello world.", "v");
    expect(calls).toHaveLength(1);
  });
  it("re-synthesizes when the narration or voice changes", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "edge-"));
    const calls: string[][] = [];
    const provider = makeEdgeProvider(dir, fakeDeps(calls));
    await provider("Hello world.", "v");
    await provider("Hello world!", "v");
    await provider("Hello world.", "w");
    expect(calls).toHaveLength(3);
  });
  it("does not leave a cache entry when synthesis fails", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "edge-"));
    const failing: EdgeDeps = { runTts: async () => { throw new Error("offline"); }, probe: async () => 1 };
    const provider = makeEdgeProvider(dir, failing);
    await expect(provider("Hello world.", "v")).rejects.toThrow(/offline/);
    expect(fs.readdirSync(dir).filter((f) => f.endsWith(".mp3") || f.endsWith(".events.json"))).toEqual([]);
    const ok = makeEdgeProvider(dir, fakeDeps([]));
    await expect(ok("Hello world.", "v")).resolves.toBeDefined();
  });
  it("fails loudly when the voice words differ from the narration", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "edge-"));
    const provider = makeEdgeProvider(dir, fakeDeps([]));
    await expect(provider("Goodbye moon.", "v")).rejects.toThrow(/differ from the narration/);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run tests/unit/probe.test.ts tests/unit/edge.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 4: Implement `src/audio/probe.ts` and `src/voice/edge.ts`**

`src/audio/probe.ts`:
```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export async function probeDurationMs(file: string): Promise<number> {
  try {
    const { stdout } = await run("ffprobe", [
      "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file,
    ]);
    const seconds = Number(stdout.trim());
    if (!Number.isFinite(seconds) || seconds <= 0) throw new Error("no duration");
    return seconds * 1000;
  } catch (error) {
    throw new Error(`ffprobe could not read a duration from ${file}: ${(error as Error).message}`);
  }
}

/** Mean volume (dB) of a window, via ffmpeg volumedetect. Used by tests and sanity checks. */
export async function meanVolumeDb(file: string, startSec: number, durSec: number): Promise<number> {
  const { stderr } = await run("ffmpeg", [
    "-hide_banner", "-ss", String(startSec), "-t", String(durSec), "-i", file,
    "-af", "volumedetect", "-f", "null", "-",
  ]);
  const match = /mean_volume:\s*(-?[\d.]+|-inf) dB/.exec(stderr);
  if (!match) throw new Error(`volumedetect gave no mean volume for ${file}`);
  return match[1] === "-inf" ? -Infinity : Number(match[1]);
}
```

`src/voice/edge.ts`:
```ts
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { probeDurationMs } from "../audio/probe";
import { alignEvents, type RawEvent } from "./align";
import type { VoiceProvider } from "./types";

const run = promisify(execFile);

export const TTS_PYTHON = path.resolve("tts/.venv/bin/python");
export const TTS_SCRIPT = path.resolve("tts/tts.py");

const EventsSchema = z.array(
  z.strictObject({ text: z.string(), startMs: z.number(), endMs: z.number() }),
);

export const voiceCacheKey = (voice: string, narration: string): string =>
  createHash("sha256").update(`${voice}\n${narration}`).digest("hex").slice(0, 16);

export const ttsArgs = (voice: string, textFile: string, outMp3: string, outJson: string): string[] => [
  TTS_SCRIPT, "--voice", voice, "--text-file", textFile, "--out-mp3", outMp3, "--out-json", outJson,
];

export function parseEvents(raw: string): RawEvent[] {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("Edge TTS events file is not valid JSON");
  }
  const parsed = EventsSchema.safeParse(json);
  if (!parsed.success) throw new Error(`Edge TTS events have the wrong shape: ${z.prettifyError(parsed.error)}`);
  return parsed.data;
}

export type EdgeDeps = {
  runTts: (args: string[]) => Promise<void>;
  probe: (file: string) => Promise<number>;
};

const defaultDeps: EdgeDeps = {
  runTts: async (args) => {
    try {
      await run(TTS_PYTHON, args);
    } catch (error) {
      const stderr = (error as { stderr?: string }).stderr?.trim();
      throw new Error(
        `Edge TTS failed: ${stderr || (error as Error).message}. Run "npm run setup:tts" and check your network connection.`,
      );
    }
  },
  probe: probeDurationMs,
};

/** Edge TTS provider. Output is cached per (voice, narration); a failed run caches nothing. */
export function makeEdgeProvider(cacheDir: string, deps: EdgeDeps = defaultDeps): VoiceProvider {
  return async (narration, voice) => {
    fs.mkdirSync(cacheDir, { recursive: true });
    const key = voiceCacheKey(voice, narration);
    const mp3 = path.join(cacheDir, `${key}.mp3`);
    const json = path.join(cacheDir, `${key}.events.json`);
    if (!(fs.existsSync(mp3) && fs.existsSync(json))) {
      const textFile = path.join(cacheDir, `${key}.txt`);
      const tmpMp3 = `${mp3}.part`;
      const tmpJson = `${json}.part`;
      fs.writeFileSync(textFile, narration, "utf-8");
      try {
        await deps.runTts(ttsArgs(voice, textFile, tmpMp3, tmpJson));
        fs.renameSync(tmpMp3, mp3);
        fs.renameSync(tmpJson, json);
      } finally {
        fs.rmSync(tmpMp3, { force: true });
        fs.rmSync(tmpJson, { force: true });
      }
    }
    const events = parseEvents(fs.readFileSync(json, "utf-8"));
    return { audioPath: mp3, words: alignEvents(narration, events), audioMs: await deps.probe(mp3) };
  };
}
```
Note: the fake in `edge.test.ts` writes to the `.part` paths passed in `args`, so the rename logic is exercised.

- [ ] **Step 5: Run to verify pass, then the live check**

Run: `npm run typecheck && npx vitest run tests/unit/probe.test.ts tests/unit/edge.test.ts`
Expected: all pass.

Create `tests/render/edge.live.test.ts` (skipped unless `RUN_NETWORK_TESTS=1`):
```ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveCue } from "../../src/schema/timing";
import { makeEdgeProvider } from "../../src/voice/edge";

const narration = "Between 2007 and 2009, the S&P 500 lost more than half of its value.";

describe.skipIf(process.env.RUN_NETWORK_TESTS !== "1")("Edge TTS live", () => {
  it("synthesizes, aligns every narration token and resolves cues on digit tokens", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "edge-live-"));
    const voice = await makeEdgeProvider(dir)(narration, "en-US-AndrewNeural");
    expect(voice.words.map((w) => w.text)).toEqual(narration.split(" "));
    expect(resolveCue(voice.words, "2007")).toBeLessThan(resolveCue(voice.words, "2009"));
    expect(Math.abs(voice.words[voice.words.length - 1].endMs - voice.audioMs)).toBeLessThan(1000);
  }, 60000);
});
```
Run: `RUN_NETWORK_TESTS=1 npx vitest run tests/render/edge.live.test.ts`
Expected: PASS (this exercises the real merged "Between 2007 and 2009" event end to end). If it fails on `VoiceAlignmentError`, print the voice events (`cat <cacheDir>/*.events.json`) and fix `alignEvents` for the observed form, adding the observed events as a new unit test case in `tests/unit/align.test.ts` first.

- [ ] **Step 6: Checkpoint** (only if asked): `feat: Edge TTS provider with cache and alignment`

---

### Task 4: Stand-in voice, composition by audio length (TDD)

**Files:**
- Create: `src/voice/standin.ts`, `src/voice/index.ts`
- Delete: `fixtures/synthWords.ts`
- Modify: `src/pipeline/resolveScene.ts`, `src/pipeline/buildVideo.ts`, `src/Root.tsx`, `tests/unit/synthWords.test.ts`, `tests/unit/financeDemo.test.ts`, `tests/render/finance.snapshot.test.ts`
- Test: `tests/unit/standin.test.ts`, `tests/unit/composeAudio.test.ts`

**Interfaces:**
- Consumes: `WordTiming`, `VoiceProvider`, `probeDurationMs`, `meanVolumeDb`.
- Produces:
  - `synthWords(narration, msPerChar = 55, baseMs = 90, gapMs = 40): WordTiming[]` (moved, unchanged behavior)
  - `standinGate(words): string` (ffmpeg volume expression); `standinArgs(words, outPath): string[]`
  - `makeStandinProvider(cacheDir): VoiceProvider` (gated pink noise, `audioMs` = last word end + 200)
  - `makeVoiceProvider(mode: "edge" | "standin", cacheDir): VoiceProvider`
  - `ComposedScene` gains `words: WordTiming[]` and `startFrame: number`; `composeScenes(sb, wordsByScene, fps, audioMsByScene?)`; `buildVideo(..., fps, audioMsByScene?)`

- [ ] **Step 1: Move `synthWords` and update imports**

Create `src/voice/standin.ts` containing the `synthWords` function from `fixtures/synthWords.ts` (same body and doc comment, updating the doc to say it is the stand-in for TTS timings), delete `fixtures/synthWords.ts`, and change the imports `from "../../fixtures/synthWords"` to `from "../../src/voice/standin"` in `tests/unit/synthWords.test.ts`, `tests/unit/financeDemo.test.ts`, `tests/render/finance.snapshot.test.ts`, and `from "../fixtures/synthWords"` to `from "./voice/standin"` in `src/Root.tsx`. Run `npm run typecheck && npm test` (temporarily the file only contains `synthWords`); expected: still green.

- [ ] **Step 2: Write the failing tests**

`tests/unit/standin.test.ts`:
```ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { meanVolumeDb, probeDurationMs } from "../../src/audio/probe";
import { makeStandinProvider, standinArgs, standinGate, synthWords } from "../../src/voice/standin";
import { makeVoiceProvider } from "../../src/voice/index";

describe("standinGate", () => {
  it("has one between() term per word", () => {
    const words = synthWords("one two three");
    const gate = standinGate(words);
    expect(gate.match(/between\(/g)).toHaveLength(3);
    expect(gate.startsWith("min(1,")).toBe(true);
  });
  it("uses seconds with millisecond precision", () => {
    expect(standinGate([{ text: "a", startMs: 1234.5, endMs: 2000 }])).toContain("between(t,1.235,2.000)");
  });
});

describe("standinArgs", () => {
  it("builds a pink-noise lavfi command writing the given path", () => {
    const args = standinArgs(synthWords("hi there"), "/t/out.wav");
    expect(args.join(" ")).toMatch(/anoisesrc=color=pink:duration=/);
    expect(args[args.length - 1]).toBe("/t/out.wav");
  });
});

describe("makeStandinProvider", () => {
  it("makes audible audio only while words are spoken and reuses the cache", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "standin-"));
    const provider = makeStandinProvider(dir);
    const result = await provider("Stocks fell sharply today.", "v");
    const last = result.words[result.words.length - 1];
    expect(result.audioMs).toBeCloseTo(last.endMs + 200, -2);
    expect(await probeDurationMs(result.audioPath)).toBeCloseTo(result.audioMs, -2);
    const first = result.words[0];
    expect(await meanVolumeDb(result.audioPath, first.startMs / 1000, (first.endMs - first.startMs) / 1000)).toBeGreaterThan(-45);
    const gapStartSec = (result.words[0].endMs + 5) / 1000; // inside the 40 ms gap before the next word
    expect(await meanVolumeDb(result.audioPath, gapStartSec, 0.03)).toBeLessThan(-60);
    const again = await provider("Stocks fell sharply today.", "v");
    expect(again.audioPath).toBe(result.audioPath);
  });
  it("selects providers by mode", () => {
    expect(typeof makeVoiceProvider("standin", "/tmp/x")).toBe("function");
    expect(typeof makeVoiceProvider("edge", "/tmp/x")).toBe("function");
    expect(() => makeVoiceProvider("nope" as never, "/tmp/x")).toThrow(/voice mode/);
  });
});
```

`tests/unit/composeAudio.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buildVideo } from "../../src/pipeline/buildVideo";
import { synthWords } from "../../src/voice/standin";
import facts from "../../fixtures/hello.facts.json";
import storyboard from "../../fixtures/hello.storyboard.json";

const words = (sb: { scenes: { id: string; narration: string }[] }) =>
  Object.fromEntries(sb.scenes.map((s) => [s.id, synthWords(s.narration)]));

describe("scene duration follows the audio", () => {
  it("is unchanged when the audio is shorter than the word timings", () => {
    const base = buildVideo(storyboard, facts, words, 30);
    const withAudio = buildVideo(storyboard, facts, words, 30, { intro: 500, drop: 500 });
    expect(withAudio.totalFrames).toBe(base.totalFrames);
  });
  it("extends a scene when the audio outlasts its words so narration is never cut", () => {
    const base = buildVideo(storyboard, facts, words, 30);
    const longer = buildVideo(storyboard, facts, words, 30, { intro: 9000 });
    expect(longer.scenes[0].durationFrames).toBe(Math.round(((9000 + 400) / 1000) * 30));
    expect(longer.scenes[0].durationFrames).toBeGreaterThan(base.scenes[0].durationFrames);
    expect(longer.scenes[1].durationFrames).toBe(base.scenes[1].durationFrames);
  });
  it("exposes each scene's words and start frame", () => {
    const built = buildVideo(storyboard, facts, words, 30);
    expect(built.scenes[0].startFrame).toBe(0);
    expect(built.scenes[1].startFrame).toBe(built.scenes[0].durationFrames);
    expect(built.scenes[0].words.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run tests/unit/standin.test.ts tests/unit/composeAudio.test.ts`
Expected: FAIL (missing exports, extra argument).

- [ ] **Step 4: Implement**

Append to `src/voice/standin.ts` (keeping `synthWords` above):
```ts
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { probeDurationMs } from "../audio/probe";
import type { VoiceProvider } from "./types";

const run = promisify(execFile);
const TAIL_MS = 200;
const sec = (ms: number): string => (ms / 1000).toFixed(3);

/** ffmpeg `volume` expression that is 1 while any word is spoken and 0 otherwise. */
export const standinGate = (words: readonly WordTiming[]): string =>
  `min(1,${words.map((w) => `between(t,${sec(w.startMs)},${sec(w.endMs)})`).join("+")})`;

export function standinArgs(words: readonly WordTiming[], outPath: string): string[] {
  const duration = sec(words[words.length - 1].endMs + TAIL_MS);
  return [
    "-y", "-loglevel", "error",
    "-f", "lavfi", "-i", `anoisesrc=color=pink:duration=${duration}:sample_rate=44100:amplitude=0.5`,
    "-af", `volume='${standinGate(words)}':eval=frame`,
    outPath,
  ];
}

/** Offline stand-in voice: synthetic word timings and pink noise gated to them. Deterministic, free. */
export function makeStandinProvider(cacheDir: string): VoiceProvider {
  return async (narration, voice) => {
    fs.mkdirSync(cacheDir, { recursive: true });
    const key = createHash("sha256").update(`standin\n${voice}\n${narration}`).digest("hex").slice(0, 16);
    const wav = path.join(cacheDir, `standin-${key}.wav`);
    const words = synthWords(narration);
    if (words.length === 0) throw new Error("Stand-in voice needs narration with at least one word");
    if (!fs.existsSync(wav)) await run("ffmpeg", standinArgs(words, wav));
    return { audioPath: wav, words, audioMs: await probeDurationMs(wav) };
  };
}
```
(Add `import type { WordTiming } from "../schema/timing";` if not already imported at the top; keep all imports at the top of the file.)

`src/voice/index.ts`:
```ts
import { makeEdgeProvider } from "./edge";
import { makeStandinProvider } from "./standin";
import type { VoiceProvider } from "./types";

export type VoiceMode = "edge" | "standin";

export function makeVoiceProvider(mode: VoiceMode, cacheDir: string): VoiceProvider {
  if (mode === "edge") return makeEdgeProvider(cacheDir);
  if (mode === "standin") return makeStandinProvider(cacheDir);
  throw new Error(`Unknown voice mode "${String(mode)}" (expected "edge" or "standin")`);
}
```

In `src/pipeline/resolveScene.ts`: add `words: WordTiming[]` and `startFrame: number` to `ComposedScene`; add parameter `audioMsByScene: Record<string, number> = {}` to `composeScenes`; compute
```ts
const wordsMs = sceneDurationMs(words);
const audio = audioMsByScene[scene.id];
const durationMs = audio === undefined ? wordsMs : Math.max(wordsMs, audio + DEFAULT_TAIL_PAD_MS);
```
(import `DEFAULT_TAIL_PAD_MS` from `../schema/timing`), use `msToFrame(durationMs, fps)` for `durationFrames`, include `words: [...words]` in the returned object, and after the `map` assign `startFrame` as the running sum of previous `durationFrames` (build the final array with a loop so no input is mutated). In `src/pipeline/buildVideo.ts` add the optional fifth parameter `audioMsByScene?: Record<string, number>` and pass it to `composeScenes`.

- [ ] **Step 5: Run to verify pass**

Run: `npm run typecheck && npm test && npm run test:render`
Expected: all pass (render goldens unchanged: nothing visual changed yet).

- [ ] **Step 6: Checkpoint** (only if asked): `feat: stand-in voice and audio-driven scene durations`

---

### Task 5: Caption chunking (TDD, pure)

**Files:**
- Create: `src/captions/chunk.ts`
- Modify: `src/pipeline/buildVideo.ts`
- Test: `tests/unit/captionChunk.test.ts`

**Interfaces:**
- Consumes: `WordTiming`.
- Produces:
  - `type CaptionWord = WordTiming`, `type CaptionChunk = { startMs: number; endMs: number; words: CaptionWord[] }`
  - Constants `CAPTION_MAX_CHARS = 24`, `CAPTION_MAX_WORDS = 4`, `CAPTION_HOLD_MS = 250`, `CAPTION_GAP_BREAK_MS = 500`
  - `chunkWords(words): CaptionChunk[]`, `chunkAt(chunks, ms): CaptionChunk | undefined`, `activeWordIndex(chunk, ms): number`
  - `buildCaptions(scenes: { startFrame: number; words: readonly WordTiming[] }[], fps: number): CaptionChunk[]` (scene-local word times shifted to the global timeline)
  - `BuiltVideo` gains `captions: CaptionChunk[]`

- [ ] **Step 1: Write the failing tests `tests/unit/captionChunk.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  CAPTION_HOLD_MS, activeWordIndex, buildCaptions, chunkAt, chunkWords, type CaptionWord,
} from "../../src/captions/chunk";

const w = (text: string, startMs: number, endMs: number): CaptionWord => ({ text, startMs, endMs });
const texts = (c: { words: CaptionWord[] }) => c.words.map((x) => x.text);

describe("chunkWords", () => {
  it("returns an empty list for no words", () => {
    expect(chunkWords([])).toEqual([]);
  });
  it("groups up to 4 words", () => {
    const words = ["a", "b", "c", "d", "e"].map((t, i) => w(t, i * 300, i * 300 + 250));
    expect(chunkWords(words).map(texts)).toEqual([["a", "b", "c", "d"], ["e"]]);
  });
  it("breaks before a word that would exceed 24 characters", () => {
    const words = [w("International", 0, 400), w("Business", 450, 800), w("Machines", 850, 1200)];
    expect(chunkWords(words).map(texts)).toEqual([["International", "Business"], ["Machines"]]);
  });
  it("breaks after sentence-ending punctuation", () => {
    const words = [w("Stocks", 0, 300), w("fell.", 320, 600), w("Then", 650, 900), w("rose", 920, 1200)];
    expect(chunkWords(words).map(texts)).toEqual([["Stocks", "fell."], ["Then", "rose"]]);
  });
  it("breaks across a long pause", () => {
    const words = [w("one", 0, 300), w("two", 1200, 1500)];
    expect(chunkWords(words).map(texts)).toEqual([["one"], ["two"]]);
  });
  it("puts a single over-long word in its own chunk", () => {
    const words = [w("a", 0, 100), w("Pneumonoultramicroscopicsilico", 120, 900), w("b", 920, 1000)];
    expect(chunkWords(words).map(texts)).toEqual([["a"], ["Pneumonoultramicroscopicsilico"], ["b"]]);
  });
  it("holds a chunk briefly after its last word but never into the next chunk", () => {
    const words = [w("one", 0, 300), w("two", 1200, 1500), w("three", 1550, 1800)];
    const [a, b] = chunkWords(words);
    expect(a.endMs).toBe(300 + CAPTION_HOLD_MS);
    expect(b.startMs).toBe(1200);
    const tight = chunkWords([w("x.", 0, 300), w("y", 320, 600)]);
    expect(tight[0].endMs).toBe(320);
  });
  it("does not mutate its input", () => {
    const words = [w("a", 0, 100), w("b", 120, 300)];
    const before = JSON.stringify(words);
    chunkWords(words);
    expect(JSON.stringify(words)).toBe(before);
  });
});

describe("chunkAt and activeWordIndex", () => {
  const chunks = chunkWords([w("one", 100, 300), w("two", 320, 600), w("three.", 620, 900)]);
  it("finds the chunk showing at a time, if any", () => {
    expect(chunkAt(chunks, 50)).toBeUndefined();
    expect(chunkAt(chunks, 100)).toBe(chunks[0]);
    expect(chunkAt(chunks, 900 + CAPTION_HOLD_MS - 1)).toBe(chunks[0]);
    expect(chunkAt(chunks, 900 + CAPTION_HOLD_MS)).toBeUndefined();
  });
  it("tracks the word being spoken and keeps earlier words spoken", () => {
    expect(activeWordIndex(chunks[0], 99)).toBe(-1);
    expect(activeWordIndex(chunks[0], 100)).toBe(0);
    expect(activeWordIndex(chunks[0], 330)).toBe(1);
    expect(activeWordIndex(chunks[0], 5000)).toBe(2);
  });
});

describe("buildCaptions", () => {
  it("shifts scene-local words onto the global timeline", () => {
    const captions = buildCaptions(
      [
        { startFrame: 0, words: [w("one", 0, 300)] },
        { startFrame: 30, words: [w("two", 100, 400)] },
      ],
      30,
    );
    expect(captions.flatMap((c) => c.words.map((x) => [x.text, x.startMs]))).toEqual([["one", 0], ["two", 1100]]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/captionChunk.test.ts`
Expected: FAIL, cannot resolve `../../src/captions/chunk`.

- [ ] **Step 3: Implement `src/captions/chunk.ts`**

```ts
import type { WordTiming } from "../schema/timing";

export type CaptionWord = WordTiming;
export type CaptionChunk = { startMs: number; endMs: number; words: CaptionWord[] };

export const CAPTION_MAX_CHARS = 24;
export const CAPTION_MAX_WORDS = 4;
export const CAPTION_HOLD_MS = 250;
export const CAPTION_GAP_BREAK_MS = 500;

const SENTENCE_END = /[.!?]["')\]]*$/;

export function chunkWords(words: readonly CaptionWord[]): CaptionChunk[] {
  const groups: CaptionWord[][] = [];
  let current: CaptionWord[] = [];
  for (const word of words) {
    const previous = current[current.length - 1];
    if (previous) {
      const joined = [...current, word].map((x) => x.text).join(" ");
      const mustBreak =
        joined.length > CAPTION_MAX_CHARS ||
        current.length >= CAPTION_MAX_WORDS ||
        word.startMs - previous.endMs > CAPTION_GAP_BREAK_MS ||
        SENTENCE_END.test(previous.text);
      if (mustBreak) {
        groups.push(current);
        current = [];
      }
    }
    current.push(word);
  }
  if (current.length > 0) groups.push(current);

  return groups.map((group, i) => {
    const last = group[group.length - 1];
    const nextStart = i + 1 < groups.length ? groups[i + 1][0].startMs : Infinity;
    return {
      startMs: group[0].startMs,
      endMs: Math.max(last.endMs, Math.min(last.endMs + CAPTION_HOLD_MS, nextStart)),
      words: group.map((x) => ({ ...x })),
    };
  });
}

export const chunkAt = (chunks: readonly CaptionChunk[], ms: number): CaptionChunk | undefined =>
  chunks.find((chunk) => ms >= chunk.startMs && ms < chunk.endMs);

/** Index of the last word that has started by `ms` (-1 before the first word). */
export function activeWordIndex(chunk: CaptionChunk, ms: number): number {
  let index = -1;
  chunk.words.forEach((word, i) => {
    if (word.startMs <= ms) index = i;
  });
  return index;
}

export function buildCaptions(
  scenes: readonly { startFrame: number; words: readonly WordTiming[] }[],
  fps: number,
): CaptionChunk[] {
  const global = scenes.flatMap((scene) => {
    const offset = (scene.startFrame * 1000) / fps;
    return scene.words.map((word) => ({
      text: word.text,
      startMs: word.startMs + offset,
      endMs: word.endMs + offset,
    }));
  });
  return chunkWords(global);
}
```
In `src/pipeline/buildVideo.ts` add `captions: CaptionChunk[]` to `BuiltVideo` (import the type from `../captions/chunk`) and compute `captions: buildCaptions(scenes, fps)`.

- [ ] **Step 4: Run to verify pass**

Run: `npm run typecheck && npm test`
Expected: all pass (existing `buildVideo` tests still pass; the returned object just gains `captions`).

- [ ] **Step 5: Checkpoint** (only if asked): `feat: caption chunking`

---

### Task 6: Caption lane layout and Captions overlay (visual)

**Files:**
- Create: `src/captions/Captions.tsx`
- Modify: `src/design/tokens.ts`, `src/charts/layout.ts`, `src/scenes/bar-race/BarRace.tsx`, `src/scenes/big-number/BigNumber.tsx`, `src/scenes/title/Title.tsx`, `src/compose/Video.tsx`, `src/Root.tsx`, `tests/unit/tokens.test.ts`, `tests/unit/chartLayout.test.ts`
- Regenerate: `tests/render/golden/*.png`

**Interfaces:**
- Consumes: `CaptionChunk`, `chunkAt`, `activeWordIndex` (Task 5); `BuiltVideo.captions`.
- Produces: `CAPTION_LANE = { top: 1340, bottom: 1536 }`; `Video` props `{ scenes, captions, totalFrames? }`; a captions overlay on every composition; scene content stays above `CAPTION_LANE.top`.

- [ ] **Step 1: Write the failing layout tests**

Append to `tests/unit/tokens.test.ts`:
```ts
import { CAPTION_LANE, TITLE_LANE } from "../../src/design/tokens";

describe("caption lane", () => {
  it("sits between the content area and the bottom safe zone", () => {
    expect(CAPTION_LANE.bottom).toBe(1920 - SAFE.bottom);
    expect(CAPTION_LANE.bottom - CAPTION_LANE.top).toBeGreaterThanOrEqual(180);
  });
  it("leaves the title lane above the captions", () => {
    expect(SAFE.top + TITLE_LANE.height + 140).toBeLessThanOrEqual(CAPTION_LANE.top);
  });
});
```
(merge the new import into the file's existing `import { PALETTE, SAFE, VIDEO }` line).

In `tests/unit/chartLayout.test.ts` change the CHART_BOX assertion to:
```ts
    expect(CHART_BOX.bottom + 80).toBeLessThanOrEqual(CAPTION_LANE.top);
```
and add `import { CAPTION_LANE } from "../../src/design/tokens";`.

Run: `npx vitest run tests/unit/tokens.test.ts tests/unit/chartLayout.test.ts`
Expected: FAIL (no `CAPTION_LANE`, chart bottom 1400 + 80 > lane).

- [ ] **Step 2: Implement the layout changes**

`src/design/tokens.ts`: add
```ts
/** Fixed lane for captions: below all scene content, above the platform UI zone. */
export const CAPTION_LANE = { top: 1340, bottom: VIDEO.height - SAFE.bottom } as const;
```
and change `TITLE_LANE.height` to `CAPTION_LANE.top - SAFE.top - 140` (define `CAPTION_LANE` before `TITLE_LANE`).
`src/charts/layout.ts`: set `bottom: 1250`.
`src/scenes/bar-race/BarRace.tsx`: `const BARS_BOTTOM = CAPTION_LANE.top - 24;` (import `CAPTION_LANE`).
`src/scenes/big-number/BigNumber.tsx` and `src/scenes/title/Title.tsx`: replace `SAFE.bottom` in the padding with `VIDEO.height - CAPTION_LANE.top` (import `CAPTION_LANE`, and `VIDEO` where needed).

Create `src/captions/Captions.tsx`:
```tsx
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { DISPLAY_FONT } from "../design/fonts";
import { popIn } from "../design/motion";
import { CAPTION_LANE, PALETTE, SAFE } from "../design/tokens";
import { activeWordIndex, chunkAt, type CaptionChunk } from "./chunk";

/** Word-by-word captions: the spoken word sits on a highlighted block, upcoming words are dimmed. */
export const Captions: React.FC<{ chunks: CaptionChunk[] }> = ({ chunks }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const chunk = chunkAt(chunks, ms);
  if (!chunk) return null;
  const active = activeWordIndex(chunk, ms);
  const pop = Math.min(1, popIn(frame, fps, Math.round((chunk.startMs / 1000) * fps)));

  return (
    <div
      style={{
        position: "absolute",
        left: SAFE.side,
        right: SAFE.side,
        top: CAPTION_LANE.top,
        height: CAPTION_LANE.bottom - CAPTION_LANE.top,
        display: "flex",
        flexWrap: "wrap",
        alignContent: "center",
        justifyContent: "center",
        gap: "6px 14px",
        opacity: pop,
        transform: `scale(${0.92 + 0.08 * pop})`,
      }}
    >
      {chunk.words.map((word, i) => {
        const isActive = i === active;
        return (
          <span
            key={`${word.startMs}-${i}`}
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: 62,
              lineHeight: 1.1,
              padding: "4px 14px",
              color: isActive ? PALETTE.ground : PALETTE.ink,
              background: isActive ? PALETTE.highlight : "transparent",
              opacity: i <= active ? 1 : 0.5,
              transform: isActive ? "rotate(-2deg)" : "none",
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
};
```
`src/compose/Video.tsx`: change the props type to `{ scenes: ComposedScene[]; captions: CaptionChunk[]; totalFrames?: number }`, render `<Captions chunks={captions} />` as the last child of the root `AbsoluteFill` (after `Series`). In `src/Root.tsx` pass `captions: hello.captions` / `captions: finance.captions` in both `defaultProps`.

- [ ] **Step 3: Run tests, then regenerate and review goldens by eye**

Run: `npm run typecheck && npm test`
Expected: pass.

Run: `UPDATE_SNAPSHOTS=1 npm run test:render` then build one contact sheet of all goldens:
```bash
cd tests/render/golden && ffmpeg -y -loglevel error $(for f in hello-frame-40 hello-frame-100 hello-frame-150 finance-sp500-mid finance-sp500-end finance-race-mid finance-race-end finance-cpi-mid finance-cpi-end; do printf -- "-i %s.png " $f; done) -filter_complex "$(for i in 0 1 2 3 4 5 6 7 8; do printf "[%d]scale=360:640[s%d];" $i $i; done)[s0][s1][s2]hstack=3[r1];[s3][s4][s5]hstack=3[r2];[s6][s7][s8]hstack=3[r3];[r1][r2][r3]vstack=3" ../../../out/goldens-captions.png
```
Open `out/goldens-captions.png` with the Read tool and check: (1) a caption chunk is visible in the lane (y 1340 to 1536) in at least the hello and finance frames, with a highlighted active word; (2) no chart axis label, bar, readout or number card touches the lane; (3) charts are still readable at the reduced height; (4) title and number scenes remain vertically balanced. Fix any defect (constants in `src/charts/layout.ts`, scene paddings), regenerate, and re-check.

- [ ] **Step 4: Run the gate without update**

Run: `npm run test:render`
Expected: all render tests pass against the new goldens.

- [ ] **Step 5: Checkpoint** (only if asked): `feat: caption lane and word-by-word captions overlay`

---

### Task 7: Audio graph and ambient music (TDD)

**Files:**
- Create: `src/audio/graph.ts`, `src/audio/music.ts`, `music/README.md`
- Test: `tests/unit/audioGraph.test.ts`, `tests/unit/music.test.ts`

**Interfaces:**
- Produces (`graph.ts`):
  - `TARGET = { I: -14, TP: -1.5, LRA: 11 }`
  - `type LoudnormMeasure = { inputI: number; inputTp: number; inputLra: number; inputThresh: number; targetOffset: number }`
  - `parseLoudnorm(stderr: string): LoudnormMeasure` (reads the last JSON block; throws if absent or `-inf`)
  - `buildAudioGraph(o: { clipStartsMs: readonly number[]; hasMusic: boolean; totalSeconds: number; musicVolume?: number; measure?: LoudnormMeasure }): string` with output label `[out]`; inputs are clips `0..n-1` then music at index `n`
- Produces (`music.ts`):
  - `ambientArgs(durationSec: number, outPath: string): string[]`; `generateAmbient(durationSec, outPath): Promise<void>`
  - `isSafeMusicName(name: string): boolean`; `resolveMusic(name: string | null, durationSec: number, musicDir: string, workDir: string): Promise<string | undefined>`

- [ ] **Step 1: Write the failing tests**

`tests/unit/audioGraph.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { TARGET, buildAudioGraph, parseLoudnorm } from "../../src/audio/graph";

const measure = { inputI: -22.75, inputTp: -10.67, inputLra: 1, inputThresh: -32.87, targetOffset: -0.3 };

describe("buildAudioGraph", () => {
  it("delays each narration clip to its scene start and mixes them", () => {
    const g = buildAudioGraph({ clipStartsMs: [0, 4333.4], hasMusic: false, totalSeconds: 10 });
    expect(g).toContain("[0:a]adelay=0|0,");
    expect(g).toContain("[1:a]adelay=4333|4333,");
    expect(g).toContain("amix=inputs=2:normalize=0:duration=longest[narr]");
    expect(g).toContain("apad=whole_dur=10");
    expect(g.endsWith("[out]")).toBe(true);
  });
  it("handles a single clip without amix", () => {
    const g = buildAudioGraph({ clipStartsMs: [0], hasMusic: false, totalSeconds: 5 });
    expect(g).toContain("[n0]anull[narr]");
    expect(g).not.toContain("amix=inputs=1");
  });
  it("adds ducked music only when there is music, sinking the unused split label", () => {
    const without = buildAudioGraph({ clipStartsMs: [0], hasMusic: false, totalSeconds: 5 });
    expect(without).not.toContain("sidechaincompress");
    const withMusic = buildAudioGraph({ clipStartsMs: [0, 2000], hasMusic: true, totalSeconds: 5 });
    expect(withMusic).toContain("[2:a]");
    expect(withMusic).toContain("sidechaincompress=threshold=0.02:ratio=10:attack=15:release=350:makeup=1");
    expect(withMusic).toContain("volume=0.35");
    expect(withMusic).toContain("asplit=2[narrA][narrB]");
    expect(withMusic).toContain("amix=inputs=2:normalize=0:duration=longest[mix0]");
  });
  it("measures with loudnorm json on pass 1 and applies measured values linearly on pass 2", () => {
    const pass1 = buildAudioGraph({ clipStartsMs: [0], hasMusic: false, totalSeconds: 5 });
    expect(pass1).toContain(`loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}:print_format=json`);
    const pass2 = buildAudioGraph({ clipStartsMs: [0], hasMusic: false, totalSeconds: 5, measure });
    expect(pass2).toContain("measured_I=-22.75:measured_TP=-10.67:measured_LRA=1:measured_thresh=-32.87:offset=-0.3:linear=true");
  });
  it("rejects an empty clip list", () => {
    expect(() => buildAudioGraph({ clipStartsMs: [], hasMusic: false, totalSeconds: 5 })).toThrow(RangeError);
  });
});

describe("parseLoudnorm", () => {
  const stderr = `[Parsed_loudnorm_11 @ 0x7f99] \n{\n\t"input_i" : "-22.75",\n\t"input_tp" : "-10.67",\n\t"input_lra" : "1.00",\n\t"input_thresh" : "-32.87",\n\t"output_i" : "-13.70",\n\t"output_tp" : "-1.65",\n\t"output_lra" : "1.40",\n\t"output_thresh" : "-23.79",\n\t"normalization_type" : "dynamic",\n\t"target_offset" : "-0.30"\n}\n[out#0/null @ 0x7f99] video:0KiB`;
  it("reads the input measurements", () => {
    expect(parseLoudnorm(stderr)).toEqual({
      inputI: -22.75, inputTp: -10.67, inputLra: 1, inputThresh: -32.87, targetOffset: -0.3,
    });
  });
  it("throws a clear error when there is no json block", () => {
    expect(() => parseLoudnorm("no json here")).toThrow(/loudnorm/);
  });
  it("throws when the audio is silent (-inf measurements)", () => {
    const silent = stderr.replace('"-22.75"', '"-inf"');
    expect(() => parseLoudnorm(silent)).toThrow(/silent/);
  });
});
```

`tests/unit/music.test.ts`:
```ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { meanVolumeDb, probeDurationMs } from "../../src/audio/probe";
import { ambientArgs, generateAmbient, isSafeMusicName, resolveMusic } from "../../src/audio/music";

describe("isSafeMusicName", () => {
  it("accepts plain file names and rejects traversal and odd characters", () => {
    expect(isSafeMusicName("calm.mp3")).toBe(true);
    expect(isSafeMusicName("track_01-v2.wav")).toBe(true);
    for (const bad of ["../x.mp3", "a/b.mp3", "/etc/passwd", ".hidden", "a b.mp3", "", "x;rm.mp3", "..", "a\\b.mp3"]) {
      expect(isSafeMusicName(bad)).toBe(false);
    }
  });
});

describe("ambientArgs", () => {
  it("builds a four-sine drone with a fade in and out sized to the duration", () => {
    const args = ambientArgs(12, "/t/out.wav").join(" ");
    expect(args.match(/sine=f=/g)).toHaveLength(4);
    expect(args).toContain("afade=t=out:st=9.000:d=3");
    expect(args.endsWith("/t/out.wav")).toBe(true);
  });
  it("rejects a duration too short to fade", () => {
    expect(() => ambientArgs(2, "/t/o.wav")).toThrow(RangeError);
  });
});

describe("generateAmbient and resolveMusic", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "music-"));
  it("renders an audible bed of the requested length", async () => {
    const out = path.join(dir, "bed.wav");
    await generateAmbient(8, out);
    expect(await probeDurationMs(out)).toBeCloseTo(8000, -2);
    expect(await meanVolumeDb(out, 2, 3)).toBeGreaterThan(-50);
  });
  it("returns undefined for null, generates for 'ambient'", async () => {
    expect(await resolveMusic(null, 8, dir, dir)).toBeUndefined();
    const generated = await resolveMusic("ambient", 8, dir, dir);
    expect(generated && fs.existsSync(generated)).toBe(true);
  });
  it("resolves a named file inside the music dir and rejects unsafe or missing names", async () => {
    fs.writeFileSync(path.join(dir, "mine.wav"), "x");
    expect(await resolveMusic("mine.wav", 8, dir, dir)).toBe(path.join(dir, "mine.wav"));
    await expect(resolveMusic("../mine.wav", 8, dir, dir)).rejects.toThrow(/unsafe/);
    await expect(resolveMusic("missing.wav", 8, dir, dir)).rejects.toThrow(/not found/);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/audioGraph.test.ts tests/unit/music.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `src/audio/graph.ts`**

```ts
export const TARGET = { I: -14, TP: -1.5, LRA: 11 } as const;

export type LoudnormMeasure = {
  inputI: number;
  inputTp: number;
  inputLra: number;
  inputThresh: number;
  targetOffset: number;
};

export function parseLoudnorm(stderr: string): LoudnormMeasure {
  const blocks = stderr.match(/\{[^{}]*"input_i"[^{}]*\}/g);
  if (!blocks) throw new Error("ffmpeg loudnorm printed no measurement");
  const raw = JSON.parse(blocks[blocks.length - 1]) as Record<string, string>;
  const read = (key: string): number => {
    const value = Number(raw[key]);
    if (!Number.isFinite(value)) {
      throw new Error(`The audio is silent or unmeasurable (loudnorm ${key} = ${raw[key]}); cannot normalize loudness`);
    }
    return value;
  };
  return {
    inputI: read("input_i"),
    inputTp: read("input_tp"),
    inputLra: read("input_lra"),
    inputThresh: read("input_thresh"),
    targetOffset: read("target_offset"),
  };
}

const FORMAT = "aformat=sample_rates=44100:channel_layouts=stereo";

export type GraphOptions = {
  clipStartsMs: readonly number[];
  hasMusic: boolean;
  totalSeconds: number;
  musicVolume?: number;
  measure?: LoudnormMeasure;
};

/** Filter graph: clips delayed to scene starts -> (ducked music) -> padded to length -> loudnorm. */
export function buildAudioGraph(o: GraphOptions): string {
  const n = o.clipStartsMs.length;
  if (n === 0) throw new RangeError("buildAudioGraph needs at least one narration clip");
  const parts: string[] = o.clipStartsMs.map((ms, i) => {
    const delay = Math.round(ms);
    return `[${i}:a]adelay=${delay}|${delay},${FORMAT}[n${i}]`;
  });
  parts.push(
    n === 1
      ? "[n0]anull[narr]"
      : `${o.clipStartsMs.map((_, i) => `[n${i}]`).join("")}amix=inputs=${n}:normalize=0:duration=longest[narr]`,
  );
  if (o.hasMusic) {
    parts.push(
      "[narr]asplit=2[narrA][narrB]",
      `[${n}:a]${FORMAT},volume=${o.musicVolume ?? 0.35}[music]`,
      "[music][narrA]sidechaincompress=threshold=0.02:ratio=10:attack=15:release=350:makeup=1[ducked]",
      "[narrB][ducked]amix=inputs=2:normalize=0:duration=longest[mix0]",
    );
  } else {
    parts.push("[narr]anull[mix0]");
  }
  parts.push(`[mix0]apad=whole_dur=${o.totalSeconds}[mix]`);
  const base = `loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}`;
  const m = o.measure;
  parts.push(
    m
      ? `[mix]${base}:measured_I=${m.inputI}:measured_TP=${m.inputTp}:measured_LRA=${m.inputLra}:measured_thresh=${m.inputThresh}:offset=${m.targetOffset}:linear=true:print_format=summary[out]`
      : `[mix]${base}:print_format=json[out]`,
  );
  return parts.join(";");
}
```

- [ ] **Step 4: Implement `src/audio/music.ts` and `music/README.md`**

```ts
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const MIN_AMBIENT_SECONDS = 6;
const FADE_SECONDS = 3;
// A minor drone: A2, E3, A3, C4
const FREQUENCIES = [110, 164.81, 220, 261.63] as const;

/** Original, procedurally generated drone bed (no third-party material, so no license to track). */
export function ambientArgs(durationSec: number, outPath: string): string[] {
  if (durationSec < MIN_AMBIENT_SECONDS) throw new RangeError(`ambient music needs at least ${MIN_AMBIENT_SECONDS}s`);
  const d = durationSec.toFixed(3);
  const inputs = FREQUENCIES.flatMap((f) => ["-f", "lavfi", "-i", `sine=f=${f}:d=${d}`]);
  const fadeOutStart = (durationSec - FADE_SECONDS).toFixed(3);
  const graph =
    `[0][1][2][3]amix=inputs=4:normalize=0,tremolo=f=0.2:d=0.4,lowpass=f=900,aecho=0.8:0.7:600:0.4,` +
    `afade=t=in:d=2,afade=t=out:st=${fadeOutStart}:d=${FADE_SECONDS},volume=1.2,` +
    `aformat=sample_rates=44100:channel_layouts=stereo`;
  return ["-y", "-loglevel", "error", ...inputs, "-filter_complex", graph, outPath];
}

export async function generateAmbient(durationSec: number, outPath: string): Promise<void> {
  await run("ffmpeg", ambientArgs(durationSec, outPath));
}

export const isSafeMusicName = (name: string): boolean => /^[A-Za-z0-9_][A-Za-z0-9._-]*$/.test(name) && !name.includes("..");

/** `null` -> no music; `"ambient"` -> generated bed; otherwise a file name inside `musicDir`. */
export async function resolveMusic(
  name: string | null,
  durationSec: number,
  musicDir: string,
  workDir: string,
): Promise<string | undefined> {
  if (name === null) return undefined;
  if (name === "ambient") {
    fs.mkdirSync(workDir, { recursive: true });
    const out = path.join(workDir, "ambient.wav");
    await generateAmbient(durationSec, out);
    return out;
  }
  if (!isSafeMusicName(name)) throw new Error(`Music name "${name}" is unsafe; use a plain file name from the music/ folder`);
  const file = path.join(musicDir, name);
  if (!fs.existsSync(file)) throw new Error(`Music file "${name}" not found in ${musicDir}`);
  return file;
}
```
`music/README.md`:
```markdown
# Music

Set `audio.music` in a storyboard to:
- `null` for no music,
- `"ambient"` for the generated drone bed (original, procedurally generated by `src/audio/music.ts`; no license to track), or
- the file name of a track in this folder (for example `"calm.mp3"`).

Only add tracks you have the right to use, and note the license of each track below.

| File | Source | License |
|---|---|---|
```

- [ ] **Step 5: Run to verify pass**

Run: `npm run typecheck && npx vitest run tests/unit/audioGraph.test.ts tests/unit/music.test.ts`
Expected: all pass.

- [ ] **Step 6: Checkpoint** (only if asked): `feat: audio graph builder and ambient music`

---

### Task 8: Mixing, loudness measurement and muxing (TDD with real ffmpeg)

**Files:**
- Create: `src/audio/mix.ts`, `src/pipeline/finish.ts`
- Test: `tests/unit/mix.test.ts`

**Interfaces:**
- Consumes: `buildAudioGraph`, `parseLoudnorm`, `LoudnormMeasure` (Task 7); `probeDurationMs`; stand-in provider and `generateAmbient` for fixtures.
- Produces:
  - `runFfmpeg(args: string[]): Promise<string>` (resolves to stderr; rejects with the last stderr lines)
  - `mixAudio(input: { clips: { path: string; startMs: number }[]; musicPath?: string; totalMs: number; outPath: string }): Promise<LoudnormMeasure>` (writes AAC stereo 44.1k; returns the pre-normalization measurement)
  - `measureLoudness(file: string): Promise<LoudnormMeasure>` (`inputI` is the file's integrated loudness)
  - `muxVideoAudio(videoPath: string, audioPath: string, outPath: string): Promise<void>` (video stream copied, audio copied, `-shortest`)

- [ ] **Step 1: Write the failing tests `tests/unit/mix.test.ts`**

```ts
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generateAmbient } from "../../src/audio/music";
import { measureLoudness, mixAudio, runFfmpeg } from "../../src/audio/mix";
import { probeDurationMs } from "../../src/audio/probe";
import { muxVideoAudio } from "../../src/pipeline/finish";
import { makeStandinProvider } from "../../src/voice/standin";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mix-"));
const clipsFor = async () => {
  const provider = makeStandinProvider(path.join(dir, "cache"));
  const a = await provider("Stocks fell sharply in two thousand eight.", "v");
  const b = await provider("Then they climbed for eleven straight years.", "v");
  return [
    { path: a.audioPath, startMs: 0 },
    { path: b.audioPath, startMs: 4000 },
  ];
};
const streams = (file: string) =>
  JSON.parse(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name,codec_type,channels,sample_rate", "-of", "json", file]).toString(),
  ).streams;

describe("mixAudio", () => {
  it("normalizes narration-only audio to -14 LUFS, stereo AAC, padded to the total length", async () => {
    const out = path.join(dir, "narr.m4a");
    await mixAudio({ clips: await clipsFor(), totalMs: 9000, outPath: out });
    expect(streams(out)[0]).toMatchObject({ codec_name: "aac", channels: 2, sample_rate: "44100" });
    expect(await probeDurationMs(out)).toBeCloseTo(9000, -2);
    expect((await measureLoudness(out)).inputI).toBeCloseTo(-14, 0);
  });
  it("mixes ducked music under the narration and still hits the loudness target", async () => {
    const music = path.join(dir, "bed.wav");
    await generateAmbient(10, music);
    const out = path.join(dir, "mixed.m4a");
    await mixAudio({ clips: await clipsFor(), musicPath: music, totalMs: 9000, outPath: out });
    expect(await probeDurationMs(out)).toBeCloseTo(9000, -2);
    const loudness = await measureLoudness(out);
    expect(Math.abs(loudness.inputI - -14)).toBeLessThan(1);
    expect(loudness.inputTp).toBeLessThanOrEqual(-1);
  });
  it("loops music that is shorter than the video", async () => {
    const music = path.join(dir, "short.wav");
    await generateAmbient(6, music);
    const out = path.join(dir, "looped.m4a");
    await mixAudio({ clips: await clipsFor(), musicPath: music, totalMs: 9000, outPath: out });
    expect(await probeDurationMs(out)).toBeCloseTo(9000, -2);
  });
  it("fails clearly when the audio is silent", async () => {
    const silent = path.join(dir, "silent.wav");
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", "2", silent]);
    await expect(
      mixAudio({ clips: [{ path: silent, startMs: 0 }], totalMs: 2000, outPath: path.join(dir, "x.m4a") }),
    ).rejects.toThrow(/silent/);
  });
});

describe("runFfmpeg", () => {
  it("rejects with the tail of ffmpeg's stderr", async () => {
    await expect(runFfmpeg(["-i", path.join(dir, "does-not-exist.wav"), "-f", "null", "-"])).rejects.toThrow(/does-not-exist/);
  });
});

describe("muxVideoAudio", () => {
  it("copies the video stream and adds the audio track", async () => {
    const video = path.join(dir, "v.mp4");
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=black:s=320x568:r=30:d=3", "-c:v", "libx264", "-pix_fmt", "yuv420p", video]);
    const audio = path.join(dir, "a.m4a");
    await mixAudio({ clips: [(await clipsFor())[0]], totalMs: 3000, outPath: audio });
    const out = path.join(dir, "final.mp4");
    await muxVideoAudio(video, audio, out);
    const types = streams(out).map((s: { codec_type: string }) => s.codec_type).sort();
    expect(types).toEqual(["audio", "video"]);
    expect(await probeDurationMs(out)).toBeCloseTo(3000, -2);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/mix.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `src/audio/mix.ts` and `src/pipeline/finish.ts`**

`src/audio/mix.ts`:
```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { TARGET, buildAudioGraph, parseLoudnorm, type LoudnormMeasure } from "./graph";

const run = promisify(execFile);
const STDERR_TAIL_LINES = 8;

/** Runs the system ffmpeg; resolves to its stderr (where filters print measurements). */
export async function runFfmpeg(args: string[]): Promise<string> {
  try {
    const { stderr } = await run("ffmpeg", ["-hide_banner", ...args], { maxBuffer: 32 * 1024 * 1024 });
    return stderr;
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? (error as Error).message;
    throw new Error(`ffmpeg failed: ${stderr.trim().split("\n").slice(-STDERR_TAIL_LINES).join("\n")}`);
  }
}

export type MixInput = {
  clips: { path: string; startMs: number }[];
  musicPath?: string;
  totalMs: number;
  outPath: string;
};

function inputArgs(input: MixInput): string[] {
  const clips = input.clips.flatMap((clip) => ["-i", clip.path]);
  const music = input.musicPath ? ["-stream_loop", "-1", "-i", input.musicPath] : [];
  return [...clips, ...music];
}

/** Two-pass: measure the mix, then apply a linear loudnorm with the measured values. */
export async function mixAudio(input: MixInput): Promise<LoudnormMeasure> {
  const totalSeconds = Number((input.totalMs / 1000).toFixed(3));
  const graphOptions = {
    clipStartsMs: input.clips.map((c) => c.startMs),
    hasMusic: input.musicPath !== undefined,
    totalSeconds,
  };
  const measureStderr = await runFfmpeg([
    "-y", ...inputArgs(input),
    "-filter_complex", buildAudioGraph(graphOptions),
    "-map", "[out]", "-t", String(totalSeconds), "-f", "null", "-",
  ]);
  const measure = parseLoudnorm(measureStderr);
  await runFfmpeg([
    "-y", ...inputArgs(input),
    "-filter_complex", buildAudioGraph({ ...graphOptions, measure }),
    "-map", "[out]", "-t", String(totalSeconds),
    "-c:a", "aac", "-b:a", "192k", "-ar", "44100", input.outPath,
  ]);
  return measure;
}

/** Integrated loudness and true peak of an existing file (`inputI`, `inputTp`). */
export async function measureLoudness(file: string): Promise<LoudnormMeasure> {
  const stderr = await runFfmpeg([
    "-i", file,
    "-af", `loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}:print_format=json`,
    "-f", "null", "-",
  ]);
  return parseLoudnorm(stderr);
}
```
`src/pipeline/finish.ts`:
```ts
import { runFfmpeg } from "../audio/mix";

/** Adds an audio track to an encoded video without re-encoding either stream. */
export async function muxVideoAudio(videoPath: string, audioPath: string, outPath: string): Promise<void> {
  await runFfmpeg([
    "-y", "-i", videoPath, "-i", audioPath,
    "-map", "0:v:0", "-map", "1:a:0",
    "-c:v", "copy", "-c:a", "copy",
    "-movflags", "+faststart", "-shortest", outPath,
  ]);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run typecheck && npx vitest run tests/unit/mix.test.ts`
Expected: all pass. If the narration-only loudness lands outside +/- 1 LU (very sparse gated noise can fail loudnorm's gating), increase the stand-in noise level via `amplitude` in `standinArgs` only, keeping the tests unchanged, and note it in the ledger.

- [ ] **Step 5: Checkpoint** (only if asked): `feat: two-pass audio mix, loudness measure, mux`

---

### Task 9: Produce orchestrator, Production composition, CLI (TDD + end-to-end)

**Files:**
- Create: `src/pipeline/bundle.ts`, `src/pipeline/cli.ts`, `src/pipeline/produce.ts`, `scripts/produce.ts`
- Modify: `src/testing/renderHelpers.ts` (re-export), `src/Root.tsx`, `package.json` (`produce` script), `vitest.config.ts` (coverage)
- Test: `tests/unit/cli.test.ts`, `tests/render/produce.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `parseArgs(argv: string[]): ProduceCliOptions` with flags `--storyboard`, `--facts`, `--out` (required), `--voice edge|standin` (default `edge`), `--no-enforce-length`, `--music-dir`, `--cache-dir`
  - `produce(opts): Promise<{ videoPath; totalFrames; durationMs; loudness; manifestPath }>`
  - Remotion composition `Production` (duration from `calculateMetadata`)
  - `npm run produce -- --storyboard S --facts F --out DIR [--voice standin]`

- [ ] **Step 1: Write the failing CLI test `tests/unit/cli.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { parseArgs } from "../../src/pipeline/cli";

const base = ["--storyboard", "s.json", "--facts", "f.json", "--out", "out/x"];

describe("parseArgs", () => {
  it("applies defaults", () => {
    expect(parseArgs(base)).toMatchObject({
      storyboardPath: "s.json", factsPath: "f.json", outDir: "out/x", voice: "edge", enforceLength: true,
    });
  });
  it("reads optional flags", () => {
    const o = parseArgs([...base, "--voice", "standin", "--no-enforce-length", "--music-dir", "m", "--cache-dir", "c"]);
    expect(o).toMatchObject({ voice: "standin", enforceLength: false, musicDir: "m", cacheDir: "c" });
  });
  it("rejects missing required flags, bad voices, unknown flags and missing values", () => {
    expect(() => parseArgs(["--facts", "f.json", "--out", "o"])).toThrow(/--storyboard/);
    expect(() => parseArgs([...base, "--voice", "robot"])).toThrow(/--voice/);
    expect(() => parseArgs([...base, "--bogus"])).toThrow(/Unknown flag/);
    expect(() => parseArgs([...base, "--voice"])).toThrow(/needs a value/);
  });
});
```

- [ ] **Step 2: Run to verify failure, then implement `src/pipeline/cli.ts`**

Run: `npx vitest run tests/unit/cli.test.ts`
Expected: FAIL, module not found.

`src/pipeline/cli.ts`:
```ts
import type { VoiceMode } from "../voice/index";

export type ProduceCliOptions = {
  storyboardPath: string;
  factsPath: string;
  outDir: string;
  voice: VoiceMode;
  enforceLength: boolean;
  musicDir?: string;
  cacheDir?: string;
};

const VALUE_FLAGS = new Set(["--storyboard", "--facts", "--out", "--voice", "--music-dir", "--cache-dir"]);

export function parseArgs(argv: readonly string[]): ProduceCliOptions {
  const values = new Map<string, string>();
  let enforceLength = true;
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--no-enforce-length") {
      enforceLength = false;
    } else if (VALUE_FLAGS.has(flag)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) throw new Error(`${flag} needs a value`);
      values.set(flag, value);
      i += 1;
    } else {
      throw new Error(`Unknown flag ${flag}`);
    }
  }
  const required = (flag: string): string => {
    const value = values.get(flag);
    if (value === undefined) throw new Error(`Missing required flag ${flag}`);
    return value;
  };
  const voice = values.get("--voice") ?? "edge";
  if (voice !== "edge" && voice !== "standin") throw new Error(`--voice must be "edge" or "standin", got "${voice}"`);
  return {
    storyboardPath: required("--storyboard"),
    factsPath: required("--facts"),
    outDir: required("--out"),
    voice,
    enforceLength,
    musicDir: values.get("--music-dir"),
    cacheDir: values.get("--cache-dir"),
  };
}
```

- [ ] **Step 3: Run to verify pass**

Run: `npx vitest run tests/unit/cli.test.ts`
Expected: pass.

- [ ] **Step 4: Implement bundle, the Production composition, produce and the CLI**

`src/pipeline/bundle.ts`:
```ts
import path from "node:path";
import { bundle } from "@remotion/bundler";

let cached: Promise<string> | undefined;

/** Bundles the Remotion project once per process. */
export function getServeUrl(): Promise<string> {
  cached ??= bundle({ entryPoint: path.resolve("src/index.ts") });
  return cached;
}
```
`src/testing/renderHelpers.ts` becomes:
```ts
export { getServeUrl } from "../pipeline/bundle";
```
In `src/Root.tsx` add, inside `RemotionRoot`:
```tsx
    <Composition
      id="Production"
      component={Video}
      durationInFrames={1}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
      defaultProps={{ scenes: [], captions: [], totalFrames: 1 }}
      calculateMetadata={({ props }) => ({ durationInFrames: Math.max(1, props.totalFrames ?? 1) })}
    />
```
`src/pipeline/produce.ts`:
```ts
import fs from "node:fs";
import path from "node:path";
import { renderFrames, selectComposition } from "@remotion/renderer";
import { measureLoudness, mixAudio } from "../audio/mix";
import { resolveMusic } from "../audio/music";
import type { LoudnormMeasure } from "../audio/graph";
import { VIDEO } from "../design/tokens";
import { parseStoryboard } from "../schema/storyboard";
import { assertDuration } from "../schema/validate";
import { makeVoiceProvider, type VoiceMode } from "../voice/index";
import type { VoiceResult } from "../voice/types";
import { getServeUrl } from "./bundle";
import { buildVideo } from "./buildVideo";
import { encodeFrames } from "./encode";
import { muxVideoAudio } from "./finish";

export type ProduceOptions = {
  storyboardPath: string;
  factsPath: string;
  outDir: string;
  voice: VoiceMode;
  enforceLength: boolean;
  musicDir?: string;
  cacheDir?: string;
};

export type ProduceResult = {
  videoPath: string;
  totalFrames: number;
  durationMs: number;
  loudness: LoudnormMeasure;
  manifestPath: string;
};

const readJson = (file: string): unknown => JSON.parse(fs.readFileSync(file, "utf-8"));

/** Storyboard + facts -> narrated, captioned, mixed final.mp4. Voice runs scene by scene (polite to Edge). */
export async function produce(opts: ProduceOptions): Promise<ProduceResult> {
  const storyboardJson = readJson(opts.storyboardPath);
  const factsJson = readJson(opts.factsPath);
  const storyboard = parseStoryboard(storyboardJson);

  const provider = makeVoiceProvider(opts.voice, opts.cacheDir ?? path.resolve("out/voice-cache"));
  const voices: Record<string, VoiceResult> = {};
  for (const scene of storyboard.scenes) voices[scene.id] = await provider(scene.narration, storyboard.meta.voice);

  const built = buildVideo(
    storyboardJson,
    factsJson,
    () => Object.fromEntries(Object.entries(voices).map(([id, v]) => [id, v.words])),
    VIDEO.fps,
    Object.fromEntries(Object.entries(voices).map(([id, v]) => [id, v.audioMs])),
  );
  const totalMs = (built.totalFrames / VIDEO.fps) * 1000;
  if (opts.enforceLength) assertDuration(totalMs);

  fs.mkdirSync(opts.outDir, { recursive: true });
  // Resolve music before rendering so an unsafe or missing name fails fast.
  const musicPath = await resolveMusic(
    storyboard.audio.music, totalMs / 1000, opts.musicDir ?? path.resolve("music"), opts.outDir,
  );
  const inputProps = { scenes: built.scenes, captions: built.captions, totalFrames: built.totalFrames };
  const serveUrl = await getServeUrl();
  const composition = await selectComposition({ serveUrl, id: "Production", inputProps });
  const framesDir = path.join(opts.outDir, "frames");
  fs.rmSync(framesDir, { recursive: true, force: true });
  await renderFrames({
    composition, serveUrl, inputProps, outputDir: framesDir, imageFormat: "jpeg",
    onStart: () => undefined, onFrameUpdate: () => undefined,
  });
  const silentPath = path.join(opts.outDir, "silent.mp4");
  await encodeFrames(framesDir, VIDEO.fps, silentPath);

  const audioPath = path.join(opts.outDir, "audio.m4a");
  const clips = built.scenes.map((scene) => ({
    path: voices[scene.id].audioPath,
    startMs: (scene.startFrame * 1000) / VIDEO.fps,
  }));
  await mixAudio({ clips, musicPath, totalMs, outPath: audioPath });

  const videoPath = path.join(opts.outDir, "final.mp4");
  await muxVideoAudio(silentPath, audioPath, videoPath);
  const loudness = await measureLoudness(videoPath);

  const manifestPath = path.join(opts.outDir, "manifest.json");
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        voice: opts.voice,
        totalFrames: built.totalFrames,
        durationMs: totalMs,
        loudness,
        scenes: built.scenes.map((s) => ({
          id: s.id, type: s.scene.type, startFrame: s.startFrame, durationFrames: s.durationFrames,
          cues: s.cues, audio: voices[s.id].audioPath,
        })),
      },
      null,
      2,
    ),
  );
  return { videoPath, totalFrames: built.totalFrames, durationMs: totalMs, loudness, manifestPath };
}
```
`scripts/produce.ts`:
```ts
import { parseArgs } from "../src/pipeline/cli";
import { produce } from "../src/pipeline/produce";

produce(parseArgs(process.argv.slice(2)))
  .then((r) => {
    console.log(`Done: ${r.videoPath}`);
    console.log(`Length ${(r.durationMs / 1000).toFixed(1)}s, ${r.totalFrames} frames, loudness ${r.loudness.inputI} LUFS`);
  })
  .catch((error: Error) => {
    console.error(`produce failed: ${error.message}`);
    process.exit(1);
  });
```
`package.json` script: `"produce": "tsx scripts/produce.ts"`. In `vitest.config.ts` coverage config extend `include` with `"src/voice/**"`, `"src/audio/**"`, `"src/captions/chunk.ts"` and add `exclude: ["src/pipeline/produce.ts", "src/pipeline/bundle.ts"]`.

- [ ] **Step 5: Write the end-to-end test `tests/render/produce.test.ts`**

```ts
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { measureLoudness } from "../../src/audio/mix";
import { probeDurationMs } from "../../src/audio/probe";
import { produce } from "../../src/pipeline/produce";

describe("produce (stand-in voice, generated music)", () => {
  it("makes a narrated, captioned, mixed 1080x1920 video from the hello storyboard", async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "produce-"));
    const storyboard = JSON.parse(fs.readFileSync("fixtures/hello.storyboard.json", "utf-8"));
    storyboard.audio.music = "ambient";
    const sbPath = path.join(outDir, "storyboard.json");
    fs.writeFileSync(sbPath, JSON.stringify(storyboard));

    const result = await produce({
      storyboardPath: sbPath,
      factsPath: "fixtures/hello.facts.json",
      outDir: path.join(outDir, "run"),
      voice: "standin",
      enforceLength: false,
      cacheDir: path.join(outDir, "voice"),
      musicDir: path.join(outDir, "music"),
    });

    const probe = JSON.parse(
      execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,channels", "-of", "json", result.videoPath]).toString(),
    ).streams;
    const video = probe.find((s: { codec_type: string }) => s.codec_type === "video");
    const audio = probe.find((s: { codec_type: string }) => s.codec_type === "audio");
    expect(video).toMatchObject({ codec_name: "h264", width: 1080, height: 1920, r_frame_rate: "30/1" });
    expect(audio).toMatchObject({ codec_name: "aac", channels: 2 });
    expect(await probeDurationMs(result.videoPath)).toBeCloseTo((result.totalFrames / 30) * 1000, -2);
    expect(Math.abs((await measureLoudness(result.videoPath)).inputI - -14)).toBeLessThan(1.5);
    expect(JSON.parse(fs.readFileSync(result.manifestPath, "utf-8")).scenes).toHaveLength(2);
  }, 240000);

  it("enforces the 55-60 second length by default", async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "produce-short-"));
    await expect(
      produce({
        storyboardPath: "fixtures/hello.storyboard.json",
        factsPath: "fixtures/hello.facts.json",
        outDir,
        voice: "standin",
        enforceLength: true,
        cacheDir: path.join(outDir, "voice"),
      }),
    ).rejects.toThrow(/required 55-60s/);
  }, 120000);

  it("rejects an unsafe music name before rendering", async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "produce-music-"));
    const storyboard = JSON.parse(fs.readFileSync("fixtures/hello.storyboard.json", "utf-8"));
    storyboard.audio.music = "../secret.mp3";
    const sbPath = path.join(outDir, "storyboard.json");
    fs.writeFileSync(sbPath, JSON.stringify(storyboard));
    await expect(
      produce({
        storyboardPath: sbPath, factsPath: "fixtures/hello.facts.json", outDir: path.join(outDir, "run"),
        voice: "standin", enforceLength: false, cacheDir: path.join(outDir, "voice"), musicDir: path.join(outDir, "music"),
      }),
    ).rejects.toThrow(/unsafe/);
  }, 240000);
});
```

- [ ] **Step 6: Run the whole suite**

Run: `npm run typecheck && npm run test:cov && npm run test:render`
Expected: typecheck clean; unit tests pass with coverage thresholds met; render tests (including the three `produce` tests) pass. If the end-to-end loudness check fails because the gated noise is too sparse for loudnorm gating, handle it as in Task 8 Step 4.
- [ ] **Step 7: Checkpoint** (only if asked): `feat: produce orchestrator, Production composition, CLI`

---

### Task 10: Real-voice run, review, results and hand-off

**Files:**
- Modify: `spikes/RESULTS.md`, `docs/superpowers/specs/2026-10-05-motion-explainers-design.md`

- [ ] **Step 1: Produce the finance demo with the real Edge voice**

Run:
```bash
npm run setup:tts   # once, if not done in Task 3
npm run produce -- --storyboard fixtures/finance.storyboard.json --facts fixtures/finance.facts.json --out out/finance-edge --voice edge --no-enforce-length
```
Expected: `Done: out/finance-edge/final.mp4`, with the length and loudness printed. Then verify objectively:
```bash
ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate:format=duration -of default=nw=1 out/finance-edge/final.mp4
cat out/finance-edge/manifest.json | head -40
```
Check: one video and one audio stream, 1080x1920 30fps, loudness within 1 LU of -14, every scene's cues resolved (no error).

- [ ] **Step 2: Check sync by looking at the frames**

For the `sp500` scene, take its callout cue frames from the manifest (`cues[].frame` plus the scene `startFrame`) and extract stills at those frames plus 10 frames later:
```bash
ffmpeg -y -loglevel error -ss <seconds> -i out/finance-edge/final.mp4 -frames:v 1 out/sync-a.png
```
Open them with the Read tool: the captions' highlighted word at the cue frame must be the cue word ("fell", "climbed") and the callout badge must be visible shortly after. Record what you saw.

- [ ] **Step 3: Extract the audio levels for a human to judge**

Print the exact command for the user to listen: `open out/finance-edge/final.mp4`. State plainly that voice quality, pronunciation and the music's taste were not judged by the agent; ask the user to listen and report problems (pronunciation of numbers, music loudness).

- [ ] **Step 4: Record results and amend the spec**

Append to `spikes/RESULTS.md`:
```markdown
## D. Voice, captions, audio finish (date: 2026-10-06)
- Edge TTS through `alignEvents`: <result of the live test; how merged number events were split>
- FinanceDemo with real voice: <duration> s, <frames> frames; loudness <inputI> LUFS, true peak <inputTp> dBTP
- Render + mix time end to end: <seconds> s
- Caption lane layout: charts shrank from 760 to 610 px tall to leave the lane; <visual notes>
- Not judged by the agent: voice quality and music taste (needs a human listener)
```
Fill every `<...>` with measured values (no placeholders left).
In the spec, mark milestone 6 done (captions, music ducking, loudness) with one line, replace the section 5 "Spike result" bullet's follow-up with "implemented in `src/voice/align.ts`", and note in section 6 that music is generated (`"ambient"`) or user-supplied, with no bundled third-party tracks.

- [ ] **Step 5: Write the Plan 4 brief at the end of `spikes/RESULTS.md`**

```markdown
## Inputs for Plan 4 (polish and the script/fact-check skill)
- Scene transitions (shape wipes, matched elements) and the chart camera push-in (needs a gutter-safe design).
- Remaining scene library: kinetic-text, timeline, map, compare, quote.
- The Claude Code skill: topic -> facts.json with sources -> script -> storyboard JSON (few-shot from fixtures) -> validate/repair loop -> `npm run produce` -> review sheet; human review gate before the final render.
- Known gaps carried forward: callout text, chart titles and title numbers are not traced to facts; fonts load from Google at render time; the stand-in voice is noise, not speech.
- Open items from this plan: <list anything noticed in Steps 1-3 that was not fixed>
```
Fill the last bullet with real observations.

- [ ] **Step 6: Report to the user**

Summarize what was built, the path to `out/finance-edge/final.mp4`, measured numbers, test and coverage status, and ask them to listen and report; ask whether to commit and whether to proceed to Plan 4.

- [ ] **Step 7: Checkpoint** (only if asked): `docs: record voice, captions and audio results; plan 4 brief`
