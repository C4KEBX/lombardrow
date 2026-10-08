# Motion Explainers: Technical Handoff

Status at handoff: all six build plans are complete and pushed to `https://github.com/C4KEBX/motionexplainers.git` (branch `main`, head `4a48273`). Last full run: typecheck clean, 71 unit files / 494 tests passing (97.6% lines overall), render suite 24 passed and 1 skipped (the skipped one is the live Edge TTS test, `tests/render/edge.live.test.ts`; it is excluded unless network and the TTS venv are present, and was not re-run for this handoff). Three real videos were produced end to end and reviewed by the project owner.

This document is written for an engineer or agent who will lift the framework into a new project. It explains what exists, why it is shaped the way it is, what is proven, what is not, and what to change first. Sections 14 and 15 are the shortest path to a decision.

Contents

1. What this is
2. Architecture at a glance
3. Environment, versions and pins
4. Repository map
5. The two contracts: facts.json and storyboard.json
6. Validation layers
7. Timing model
8. The `produce` pipeline
9. Voice, alignment and captions
10. Audio finish
11. Design system and scene library
12. Skill tooling (check, catalog, verify-facts, sheet, estimator)
13. The Claude Code skill
14. What to reuse, what to change
15. Known limits, residual risks and deferred minors
16. Measurements and calibration data
17. Testing strategy
18. Gotchas learned the hard way
19. Command reference
20. History and provenance

---

## 1. What this is

A pipeline that turns a topic into a 60-second (55 to 60 s enforced) vertical 1080x1920, 30 fps animated explainer video about finance, investing or history. It costs nothing beyond a Claude Code subscription: Remotion renders, Edge TTS narrates (free, no key), system ffmpeg finishes the audio.

The central idea is a division of labor:

- **Claude Code is the research, writing and repair brain.** It searches, opens sources, writes `facts.json`, drafts narration, writes `storyboard.json`, and repairs validation failures.
- **Tested, deterministic tools do the checking and rendering.** They are pure functions of their inputs wherever possible. Claude never edits them to make a storyboard pass.
- **A human approves a review sheet before the final render.** The skill is written to stop there.

Everything the viewer sees is a pure function of `(storyboard, facts, word timings)`. There is no hidden state between frames, which is what makes the snapshot tests and the review stills trustworthy.

## 2. Architecture at a glance

```
topic
  |  (Claude Code: WebSearch / WebFetch, human-in-the-loop)
  v
videos/<slug>/facts.json  -----> npm run verify-facts  --> verify.json (advisory)
videos/<slug>/storyboard.json
  |
  v  npm run check      validators: schema, variety, cues, headlines, text, map regions,
  |                     fact tracing, scene timing (synthetic words), advice lint, length estimate
  v  npm run sheet      one settled still per scene + review.html   <-- HUMAN GATE
  v  npm run produce
        parse + validate  (same validators again, against REAL voice timings)
        voice per scene   Edge TTS -> mp3 + word events -> alignEvents -> WordTiming[]
        compose           scene durations from narration; cues resolved to frames
        render            Remotion renderFrames -> JPEG sequence
        encode            system ffmpeg libx264 -> silent.mp4
        mix               adelay clips -> (ducked music) -> two-pass loudnorm -> audio.m4a
        mux               copy video + copy audio -> final.mp4
        verify            measure loudness; fail if outside -14 +/- 1 LUFS or above -1.5 dBTP
  v
out/<slug>/final.mp4 + manifest.json
```

Key data flow rule: **scene duration is derived from the narration, never specified.** A scene lasts from its first spoken word to its last word's end plus a 400 ms tail (or the audio file's full length plus the tail if that is longer). Cues are placed on spoken words, so visuals land on the word that names them.

## 3. Environment, versions and pins

Developed on an Intel Mac, 8 cores, 16 GB, macOS 12.6.3, Node v24.14.0, Python 3.11.3, system ffmpeg 9.0.2.

Hard pins (do not loosen without re-testing):

| Package | Pin | Why |
|---|---|---|
| `remotion`, `@remotion/*` | exactly `4.0.533` | all must match each other |
| `zod` | exactly `4.5.4` | Remotion requires zod exactly 4.5.4 |
| `react` / `react-dom` | `^19` | |
| `world-atlas` | `2.0.2` | the atlas names (Natural Earth) are part of the contract |
| `edge-tts` (Python) | `>=7.2,<8` | in `tts/requirements.txt` |

Other deps: `d3-geo`, `d3-scale`, `d3-shape`, `topojson-client`, `@remotion/google-fonts`, `@remotion/paths`; dev: `vitest ^5`, `@vitest/coverage-v8`, `tsx`, `typescript ^5.9`, `pngjs`.

System requirements: Node 20+, Python 3 (`npm run setup:tts` builds `tts/.venv`), **system ffmpeg and ffprobe on PATH**, internet for Edge TTS and for Google Fonts at render time.

**macOS 12 workaround (important):** Remotion's bundled ffmpeg (`@remotion/compositor-darwin-x64`) aborts on macOS 12 (`Symbol not found: AVCaptureDeviceTypeContinuityCamera`), so `remotion render` to MP4 fails at the stitch step. The pipeline therefore renders a JPEG image sequence with `renderFrames` and encodes with system ffmpeg (`src/pipeline/encode.ts`). On a newer OS this workaround is probably unnecessary, but it is harmless and keeps one code path. If you drop it, you lose control of the encode flags used here (`libx264`, `yuv420p`).

## 4. Repository map

Top level:

```
.claude/skills/make-explainer/   SKILL.md, rules.md, storyboard.schema.json (generated)
docs/superpowers/specs/          the design spec (sections 1-11); §7 reflects the as-built skill
docs/superpowers/plans/          six implementation plans (history of how it was built)
docs/HANDOFF.md                  this file
fixtures/                        hello / finance / history / ancient demo storyboards + facts (+ hello.words.json)
music/                           README only; tracks are user-supplied; "ambient" is generated
scripts/                         thin CLIs: produce, check, catalog, sheet, verify-facts
spikes/                          feasibility spikes + RESULTS.md (measurements, decisions per plan)
src/                             all code, see below
tests/unit, tests/render         vitest suites; tests/render/golden holds 19 reviewed PNG goldens
tts/                             tts.py (Edge TTS wrapper) + requirements.txt
videos/<slug>/                   per-video facts.json, storyboard.json, verify.json, review/ (gitignored)
out/                             renders, voice cache (gitignored)
```

