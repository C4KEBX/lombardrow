# Motion Explainers: Design Spec

Date: 2026-10-05
Status: Draft, awaiting user review

## 1. Goal

Automate 60-second vertical explainer videos on finance, investing and history, with top-notch, fully animated motion graphics, produced at $0 marginal cost on a local machine.

The core of the project is the **motion-graphics rendering engine**. Script writing, fact-checking and review are comparatively easy and are handled by a Claude Code skill around the engine.

### Success criteria
- A 60s (55-60s), 1080x1920, 30fps MP4 renders locally with no paid services.
- Charts are truly animated (data-driven motion), never static images.
- Visuals land on spoken words (word-synced cues).
- The look is consistent and hand-designed: one token-driven design system, no template feel.
- Every number on screen traces to a sourced fact.

### Decisions already made (user-confirmed)
| Decision | Choice |
|---|---|
| Output format | Vertical 9:16 only (v1) |
| Visual direction | Bold flat motion design |
| Engine | Remotion (React). Revideo (MIT) is the fallback if licensing becomes a problem |
| Voice | Free TTS (Edge TTS / Kokoro) |
| Project location | `/Users/justinmason/Claude Code/motion-explainers/` |

## 2. Non-goals (v1)
16:9 output, multiple themes, auto-publishing, stock footage, AI image or video generation, any web UI.

## 3. Pipeline

```
topic -> [1 Script]     LLM -> script.md + facts.json (sourced)
      -> [2 Storyboard] LLM -> storyboard.json (typed scenes, schema-validated)
      -> [3 Voice]      TTS -> narration.wav + word timings
      -> [4 Compose]    Remotion renders scenes timed to word timings
      -> [5 Finish]     music ducking + loudness (ffmpeg) -> final.mp4
```

Steps 1-2 are the "brain" (LLM). Steps 3-5 are the "renderer". They communicate only through `storyboard.json` and `facts.json`.

### Boundary: storyboard contract
`storyboard.json` is a strict, versioned, Zod-validated contract.

- Top level: `meta` (title, theme, voice), `scenes[]`, `audio` (music choice).
- Scene: `{ id, type, narration, props, cues[] }`.
- **Duration is derived from narration audio**, never specified.
- **Cues key off words**: `{ atWord, do, ... }` resolves to a timestamp from word timings. Re-recording with another voice re-times everything.
- Validation rules:
  - Total narration length 55-60s.
  - Chart series have >= 2 points and no NaN.
  - Every number rendered on screen references a `facts.json` entry with a source; the renderer refuses unsourced numbers.
  - Variety check: no 3 identical scene types in a row.

Consequences: the renderer is buildable and testable with hand-written storyboards and no LLM; the LLM cannot invent layouts.

## 4. Motion design system

All tokens live in `src/design/`.

- **Palette**: one deep ground color per video plus 3-4 saturated flat colors with fixed semantic roles (positive, negative, neutral, highlight). Gains and losses are never decorative.
- **Type**: one heavy display grotesk (headlines, numerals) and one clean sans (labels), both free Google Fonts via `@remotion/google-fonts`. Numerals are the hero element.
- **Depth without gradients**: hard offset shadows, overlapping color blocks, parallax layers.
- **Safe zones**: top ~8% and bottom ~20% clear of platform UI; captions in a fixed lane.

### Motion rules (enforced via shared primitives)
1. Springs (light overshoot) for objects; precise ease-out with **no overshoot** for data values.
2. Nothing is static: every scene has entrance, sustain motion (drift, pulse or camera push) and exit.
3. Staggered entrances, 3-5 frames apart.
4. Continuity between scenes: shape wipes and matched elements carried across cuts.

### Dynamic charts
Charts are pure functions of `(data, frame)`, built with SVG and d3 math (`d3-scale`, `d3-shape`, `d3-geo`).
- Lines draw on with a leading dot; the Y axis rescales smoothly as data appears.
- Bars grow and re-sort (bar race); values count up via interpolation.
- Callout annotations pop in exactly on their cue word.
- Camera pushes in on the key segment.

### Chart decisions (Plan 2)
- Chart data must deep-equal a `dataset` on a sourced fact; the last line-chart value must display exactly at the scene's `decimals`.
- Callouts on line charts carry an `x` data anchor and appear once both the cue word has been spoken and the line has reached `x`. Callout text is capped at 24 characters and is not traced to facts (the script/fact-check step must verify it).
- Bar races support at most 8 distinct entities (one palette color each).
- Camera push-in and scene-to-scene transitions were deferred from Plan 2 to Plan 4 (scaling a whole chart pushes tick labels out of the safe gutters).
- The voice step and word-splitting normalizer move to the plan that adds captions and audio finish; Plan 2 uses synthetic word timings (`fixtures/synthWords.ts`).

