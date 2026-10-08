# Lombard Row

Video pipeline for Lombard Row, a faceless channel of 65 to 70 second animated finance-history explainers ("How money works, and how it got that way"). Remotion renders, Edge TTS narrates, ffmpeg finishes the audio, and Claude Code does the research and writing.

The engine is ported from [motionexplainers](https://github.com/C4KEBX/motionexplainers) at commit `4a48273`. Its technical handoff is in `docs/engine/HANDOFF.md`, with the original spec, plans and spike measurements beside it. Phase 1 of the Lombard Row build replaced the bold-flat look with the brand theme: Ledger Ink, Parchment and Banker's Green grounds (`meta.paletteLead`, or `ground` per scene), Brass as the single accent, Libre Caslon Text and Inter bundled in `public/fonts` (SIL OFL), and the content area and caption box from `src/brand/devices.json` (spec in `docs/brand/DEVICES.md`). Renders use every core but one; set `RENDER_CONCURRENCY` (a count or a percentage) to change that. Phase 2 added the signature devices from `docs/brand/DEVICES.md` (`src/devices/`): the ledger-line open, the year counter (`year` per scene), the source stamp (from each fact's `source.stamp`) and the door-plate close with its spoken sign-off. A render fails if any of them would enter a platform zone, and the length gate is now 65 to 70 s. `fixtures/no-004/` is the reference video. The rest of this README still describes the ported engine until later phases update it.

## One-time setup

- Node 20+ and `npm install`
- Python 3 and `npm run setup:tts` (Edge TTS in `tts/.venv`)
- System `ffmpeg` (Remotion's bundled one does not run on macOS 12)
- Where Remotion cannot download its browser, set `REMOTION_BROWSER_EXECUTABLE` to a local Chromium headless shell

## Make a video

In Claude Code, from this folder:

```
/make-explainer <topic>
```

The skill (`.claude/skills/make-explainer/`) researches sources, writes `videos/<slug>/facts.json` and `storyboard.json`, checks them, builds a review sheet, and then stops. Open `videos/<slug>/review/review.html`, approve or ask for edits, and it renders `out/<slug>/final.mp4`.

## Manual commands

| Command | What it does |
|---|---|
| `npm run check -- --storyboard S --facts F [--plan P]` | Reports every validation issue, estimated length and advice-phrasing warnings |
| `npm run verify-facts -- --facts F [--out V] [--no-archive]` | Advisory: do a fact's numbers appear on its source page; quotes the sentence and snapshots the page on the Wayback Machine |
| `npm run sheet -- --storyboard S --facts F --out DIR [--verify V]` | Self-contained `review.html` with a still per scene |
| `npm run variation -- suggest` / `check --plan P [--storyboard S]` / `record ...` | Variation kit: allowed options for the next video, plan checks against recent videos, history after publishing (see `variation/VARIATION.md`) |
| `npm run voice -- --storyboard S --facts F` | Voices every scene and the sign-off, prints per-scene and total length, fails outside 65-70 s |
| `npm run produce -- --storyboard S --facts F --out DIR` | Voice, render, mix, loudness-normalize to -14 LUFS |
| `npm run catalog` | Regenerate the storyboard JSON Schema the skill reads |
| `npm test`, `npm run test:cov`, `npm run test:render` | Unit tests, coverage, render snapshot tests (serial) |
| `npm run studio` | Remotion Studio |

## Layout

- `videos/<slug>/`: facts, storyboard, verify results, review sheet (per video)
- `out/<slug>/`: renders (git-ignored)
- `fixtures/`: demo storyboards and facts used by tests
- `src/`: design tokens, scenes, charts, map, schema, voice, audio, skill tooling
- `docs/engine/`: engine handoff, spec and plans (`superpowers/`), spike measurements (`SPIKE-RESULTS.md`)
- `fixtures/calibration/`: the three motionexplainers rehearsal storyboards, kept to calibrate the length estimator

## Guarantees and limits

- Chart, race, timeline, map, big-number and compare data must equal a sourced fact. Titles, labels, callout text and the numbers you hear in narration (also shown as captions) are not traced: the review sheet flags digits in on-screen text, and spoken figures are for the human reviewer to check.
- A human approves the review sheet before the final render.
- `verify-facts` blocks private and local addresses (literal and resolved per hop) but does not pin the resolved address, so a hostile DNS server could still rebind between lookup and fetch; it only sends GET requests. Edge TTS needs internet. Map borders are modern and approximate. Videos are educational and historical, never advice.
- Fact checking is advisory; the quality of the writing, the voice and the pacing are for a human to judge.