`src/` by responsibility (about 3,060 lines of non-React TypeScript plus the scene components):

| Dir | Contents |
|---|---|
| `schema/` | `storyboard.ts` (Zod contract, 292 lines), `facts.ts`, `validate.ts` (all `assert*` validators, 315 lines), `timing.ts` (cue resolution, durations), `emphasis.ts`, `deepEqual.ts` |
| `pipeline/` | `produce.ts` (orchestrator), `buildVideo.ts` (parse+validate+compose), `resolveScene.ts`, `assertSceneTiming.ts`, `encode.ts`, `finish.ts`, `bundle.ts`, `cli.ts` |
| `voice/` | `edge.ts` (provider + cache), `align.ts` (event to token alignment), `standin.ts`, `synthWords.ts`, `index.ts` |
| `audio/` | `graph.ts` (ffmpeg filter graph, loudness constants), `mix.ts` (two-pass), `music.ts` (generated drone), `probe.ts` |
| `captions/` | `chunk.ts` (pure chunking), `Captions.tsx` |
| `design/` | `tokens.ts` (palette, lanes), `motion.ts` (easing/spring primitives), `layout.ts` (fit/format), `fonts.ts` |
| `charts/` | `geometry`, `layout`, `labels`, `race`, `schedule`, `timing`, `CalloutBadge.tsx` |
| `map/` | `atlas.ts` (countries, validation, suggestions), `camera.ts` (Mercator fitting, label placement) |
| `scenes/<type>/` | one React component per scene type, plus `timing.ts` / `layout.ts` where logic is pure |
| `compose/` | `Video.tsx` (Series of scenes + wipes + captions), `WipeOverlay.tsx`, `wipe.ts` |
| `skill/` | `check`, `estimate`, `adviceLint`, `catalog`, `verifyFacts`, `verifyTypes`, `review`, `sheetRender`, `flags` |
| `testing/` | `imageDiff`, `renderHelpers` |
| `Root.tsx`, `index.ts` | Remotion compositions: `HelloBigNumber`, `FinanceDemo`, `HistoryDemo`, `AncientDemo`, `Production`, `RenderStress` |

The `Production` composition is the one that matters: it has `durationInFrames: 1` as a placeholder and `calculateMetadata` sets the real length from `props.totalFrames`. `produce` and `sheet` both pass `{scenes, captions, totalFrames}` as `inputProps`.

Per-file size discipline: the project enforced an 800-line cap; the largest source file is `validate.ts` at 315 lines.

## 5. The two contracts

### 5.1 facts.json

```json
{ "facts": [ {
  "id": "cpi-2021",
  "claim": "Full sentence with units and period, as the source states it.",
  "value": 7.0,                       // optional: one number
  "dataset": [ ... ],                 // optional: exact JSON a chart/list/map will show
  "source": { "name": "BLS", "url": "https://..." }   // http(s) only
} ] }
```

Strict object (unknown keys rejected). Ids must be unique. `dataset` is arbitrary JSON (`z.json()`). The **claim** is human text; the only machine uses are the quote trace (the quote must appear inside the claim) and the source verifier (numbers in `value`/`dataset`/`claim` are searched on the page).

### 5.2 storyboard.json

```
{ schemaVersion: 1,
  meta:  { title, theme: "bold-flat", voice },        // voice e.g. "en-US-AndrewNeural"
  audio: { music: null | "ambient" | "<file in music/>" },
  scenes: Scene[] (>= 1) }
```

Everything is `z.strictObject`, so unknown fields fail. Scene ids: `^[a-z0-9-]+$`, unique. Every scene has `id`, `type`, `narration` (min 1), `cues[]` (default `[]`), `props`.

**Cue:** `{ atWord, occurrence = 1, do: "callout" | "emphasize", text (required, <= 24), x? }`. `atWord` is matched to the narration after `normalizeWord` (lowercase, strip non-letter/digit, keep a `.` only between two digits so "1.5" != "15"). `occurrence` selects the nth repeat. `x` only for line-chart callouts.

The nine scene types (limits copied from the schema; `storyboard.schema.json` is the generated machine-readable form, but it cannot express the refinements in section 6):

| type | props | notes |
|---|---|---|
| `title` | `headline` (<=80), `kicker?` (<=40) | no cues; headline must fit the title lane (font search 190px down to 64px) |
| `big-number` | `value`, `prefix`(<=4), `suffix`(<=6), `decimals`(0-4), `label`(<=60), `factId`, `tone` | `value` must equal fact `value`; max 1 callout |
| `line-chart` | `title`(<=32), `points[{x,y}]` (2-60, x strictly increasing), `xFormat` year/number, `prefix`, `suffix`, `decimals`, `tone`, `baseline` zero/data, `factId` | points deep-equal fact `dataset`; <=3 callouts, each needs `x` within range, spoken left to right |
| `bar-race` | `title`, `frames[{label(<=12), values[{name(<=18), value>=0}] (2-12)}]` (2-20), `prefix`, `suffix`, `decimals`, `topN`(3-8), `factId` | frames deep-equal fact `dataset`; <=8 distinct names (one palette color each); unique labels; <=1 callout |
| `kinetic-text` | `lines[]` (1-4, each <=14 chars), `tone` | **no digits**; <=2 emphasize cues, each a single on-screen word |
| `compare` | `title`, `left`/`right` `{label(<=14), value>=0, factId}`, `prefix`, `suffix`, `decimals` | each side equals its own fact's `value`; at least one side > 0; <=1 callout |
| `quote` | `quote`(<=140), `attribution`(<=28), `factId` | quote must appear inside fact `claim`; no cues |
| `timeline` | `title`, `events[{year int in [-3000,2100] != 0, label(<=26)}]` (2-6, years strictly increasing), `tone`, `factId` | events deep-equal fact `dataset`; exactly one emphasize cue per event, spoken chronologically; negative year = BC |
| `map` | `title`, `regions[]` (1-6 atlas country names), `focus` `[w,s,e,n]` (lat within +/-80), `tone`, `factId` | regions deep-equal fact `dataset`; each region must overlap `focus`; exactly one emphasize cue per region (any order) |