### Plan 4 decisions
- **Line-draw pacing:** the cursor sits on each callout's `x` on that callout's cue frame (the line speed is a monotone cubic through `(frame, progress)` knots, continuous through callouts, no overshoot). A cue spoken before the line can get there is pushed to at most start + 6 frames; callouts spoken right to left are rejected. Bar-race pacing stays proportional (no spoken anchor).
- **Transitions:** two slanted flat bands (neutral lead, highlight lag) sweep across every cut, 14 frames centered on the cut, below the captions; scene durations and audio sync are unaffected.
- **Dropped from v1:** the chart camera push-in (labels leave the safe gutters when a chart is scaled) and matched-element transitions; revisit once real videos show a need.
- **Label legibility:** tick labels and bar names/values draw above the data with a ground-colored halo; a tick label is hidden while a callout badge overlaps it.
- **`kinetic-text`:** 1-4 lines of at most 14 characters, no digits (numbers must come from facts), up to 2 `emphasize` cues whose `text` names a single on-screen word.
- **`compare`:** two sides, each `{label, value >= 0, factId}`, each traced to its own fact with the `big-number` rules; at most one callout, on the larger side.
- **`quote`:** quote text (max 140 chars) must appear in its fact's `claim` (curly quotes and whitespace normalized); no cues; rejected if it cannot fit the lane or cannot finish revealing before the scene exits.

### Plan 5 decisions
- **Shared pacing:** `pacedKnots` (monotone schedule through `(frame, progress)` anchors, min 6 frames apart) drives the line chart callouts and the timeline spine. On `timeline` and `map`, the `emphasize` cue is the reveal cue: exactly one per event or region, its text a single word of the event label or region name, no two cues on one item.
- **`timeline`:** 2-6 events `{year, label <= 26}`, years strictly increasing, integer, never 0 (negative is BC); events spoken in chronological order; events deep-equal the fact's `dataset`; years display as `753 BC`, `AD 476`, `1066`.
- **`map`:** regions are country names from the bundled `world-atlas` 110m data (modern borders, so the scene always shows "Modern borders, approximate"); `focus` is a `[west, south, east, north]` box; the camera zooms from a 2.4x wider view into the focus; regions deep-equal the fact's `dataset`; unknown names fail with close-match suggestions.
- **Quotes** (Plan 4 carry-overs): the trace is word-bounded and normalizes dashes and ellipses; the quote renders a 0.22em word gap that the fit check shares; attribution is capped at 28 characters.

### Scene library (v1)
`line-chart`, `bar-chart` / `bar-race`, `big-number`, `kinetic-text`, `timeline`, `map` (history; free `world-atlas` data), `compare`, `quote`, `title` / `outro`. Nothing beyond this until real videos demand it.

### Performance constraint
Target machine is an Intel Mac (8 cores, 16 GB). Remotion renders each frame in headless Chrome, so avoid heavy blur/filter effects; use flat shapes and transforms. Render 1080x1920 at 30fps.

## 5. Voice, timing and captions

Synced visuals require word-level timestamps.

- First choice: **Edge TTS** (free, no key) if word boundaries are usable.
- Fallback: **Kokoro** (local, free) plus **whisper.cpp** forced alignment.
- **Spike result (2026-10-06, see `spikes/RESULTS.md`)**: Edge TTS `WordBoundary` works and is accurate for plain words, but any phrase containing digits is merged into a single event (e.g. "$1.5 trillion to $700 billion"). Decision: use Edge TTS and add a normalizer that splits merged events per token (duration distributed by character length). If cue accuracy on numbers proves too coarse, fall back to spoken-form pre-normalization or whisper.cpp alignment. The schema is unaffected. **Implemented in Plan 3** (`src/voice/align.ts`, split by spoken weight; verified live against Edge on a sentence with merged digit phrases).

Captions render inside Remotion (`@remotion/captions`), share the design tokens, animate word by word with the active word highlighted, and sit in the safe-zone lane.

## 6. Audio finish

Music is either generated (`audio.music: "ambient"`, an original drone bed, no license to track) or a user-supplied file in `music/`; no third-party tracks are bundled. Mixing is system ffmpeg only (Remotion's bundled ffmpeg does not run on macOS 12).

ffmpeg: music bed ducked under narration, loudness-normalized to -14 LUFS. No music API is needed.

## 7. Claude Code skill (`.claude/skills/make-explainer/`)

As built (Plan 6). The skill is a project skill, so Claude Code discovers `/make-explainer <topic>` itself; outputs live in `videos/<slug>/`.

1. Brief, then research: WebSearch and WebFetch primary sources; write `facts.json` (id, claim, `value` or `dataset`, source name and url). Numbers are only ever copied from a page that was opened.
2. `npm run verify-facts` (advisory; guarded fetch: http(s) only, private/local and mapped-IPv6 addresses blocked, DNS names resolved and checked on every hop, no address pinning) checks that a fact's numbers appear on its source page.
3. Script and storyboard: about 155 words for 60 s, using the generated `storyboard.schema.json`, `rules.md` and the three fixtures as examples.
4. `npm run check` collects every validation issue in one pass (repair loop, at most 6 rounds), estimates length at 2.85 words/s (good to about 10 percent; `produce` is authoritative) and lints advice-style phrasing.
5. **Human review gate:** `npm run sheet` writes a self-contained `review.html` (a still per scene, narration, cues, every fact with its source check, warnings for untraced text). The skill stops there.
6. After approval, `npm run produce` renders the final mp4.

Hard rules: never edit `src/`, `tests/` or validators to make a storyboard pass; never change a fact to match a storyboard or the reverse without re-reading the source; no advice or predictions. `rules.md` and `storyboard.schema.json` are guard-tested against the scene types and scripts. The rehearsal waived the gate for three draft videos (see `spikes/RESULTS.md`).

## 8. Build order

Each milestone ends in something watchable.

1. **Spike**: word timings from Edge TTS or Kokoro; Remotion render-time measurement on this Mac.
2. **Foundation**: design tokens, motion primitives, schema, 10s hello-world render.
3. **Charts first**: `line-chart`, `bar-race`, `big-number`. The animation quality bar is proven here before any breadth. **Done (Plan 2)**: animated line chart (running-max axis rescale, leading dot, count-up readout, data-anchored callouts) and bar race (eased rank swaps, top-N fade, stable colors) render in `FinanceDemo` at about 0.06 s/frame.
4. **Text and layout scenes**: `kinetic-text`, `compare`, `quote`, scene transitions. **Done (Plan 4)**, together with narration-paced line drawing; see Plan 4 decisions.
5. **History scenes**: `timeline`, `map`. **Done (Plan 5)**; see Plan 5 decisions.
6. **Audio finish**: captions, music ducking, loudness. **Done (Plan 3)**: word-by-word captions in a fixed lane (charts shrank to make room), narration from Edge TTS with a deterministic offline stand-in, a ducked music bed, two-pass loudness to -14 LUFS, and `npm run produce` end to end.
7. **Skill**, then first real 60s videos: one finance, one investing, one history. **Done (Plan 6)**: `/make-explainer`, with three rehearsal videos (`videos/us-inflation`, `videos/rule-of-72`, `videos/roman-republic`) awaiting human review.

## 9. Project structure

Organized by feature; files under 800 lines.

```
src/design/      tokens, motion primitives
src/scenes/      one folder per template
src/schema/      storyboard + facts contracts
src/pipeline/    voice, captions, ffmpeg steps
.claude/skills/  Claude Code skill (make-explainer)
videos/          per-video facts and storyboards
docs/superpowers/specs/
```

## 10. Testing (TDD, 80% coverage on non-visual logic)

- Schema tests on valid and invalid storyboards.
- Timing tests: `atWord` resolves correctly against fixture word timings.
- Still-frame snapshot per scene template at key frames (style regressions fail the build).
- Golden end-to-end render of a hand-written storyboard: assert duration, resolution, audio presence, loudness.

## 11. Risks

| Risk | Mitigation |
|---|---|
| Edge TTS merges number phrases into one word event | Splitting normalizer (Plan 2); fallbacks: spoken-form pre-normalization, whisper.cpp alignment |
| Render time on Intel CPU | Measured: ~0.1 s/frame, so a 60s video renders in ~3 min plus ~50 s encode. Acceptable |
| Remotion's bundled ffmpeg crashes on macOS 12 | Render JPEG image sequences (`--sequence` / `renderFrames`) and encode with system ffmpeg (`src/pipeline/encode.ts`). Moving to macOS 13+ would remove the need |
| LLM storyboards look repetitive | Curated examples; variety check in schema |
| Wrong numbers in finance content | `facts.json` traceability; human review gate |
| Remotion license | Free for individuals and small teams; re-check terms before commercial scale-up; Revideo as fallback |