`tone` is one of `positive | negative | neutral | highlight`.

`SCENE_TYPES` is exported from the schema (derived from the discriminated union's options) and is what the skill guard test compares `rules.md` against.

## 6. Validation layers

All validators live in `src/schema/validate.ts` and throw `StoryboardError` with messages that name the scene id and the fix. They are called from `buildVideo` (used by `produce`, `sheet`, and the Remotion Root) and, scene-by-scene, from `check`.

| Validator | Guarantees |
|---|---|
| `parseStoryboard` / `parseFacts` | shape, strictness, unique ids, per-scene refinements in the schema |
| `assertVariety` | no three consecutive scenes of the same type |
| `assertCuesSupported` | titles and quotes take no cues; `emphasize` only on kinetic-text/timeline/map; callout caps per type (`big-number` 1, `line-chart` 3, `bar-race` 1, `compare` 1, others 0); line-chart callouts need `x` within range, other types forbid `x`; timeline/map need exactly one emphasize cue per item, each a single on-screen word, no two cues on the same item; kinetic-text <=2 emphasize cues on distinct words |
| `assertHeadlinesFit` | title headline fits the lane via `fitTitleFontSize` (width heuristic 0.75 em per char) |
| `assertTextScenes` | kinetic-text has no digits; quotes fit the quote lane |
| `assertMapRegions` | each region is a name in the bundled atlas (suggestions on near-miss) and overlaps `focus` |
| `assertFactsTraceable` | `big-number` value and each `compare` side equal the fact `value` exactly and display without rounding at the given `decimals`; line-chart/bar-race/timeline/map data deep-equal the fact `dataset`; line-chart last value and every bar-race value display exactly at `decimals`; quotes appear in the claim (curly quotes/dashes/ellipsis normalized, word-boundary matched) |
| `assertSceneTiming` | each scene finishes animating before its 8-frame exit fade: line draw, kinetic reveal, compare count-up, map last-region cue + settle, timeline last event + settle, quote reveal, bar-race run. Throws "too short ... lengthen the narration" |
| `assertDuration` | final length within 55,000 to 60,000 ms (enforced in `produce` unless `--no-enforce-length`) |
| `resolveCue` / `assertValidWords` (`schema/timing.ts`) | every `atWord` occurs in the narration; word timings are finite, ordered, non-negative |

**Fact tracing is the core integrity mechanism and it is narrower than it sounds.** Traced: chart, race, timeline and map data; `big-number` and `compare` values; quote text. **Not traced:** titles, kicker and headline text (including numbers inside them), chart titles, callout text, big-number and compare labels, quote attribution, and **every number spoken in narration** (which also appears in captions). The review sheet warns on digits in untraced on-screen text and lists callouts, but a wrong spoken figure passes `check`. This is the largest accuracy gap in the system (see section 15).

### `check` stage structure (`src/skill/check.ts`)

`checkStoryboard(storyboardJson, factsJson)` returns `{ok, issues[{stage,message}], warnings[], stats}`. It runs every stage independently, and for per-scene stages runs each on a one-scene storyboard, so a single pass reports one issue per bad scene (a scene with several faults within one stage reports only the first; see deferred minors). Stages: `storyboard schema` (stops here if it fails), `facts schema`, `variety` (whole board), `cues`, `headlines`, `text scenes`, `map regions`, `fact tracing`, `timing`. Timing uses `synthWords` (synthetic word timings), so it is an approximation; `produce` re-checks with real audio. Warnings: estimated length outside 55-60 s, and advice-style phrasing.

## 7. Timing model

`WordTiming = { text, startMs, endMs }` per narration token, per scene (scene-local ms).

1. `resolveCue(words, atWord, occurrence)` returns the word's `startMs`; `msToFrame` rounds to frames at 30 fps.
2. `composeScenes` (`src/pipeline/resolveScene.ts`): per scene, `wordsMs = max(word.endMs) + 400`; if the real audio length is known, `durationMs = max(wordsMs, audioMs + 400)`; `durationFrames = round(ms * 30 / 1000)`; `startFrame` accumulates. Cue errors are re-thrown with the scene id.
3. `totalFrames = sum(durationFrames)`; this becomes the `Production` composition length.
4. `buildCaptions` shifts every scene's words by the scene's start offset and chunks them globally (`chunkWords`): break on 24 characters, 4 words, a >500 ms gap, or sentence end; each chunk lingers 250 ms (capped at the next chunk's start).

Because duration follows narration, **video length is a function of the voice**, not of the storyboard. This is why the length gate is in `produce` and why the pre-render estimator is only approximate.

Pacing primitives (`src/charts/schedule.ts`, `pacedKnots`): line charts, timelines and maps are driven by "knots" that tie an animated cursor/progress to cue frames, with minimum segment lengths to prevent a teleporting cursor. If a later cue is spoken before an earlier one's x or order, a `RangeError` becomes a `StoryboardError` ("callout cues must run left to right in spoken order", "events must be spoken in chronological order").

Constants worth knowing (all in code, pinned by tests): `EXIT_FRAMES = 8`; `LINE_DRAW {start 14, share 0.7, minFrames 30}`; `RACE_RUN {start 10, share 0.8, minFrames 40}`; `KINETIC {firstDelay 4, lineGap 8, settle 18}`; `QUOTE {start 6, wordGap 3, attrLead 10, settle 18}`; `TIMELINE {start 12, share 0.7, minFrames 30, minSegment 6, settle 14}`; `MAP {zoomFrames 70, settle 12}`; `WIPE {frames 14, slant 280, lag 3}`.

## 8. The `produce` pipeline

`src/pipeline/produce.ts`, invoked by `scripts/produce.ts`. Options: `--storyboard`, `--facts`, `--out`, `--voice edge|standin` (default `edge`), `--no-enforce-length`, `--music-dir`, `--cache-dir` (default `out/voice-cache`).

Steps, in order:

1. Parse JSON and the storyboard.
2. **Voice, scene by scene, sequentially** (deliberately polite to Edge). Result per scene: `{audioPath, words, audioMs}`.
3. `buildVideo(...)` runs all validators with the real word timings and audio lengths, composes scenes, asserts scene timing, builds captions.
4. If `enforceLength`, `assertDuration` (55-60 s).
5. `resolveMusic` **before rendering** so an unsafe or missing music name fails fast.
6. Bundle once per process (`getServeUrl`, cached), `selectComposition("Production", inputProps)`, `renderFrames` to `frames/` as JPEG.
7. `encodeFrames` (system ffmpeg, glob `element-*.jpeg`, libx264, yuv420p) to `silent.mp4`.
8. `mixAudio` (section 10) to `audio.m4a`; clips are placed at each scene's start time.
9. `muxVideoAudio`: stream copy of both, `+faststart`, `-shortest`, to `final.mp4`.
10. `measureLoudness(final.mp4)` then `assertLoudnessOk`.
11. Write `manifest.json` (voice mode, frames, duration, loudness, per-scene id/type/start/duration/cues/audio).

Failure behavior: every step throws an `Error` with a message; `scripts/produce.ts` prints `produce failed: <message>` and exits 1. A rejected length means "edit the narration and run again"; voice audio is cached by text so a re-run only re-synthesizes changed scenes.

Typical wall time: about 2 minutes for a full 60 s video on the dev machine (see section 16).

## 9. Voice, alignment and captions

**Provider interface** (`src/voice/types.ts`): `(narration, voice) => Promise<{audioPath, words, audioMs}>`.

**Edge provider** (`src/voice/edge.ts`):

- Shells out to `tts/.venv/bin/python tts/tts.py --voice V --text-file F --out-mp3 M --out-json J`. `tts.py` uses `edge_tts.Communicate(..., boundary="WordBoundary")`, converts the 100 ns tick offsets to ms and writes a JSON list of `{text, startMs, endMs}`. It exits non-zero on empty narration, any exception, or no audio/events.
- Cache key: `sha256(voice + "\n" + narration)` first 16 hex chars; files `<key>.mp3`, `<key>.events.json`, `<key>.txt` in the cache dir. Writes go to `.part` files and are renamed on success; a failed run caches nothing.
- Events are validated with a strict Zod schema, then `alignEvents`.

**Why `alignEvents` exists (`src/voice/align.ts`):** Edge returns merged events for number phrases ("Between 2007 and 2009" becomes one 2.5 s event; "$1.5 trillion to $700 billion" one event; "56.8 percent" one event). Standalone numbers and plain words come back as their own events. So narration tokens and voice events do not line up 1:1. The aligner:

- Normalizes both to a letter/digit stream and requires the two streams to be identical (otherwise `VoiceAlignmentError` naming where they diverge and what the voice said).
- Maps each event's character range onto the tokens it overlaps and splits the event's duration among them by **spoken weight** (letters 1, digits 2, `%`/`$` 6, `&` 3, minimum 1).
- Tokens with no letters/digits ("&", dashes) are kept as zero-length words so captions show the narration as written; they never match a cue.

Consequence: cues placed on a word inside a merged number phrase are approximate, bounded by that event's length. The pipeline's mitigation is to write numbers in narration as spelled-out words, which Edge returns one event per word ("two thousand seven").

**Stand-in voice** (`--voice standin`): deterministic synthetic timings (`synthWords`: 90 ms + 55 ms per char per word, 40 ms gaps) and pink noise gated per sample by an `aeval` expression to those timings (the `volume` filter only re-evaluates once per ~23 ms audio frame, which left 40 ms gaps audible). Free, offline, deterministic. Used for dry runs and tests only; it is noise, not speech. `synthWords` also drives the review stills and the Remotion demo compositions.

**Captions:** word-by-word, the active word highlighted, upcoming words dimmed, in a fixed lane (y 1340 to 1536) below all scene content and above the platform UI zone.

## 10. Audio finish

`src/audio/graph.ts`, `mix.ts`, `music.ts`.

- Narration clips are delayed to scene starts with `adelay`, formatted to 44.1 kHz stereo, summed with `amix normalize=0 duration=longest`.
- Narration is **padded to full length before ducking**: `sidechaincompress` stops when its sidechain input ends, which otherwise cut the music off when the last clip finished (a bug found in review).
- Music (optional): looped (`-stream_loop -1`), volume 0.35, ducked by narration with `sidechaincompress threshold=0.02 ratio=10 attack=15 release=350`, then mixed with the narration. `"ambient"` is a procedurally generated minor drone (sines at 110, 164.81, 220, 261.63 Hz, tremolo, lowpass, echo, fades), original so there is no license to track. Echo adds a tail, so the generator clamps with `-t`. Music names are validated (`isSafeMusicName`: plain file name, no `..`) and resolved inside `music/`. `music/README.md` has a license table to fill if you add tracks.
- **Loudness is two-pass `loudnorm`**: pass 1 measures (`print_format=json`); pass 2 applies `linear=true` with the measured values and encodes AAC 192 kbps at 44.1 kHz. Targets: `I=-14`, `LRA=11`, **`TP=-2`**. The true-peak target is set below the -1.5 dBTP ceiling on purpose: resampling and the AAC encode add about 0.1 dB of overshoot (the first real run measured -1.42 dBTP at TP=-1.5).
- Acceptance gate (`assertLoudnessOk`): final file must be within -14 +/- 1 LUFS and at most -1.5 dBTP, else `produce` fails. Audio below -50 LUFS is rejected as silent/unmeasurable.
- Results across the three real videos: -14.05, -14.1, -14.06 LUFS.

## 11. Design system and scene library

**Frame:** `VIDEO = {1080, 1920, 30fps}`. Safe area: top 8% (154 px), bottom 20% (384 px, platform UI), sides 60 px.

**Palette ("bold-flat", the only theme):** ground `#15133b`, ink `#fff7e8`, positive `#2ee59d`, negative `#ff5d5d`, neutral `#7c8cff`, highlight `#ffd23f`. Semantic roles are fixed: gain/loss colors are never decorative. `CATEGORICAL` (8 colors, excludes the semantic gain/loss colors) is used by bar races, which is why races cap at 8 names.

**Fonts:** Archivo Black (display, 400) and Inter (body, 600) via `@remotion/google-fonts`. **They load from Google at render time**, so rendering needs internet; this is a determinism and offline risk (section 15).

**Lanes:** `CAPTION_LANE` y 1340 to 1536; `TITLE_LANE` = safe width by (caption top minus safe top minus 140); `KINETIC_LANE` (max font 190); `QUOTE_LANE` (max font 120); `MAP_BOX` y 300 to 1300; `CHART_BOX` y 640 to 1250 (charts were shrunk from 760 to 610 px tall to make room for captions). Fit calculations use a width heuristic of 0.75 em per character for the display face; text that cannot fit the lane at its minimum size fails validation rather than overflowing.

**Motion rules (enforced through shared primitives in `design/motion.ts`):** data uses `easeOutCubic`, never overshoots (`dataProgress`, `countUp` with half-away-from-zero rounding and -0 normalization); objects use a light-overshoot spring (`popIn`, damping 11 / stiffness 140 / mass 0.7), never applied to data values; rank swaps use `easeInOutCubic`. Scene transitions are two slanted wipe bands (`WipeOverlay`, `wipe.ts`) that fully cover the frame exactly on each cut.

**Scene components** (`src/scenes/*`): React components that read `useCurrentFrame()` and draw SVG/HTML. Pure scheduling logic is split out (`timing.ts`, `layout.ts`) so it is unit-tested; the components themselves are covered by golden-image snapshots, not unit coverage.

- Line chart: draws with a cursor that reaches each callout's `x` on the callout's cue frame; badge placement keeps callouts inside the gutters (`placeBadge`); the path is rebuilt every frame.
- Bar race: interpolates between frames, top-N, rank swaps with eased motion, one palette color per name.
- Map: `world-atlas` `countries-110m` (Natural Earth names such as "United States of America", "Czechia"); Mercator camera zooms from a widened bbox (`WIDE_FACTOR` 2.4) to the focus box over 70 frames; countries light on their spoken names; label position is the centroid of the largest polygon, clamped into the box. Borders are modern and approximate; the scene says so.
- Timeline: a spine whose cursor stands on each event on its cue frame; years render via `formatYear` (negative = "N BC", under 1000 = "AD N").
- Kinetic text, compare, quote, big-number, title: as per the schema; compare bars share a baseline with the VS badge between them.

## 12. Skill tooling

All are thin CLIs in `scripts/` over modules in `src/skill/`. Argument parsing is shared (`parseFlags`: value flags need a value, booleans stand alone, unknown flags throw).

### `check` (see section 6)
`npm run check -- --storyboard S --facts F`. Exit code non-zero on any issue; prints a report ending in `OK` or `FAIL: N issues`.

### `catalog`
`npm run catalog` regenerates `.claude/skills/make-explainer/storyboard.schema.json` with `z.toJSONSchema(StoryboardSchema, {unrepresentable: "any"})`. Refinements are not representable, which is why `rules.md` exists. Never hand-edit the JSON. A guard test fails if it drifts.

### `estimate` (planning only)
`WORDS_PER_SECOND = 2.85`, pooled over six real runs (665 words in 232.8 s of audio; individual videos ranged 2.50 to 3.18). Scene length is `words / 2.85 + 0.4 s`. Good to about 10%; a test pins all six real videos within 12%. Target is about 155 words (55 to 60 s). `produce` is authoritative.

### `adviceLint`
Regex warnings for advice or certainty phrasing ("you should buy", "guaranteed", "risk-free", "buy now", "can't lose", "not financial advice"). Warnings, not errors.

### `verify-facts` (advisory source check)
`npm run verify-facts -- --facts F [--out V]`. For each fact, fetches the source URL and searches the page text for the fact's numbers (`factTokens` of `value`, numbers in `dataset`, and numbers in the claim; a number counts as found in either plain or thousands-separated form, because year tokens like "2015" and "2,015" must not be able to block `supported`). Status per fact:

- `supported`: every number found; `partial`: at least 60% found, or nothing numeric to check; `not-found`: under 60%; `unreachable`: non-2xx, non-text content type, too many redirects, timeout; `blocked`: refused by the URL guard.
- It cannot prove a number *means* what the claim says. Small integers (8, 9, 27) appear on almost any page, so `supported` is weak for them (observed on the rule-of-72 rehearsal).
- On real runs it correctly rejected: spglobal.com (403), example.com (404), and a bls.gov landing page that lacked the data.

**Fetch guard (security-reviewed; two review rounds):**

- Schemes: http and https only. Hosts normalized (lowercase, brackets and trailing dots stripped). Names `localhost`, `*.localhost`, `*.local`, `*.internal`, `*.home.arpa` blocked.
- `isBlockedAddress` blocks, for IPv4: `0/8`, `10/8`, `127/8`, `169.254/16`, `172.16/12`, `192.168/16`, `100.64/10` (CGNAT), `198.18/15`, `224/4` and above (multicast/reserved, including 255.255.255.255), `192.0.0/24`, `192.0.2/24`, `192.88.99/24`, `198.51.100/24`, `203.0.113/24`. For IPv6 it parses any spelling into eight 16-bit groups (compression, dotted tail) and fails closed on invalid literals; it unwraps and re-checks the embedded IPv4 in `::ffff:a.b.c.d`, `::a.b.c.d`, `64:ff9b::a.b.c.d` and 6to4 `2002::/16`; it blocks `::`, `::1`, `fc00::/7`, `fe80::/10`, `fec0::/10`, `ff00::/8`, local-use NAT64 `64:ff9b:1::/48`, discard `100::/64`, Teredo `2001:0::/32` and documentation `2001:db8::/32`.
- **DNS names are resolved on every hop** (`dns.promises.lookup(host, {all: true, verbatim: true})`) and rejected if *any* returned address is blocked. The WHATWG URL parser already canonicalizes numeric host tricks (`127.1`, `2130706433`, `0x7f.0.0.1`).
- Redirects are followed manually, max 3 hops, each re-checked. 15 s timeout. Response body capped at 2 MB: a streamed read stops at the cap; a response with no readable stream is treated as empty (never buffered uncapped).
- HTML to text (`stripMarkup`) is a single forward scan with memoized "no closer" / "no more >" flags so every search resumes where the last ended (linear time). The earlier regex form (`/<(script|style)[\s\S]*?<\/\1>/` and `/<[^>]+>/`) was quadratic on unclosed tags and could hang the process; a test now feeds 100k unclosed `<script`, 200k `<a` and 100k `<style>` and requires under 1 s.
- **Residual: the resolved address is not pinned.** A hostile DNS server can answer differently between the lookup and the fetch (DNS rebinding). Mitigations: GET only, short timeout, and the tool is a local developer aid. Closing it properly means connecting to the already-checked IP with the original `Host` header and TLS server name. Documented in README, spec and RESULTS.
- The guard is for a trusted local operator reading URLs Claude chose; do not expose `verify-facts` to untrusted URL input without pinning.

### `sheet` and the review model
`npm run sheet -- --storyboard S --facts F --out DIR [--verify V]` renders one settled still per scene (frame = scene end minus 10 frames, using synthetic timings so no voice is needed) and writes a **single self-contained `review.html`**: scene stills embedded as base64 PNG data URIs, narration, cues, every fact with its source link and verification status, and warnings.

Warnings generated: estimated length outside 55-60 s; advice phrasing; **digits in untraced on-screen text** (title headline/kicker, chart/map/timeline titles, big-number and compare labels, quote attribution); every callout (untraced); facts not used by any scene; non-`supported` verify status; **stale verify result** (the fact's numbers no longer match the numbers the verifier checked; it compares the found+missing token sets with the current plain `factTokens`, so an edit that keeps the same numbers is not detected); placeholder wording in a claim ("demo data", "verify before publishing", "placeholder", "todo").

Security of the sheet: all text is HTML-escaped; images must match a strict `data:image/png;base64,...` pattern (else it throws); only http(s) source URLs become links (with `rel="noopener noreferrer"`); and the page sets a CSP (`default-src 'none'; img-src data:; style-src 'unsafe-inline'`). `review/` is gitignored.

## 13. The Claude Code skill

`.claude/skills/make-explainer/` is a project skill (`/make-explainer <topic>`):

- `SKILL.md`: hard rules and a 7-step workflow. Hard rules: every on-screen number/date/name/quote comes from a fact whose source was actually opened with WebFetch; narration states only what an opened page says; never edit `src/`, `tests/`, validators or the skill to make a storyboard pass; never change a fact to match a storyboard (or vice versa) without re-reading the source; **STOP at the review gate**; finance is educational and historical only (no advice, no predictions), naming the period and source for every figure.
- Workflow: (1) brief, (2) research and write facts (the skill says 5 to 8; the rehearsals used 2 to 3, see deferred minors), (3) `verify-facts`, (4) script and storyboard (about 155 words, 6 to 10 scenes, hook first, one idea per scene, varied types), (5) `check` and repair, max 6 rounds, (6) `sheet` then stop and ask, (7) `produce` after approval, report path/length/loudness and say what was not judged.
- `rules.md`: per-scene-type rules the schema cannot express, cue semantics, narration style (spell out numbers; "percent" and "dollars", never symbols; short sentences; narration must contain every cue word), facts rules including the explicit list of untraced items, and finance guardrails.
- `storyboard.schema.json`: generated, 34,584 bytes.
- Guard tests keep the skill honest: `tests/unit/skillFiles.test.ts` checks SKILL.md frontmatter (name matches directory), a 200-line cap, that the hard rules and the human gate are present, that every `npm run <script>` and repo path the skill files mention exists, and that `rules.md` has a heading for every scene type and covers cues, narration style, facts and finance safety; `tests/unit/catalog.test.ts` covers the generated schema.

The skill uses `fixtures/finance`, `history` and `ancient` storyboards as few-shot examples.

## 14. What to reuse, what to change

**Reuse as-is (high confidence, well tested):**

- The two contracts and the validator stack. The "scene duration follows narration, cues land on words" model is the best idea in the project.
- Fact tracing by deep-equal against `dataset`/`value`. It is cheap, strict and catches the failure Claude is most likely to make (silently altering a number while writing scene data).
- Voice provider interface + Edge adapter + `alignEvents` (all the merged-number handling is test-pinned) + cache.
- Audio graph and the two-pass loudnorm with an acceptance gate.
- The `check` runner design: independent stages, per-scene collection, messages that name the scene and fix.
- `verify-facts` with the hardened guard, and `sheet`/`review` with the escaping and CSP.
- The skill's operating rules (verify before you write, human gate, never modify the checkers).

**Change first when refining (highest value, roughly in order):**

1. **Trace the narration.** The biggest accuracy hole. Options: require every number spoken in narration to match a fact value (parse spelled-out numbers back to digits, or have Claude emit a `spokenFigures` list per scene that must each reference a `factId`); trace chart titles, labels and callout text the same way, or restrict them to templated forms (`"{fact.label}"`).
2. **Strengthen `verify-facts`.** Today it is a presence check. Better: require the source page to contain the number *near* the claim's key nouns, record a text snippet (quote the matching sentence) into `verify.json` so the reviewer sees the evidence, and treat small integers as unverifiable rather than "supported". Add DNS pinning if it will run unattended.
3. **Fonts offline.** Self-host Archivo Black and Inter (or bundle with `staticFile`) so renders do not depend on Google at render time.
4. **Parallel rendering.** `renderFrames` runs single-process here. Remotion supports `concurrency`; per-scene rendering plus concatenation would cut the ~2 min. Be careful with the macOS 12 ffmpeg issue if you move to Remotion's `renderMedia`.
5. **Length estimator.** Replace the words-per-second heuristic with the real thing: since voice results are cached by text, a "dry produce" that only synthesizes audio can return the exact length in seconds for the cost of the TTS calls. The skill could call it before the review gate.
6. **Theme and scene library.** The schema fixes `theme: "bold-flat"`. Adding themes means threading tokens through the components instead of importing `PALETTE`/`SAFE` constants; the lane/fit math is all in `design/tokens.ts` and `design/layout.ts`.
7. **Voices.** Only `en-US-AndrewNeural` has been used end to end (Aria was spiked). Pronunciation of spelled-out numbers ("nine point zero zero six", "five oh nine BC") has never been judged by the agent.
8. **Skill ergonomics.** Make `check` report all faults per scene within a stage (currently the first per stage per scene); fail loudly when the facts file cannot be parsed instead of silently skipping fact tracing.

**Portability notes if you move this into another repo:**

- Copy `src/schema`, `src/pipeline`, `src/voice`, `src/audio`, `src/captions`, `src/design`, `src/skill`, `scripts`, `tts`, and whichever of `src/scenes`, `src/charts`, `src/map`, `src/compose` you need. `Root.tsx` imports the demo fixtures and `RenderStress`; trim as needed but keep the `Production` composition with `calculateMetadata`.
- `bundle.ts` bundles `path.resolve("src/index.ts")` relative to the **current working directory**; all scripts assume they run from the repo root. The same is true of `tts/.venv/bin/python` (`TTS_PYTHON`) and `out/voice-cache`.
- `vitest.config.ts` coverage globs and thresholds (80% on non-visual logic) must be carried over.
- `tsx` runs the scripts and imports the atlas JSON directly; no special handling is needed for `produce`.

## 15. Known limits, residual risks and deferred minors

**Accuracy and integrity**

- Narration figures, titles, labels, callout text and chart titles are not traced to facts (section 6). The reviewer is the only control for them.
- The quote trace cannot detect a truncated quote (the quote must be a substring of the claim, not the whole of it).
- `verify-facts` is advisory and cannot verify meaning; a fact can be `supported` and still be wrong. Small integers make `supported` weak.
- A stale-verify check cannot see an edit that keeps the same set of numbers.
- Map borders are modern (Natural Earth 110m) and approximate; historical maps are not supported.

**Security**

- DNS rebinding between lookup and fetch is not closed (section 12).
- `verify-facts` fetches whatever URL a fact names; treat `facts.json` as trusted input from the operator and Claude, not from the internet.
- The review HTML is built defensively (escaping, CSP, strict data URIs), but if you extend it, keep every dynamic value behind `escapeHtml`.

**Operational**

- Edge TTS is an unofficial endpoint reached through the `edge-tts` library: it needs internet, can change without notice, and has no SLA. Treat it as the first thing to replace for anything commercial. The `VoiceProvider` interface is the seam; a replacement must return per-token `WordTiming` or you must keep `alignEvents`.
- Google Fonts at render time (section 14).
- Rendering is single-process; the stand-in voice is noise, not speech.
- A cosmetic issue remains: a quote can wrap leaving one short word at a line end; the line chart area fill ends in a hard vertical edge at the cursor; bar-race pacing is proportional; a callout badge could cover a y tick label (seen on early renders; not re-audited after Plan 4).

**Deferred minors from the final review (not fixed)**

- M1: `check` silently skips fact tracing when the facts file fails to parse (it reports a `facts schema` issue but tracing never runs, and the report has no explanatory note).
- M2: `hasToken` matches integers inside decimals, and x-years count toward coverage, both of which inflate `supported`.
- M3: the `verify-facts` CLI's `.then` has no `.catch`, so a failed `--out` write is an unhandled rejection.
- M4: SKILL.md asks for 5 to 8 facts, but the rehearsals used 2 to 3.
- M5: the `roman-republic` rehearsal goes slightly beyond its sources ("great rival", "sea battle", Italy in the `f-carthage` dataset, 509 BC shown as exact though the page says "c.").
- M6: the `rule-of-72` rehearsal says "for centuries" and "taxes and fees", which no fact states.
- Within one `check` stage, a scene with several faults reports only its first.

The owner reviewed the three videos and was satisfied with the outcome; M5 and M6 remain as written in the committed storyboards.

## 16. Measurements and calibration data

Machine: Intel Mac, 8 cores, 16 GB, macOS 12.6.3.

| Measurement | Result |
|---|---|
| RenderStress, 300 frames, JPEG sequence | about 29 s incl. bundling (~0.1 s/frame) |
| System ffmpeg libx264 encode | 8.6 s per 300 frames (about 50 s per 1800) |
| FinanceDemo render | 752 frames, 25.07 s, 46.8 s wall (~0.062 s/frame) |
| Map scene | 251 frames in 43 s (~0.17 s/frame; per-frame path generation) |
| Ancient demo end to end | 889 frames, 29.6 s, 1 min 56 s (~0.13 s/frame all-in) |
| Real 60 s video end to end | about 2 min (125 to 127 s measured) |
| Loudness, real videos | -14.05, -14.1, -14.06 LUFS; true peak after fix about -1.99 dBTP |

Edge TTS word-boundary spike: words returned vs expected 18/21 on a test sentence with numbers; digit-bearing phrases merged into single events; numbers written as words returned one event per word.

Estimator calibration (real words per second, per video): 2.85, 3.18, 2.76 for the three Plan 6 videos; pooled over six runs 2.85 (range 2.50 to 3.18). The first estimator (2.68) ran 3 to 15% long.

The three rehearsal videos:

| Video | Facts | verify | Scenes | Length | Loudness |
|---|---|---|---|---|---|
| `us-inflation` (BLS CPI-U Dec-to-Dec 2016 to 2023) | 3 BLS | 3 supported | title, line-chart, big-number, kinetic-text, compare, title | 57.3 s | -14.05 |
| `rule-of-72` (Wikipedia) | 3 | 3 supported (weak: small integers) | title, kinetic-text, big-number, compare, kinetic-text, title | 57.5 s | -14.1 |
| `roman-republic` (Wikipedia) | 2 | 1 supported, 1 partial (no numbers) | title, timeline, map, kinetic-text, title | 58.9 s | -14.06 |

Lessons from these runs: `check` passed first time on all three; length was the repeated repair (one video was rejected at 50.2 s and re-narrated); a web *summary* of BLS gave annual-average inflation that differed from the opened table's December-to-December figures, so only numbers from the opened page were used; narration was cut back to what the opened pages say after review.

## 17. Testing strategy

- **Unit (`npm test`, 71 files / 494 tests):** schema strictness, every validator, cue resolution, alignment cases from the spike, chunking, audio graph strings and loudness parsing, scheduling math, geometry, layout fit, estimator calibration, the skill guard tests, `verifyFacts` (injected fake `fetch` and injected resolver, so unit tests never touch DNS or the network), review HTML escaping, and the SSRF address table. Real-ffmpeg tests exist (`mixBehavior`, `standin`, `probe`, `music`), taking seconds each.
- **Coverage (`npm run test:cov`):** thresholds of 80% lines/functions/branches/statements over non-visual logic (`src/schema`, `pipeline`, `charts`, `voice`, `audio`, `map`, `skill`, scene `timing.ts`/`layout.ts`, `design/motion|layout`, `captions/chunk`, `compose/wipe`). Excluded: `produce.ts`, `bundle.ts`, `sheetRender.ts`. Last result 97.6% lines.
- **Render (`npm run test:render`, run with `--no-file-parallelism --testTimeout=240000`):** golden-image snapshots via `renderStill` plus `pngjs` diff (`diffRatio` <= 0.002), and `produce`/`sheet` integration tests. `UPDATE_SNAPSHOTS=1` rewrites goldens; **review new goldens by eye**, never accept blindly. The live Edge test is skipped without network.
- **Process used to build it:** each plan was executed test-first (RED before GREEN), with a ledger and one fresh Opus code-review at the end followed by a single fix pass. If you keep this process, the review catches real defects: it found six Important issues in Plan 6 (SSRF bypasses, per-scene collection in `check`, stale-verify handling, untraced label digits, an unsupported claim in narration, estimator calibration), all fixed with failing tests first.

## 18. Gotchas learned the hard way

- Render tests **must** run serially: five render files in parallel produced a different golden failure each time.
- The filesystem is case-insensitive: `Wipe.tsx` collided with `wipe.ts` (TS1261). The overlay is `WipeOverlay.tsx`.
- `sed -i` needs `''` on macOS.
- Remotion requires `zod` exactly 4.5.4.
- `sidechaincompress` ends with its sidechain input; pad narration to full length first or the music is cut off.
- The AAC encode raises true peak ~0.1 dB: that is why loudnorm targets TP=-2 against a -1.5 ceiling.
- `volume eval=frame` is too coarse for 40 ms gaps; use per-sample `aeval`.
- The echo filter extends audio; clamp the ambient bed with `-t`.
- Cue-token collision: `"$1.5"` and `"15"` normalize to the same token unless a `.` between digits is preserved (it is, in `normalizeWord`).
- The year-token bug in `verify-facts`: the same year can appear as "2015" or "2,015"; tokens are grouped so either counts.
- Atlas names follow Natural Earth: "United States of America", "Czechia". A wrong name fails with suggestions from `suggestCountries`.
- `tsx` imports the atlas JSON directly, so no loader config is needed.
- A "too short" map guard cannot be tripped by narration alone (the 400 ms tail pad guarantees room); it stays as defense and is tested with a hand-built scene.
- Edge merges number phrases into single events: never assume one event per token.
- A web search summary is not a source. Open the page and copy the number from it.

## 19. Command reference

| Command | Purpose |
|---|---|
| `npm install` | Node deps |
| `npm run setup:tts` | create `tts/.venv`, install `edge-tts` |
| `npm run check -- --storyboard S --facts F` | all validation, estimate, advice lint |
| `npm run verify-facts -- --facts F [--out V]` | advisory source check |
| `npm run sheet -- --storyboard S --facts F [--verify V] --out DIR` | stills + `review.html` |
| `npm run produce -- --storyboard S --facts F --out DIR [--voice edge\|standin] [--no-enforce-length] [--music-dir D] [--cache-dir D]` | full render |
| `npm run catalog` | regenerate `storyboard.schema.json` |
| `npm test` / `npm run test:cov` / `npm run test:render` | suites |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run studio` | Remotion Studio (demo compositions) |
| `npm run render:finance`, `render:hello`, `still:*`, `bench` | legacy demo renders |

Typical session: `/make-explainer <topic>` in Claude Code, then open `videos/<slug>/review/review.html`, then approve, then `out/<slug>/final.mp4`.

## 20. History and provenance

Commits on `main` (oldest first): `5e1c5f2` foundation and spikes; `e726f04` animated line charts and bar race; `b531bf8`/`b35bb2b` voice, captions, audio (`npm run produce`); `9208964`/`e66b1a0` narration pacing, wipes, kinetic-text, compare, quote; `e95eb8d`/`6c8e864` timeline and map; `fb0725a` Plan 6 doc; `5187716` skill and tooling; `9ca724e` three rehearsal drafts; `4a48273` verify-facts hardening (body cap, linear HTML stripping, stricter IP filter). Pushed to `https://github.com/C4KEBX/motionexplainers.git`.

Where decisions are recorded: the design spec (`docs/superpowers/specs/2026-10-05-motion-explainers-design.md`, with per-plan "decisions" subsections and §7 as-built), the six plans in `docs/superpowers/plans/`, and `spikes/RESULTS.md` (measurements and open items per plan, including "Inputs for Plan N" sections that explain why each plan was scoped as it was). The execution ledger (`.superpowers/progress.md`) is gitignored scratch and is not part of the repository.

Rulings made during Plan 6 (decisions taken without the owner, with what each costs if wrong):

- The skill lives at `.claude/skills/make-explainer/` and outputs at `videos/<slug>/`, not a top-level `skill/`. Cost: a rename.
- `verify-facts` treats "2015" and "2,015" as one number (plan defect found on a real run). Cost: slightly more lenient `supported`.
- A guard test required `rules.md` to mention `npm run catalog`; one sentence was added rather than loosening the test.
- The review gate was waived for the three rehearsal videos only; they were then reviewed by the owner.
- Narration is limited to what opened pages say; only numbers from the opened BLS table were used (2015 dropped).
- Stale-verify detection compares number sets; an edit that preserves the set is invisible.
- The DNS address is not pinned (documented residual).
