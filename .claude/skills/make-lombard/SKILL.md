---
name: make-lombard
description: Use when the user asks to make, script or produce a Lombard Row video, a 55-70 second vertical animated finance-history explainer video, in this repo ("make No. 002", "make a video about X", "/make-lombard <door no or topic>"). Plans against recent videos, researches sourced facts, writes a validated storyboard, stops at the fact-check gate, renders, builds the publish package and stops at the QA gate.
---

# Make a Lombard Row video

Turn a door number or topic into a finished 1080x1920 video and its publish package with this repo's pipeline. It costs nothing: you do the research, writing and repair; the scripts check and render. Work from the repo root. Read `.claude/skills/make-lombard/rules.md` before writing a storyboard.

## Hard rules

- Every number, date, name and quote on screen or in the narration comes from a fact in `facts.json` whose source you actually opened with WebFetch. Never type a figure from memory. If you cannot source a claim, cut it. Narration states only what a page you opened says; do not pad with background claims you did not read.
- Never edit `src/`, `tests/`, the validators, `variation/variation_spec.json` or this skill to make a storyboard or plan pass. Fix the storyboard or the facts. Never change a fact's data to match a storyboard, or the reverse, without re-reading the source.
- Two human gates. STOP at the fact-check gate (step 6) until the user approves; do not run `npm run produce` before that. STOP again at the QA gate (step 8); never upload anything yourself.
- Education and history only: no advice, no predictions, no "you should", no tickers. The narrator is a voice, never a named host or expert.
- Disputed stories are labeled as disputed in the narration, or cut. The backlog's "Check before scripting" note must be settled from a source before you write a line.

## Workflow

Everything for a video lives in `videos/<slug>/` (lowercase letters, digits, hyphens): `plan.json`, `facts.json`, `storyboard.json`, `assets.json` if it has archival images, `review/`. Renders go to `out/<slug>/`.

1. **Pick and plan.** A door number means that row of `docs/brand/BACKLOG.md`; a topic not on the backlog gets the next free door number. The human picks the topic; you never choose it for them. Run `npm run variation -- suggest`, then write `videos/<slug>/plan.json` (shape: `fixtures/no-004/plan.json`) following `variation/VARIATION.md`, and run `npm run variation -- check --plan videos/<slug>/plan.json` until it passes. Do not research or script before it passes. Default voice `en-GB-RyanNeural`. For `musicBed` pick the bed from `npm run audio -- list` whose mood fits the story shape (the variation check keeps it out of the last 3 videos) and use the same id for the storyboard's `audio.music`; sound effects are automatic; `meta.series` is the pillar's series name from the spec.
2. **Research.** WebSearch, then WebFetch primary and scholarly sources (Federal Reserve, SEC, Treasury, BLS, original laws and documents; university press books, peer-reviewed journals, dictionaries of record). Wikipedia is secondary: use it to find sources, and corroborate anything taken from it. Settle the backlog's check note first. Copy numbers from the page. Write 5 to 8 facts: `id`, `claim` (a full sentence with units and period, as the source states it), `value` or `dataset`, and `source` with name, url, `stamp` and `tier`, plus `corroboration` and `disputed` where they apply (rules.md: at least 3 sites, 1 primary or scholarly). Never leave "demo data" wording in a claim.
3. **Verify.** `npm run verify-facts -- --facts videos/<slug>/facts.json --out videos/<slug>/verify.json`. For every `not-found`, `partial` or `unreachable`: reopen the source, fix or drop the fact. The tool is advisory; you own accuracy. It quotes the sentence where each number was found and saves a Wayback Machine snapshot. Small whole numbers (under 100) never count as support: read the source line yourself. After any edit to `facts.json`, run it again.
4. **Script and storyboard.** About 165 to 180 words of narration (the whole video runs 55 to 70 s with the door-plate close, which the pipeline adds; No. 001's 155 words ran 54.9 s), 6 to 10 scenes, the plan's hook in the first sentence, one idea per scene, scene types varied (never three alike in a row), a scene for the plan's primary visual. Use `storyboard.schema.json` for fields and limits and copy the shape of `fixtures/no-004/rule-of-72.storyboard.json` (the reference video), `fixtures/finance.storyboard.json`, `fixtures/history.storyboard.json`, `fixtures/ancient.storyboard.json` and `fixtures/ledger.storyboard.json` (archival, flow-diagram, ledger-page). Give each scene `speaks` for the facts behind the figures it says aloud.
   For an archival scene, find a public-domain or CC0 image (Wikimedia Commons, Library of Congress, The Met open access), list it in `videos/<slug>/assets.json` with its license page and credit (rules.md, archival), and run `npm run assets -- --assets videos/<slug>/assets.json`. Never use an image whose license you have not read on its own page.
5. **Check and measure.** `npm run check -- --storyboard videos/<slug>/storyboard.json --facts videos/<slug>/facts.json --plan videos/<slug>/plan.json`. Fix every issue (each message names the scene and the fix) and re-run, at most 6 rounds; if something still blocks, report exactly what. Treat warnings as things to fix or justify.
   Then measure the real length: `npm run voice -- --storyboard videos/<slug>/storyboard.json --facts videos/<slug>/facts.json`. It fails outside 55 to 70 s. Trim or add narration and re-run until it passes.
6. **Gate 1, fact-check.** `npm run sheet -- --storyboard videos/<slug>/storyboard.json --facts videos/<slug>/facts.json --verify videos/<slug>/verify.json --out videos/<slug>/review`. It writes `review.html` (a still per scene, facts, warnings) and `script.md`, the script document with every spoken sentence's source beside it. Tell the user to check every claim in `script.md` against its source, apply the voice rules and strike anything that reads as advice. Summarize the claim, scene list, word count, the measured length, each fact with its source check, every sentence marked "none named", and every warning. STOP and wait for approval or edits.
7. **Produce and package.** After approval: `npm run produce -- --storyboard videos/<slug>/storyboard.json --facts videos/<slug>/facts.json --out out/<slug>`. If it rejects the length or a scene is too short, change the narration, re-run `check`, produce again (voice audio is cached by text). Then `npm run listen-back -- --storyboard videos/<slug>/storyboard.json --out out/<slug>` (whisper.cpp transcribes the video and lists words and numbers that differ from the script and captions out of sync; `npm run setup:whisper` once), and `npm run publish-kit -- --storyboard videos/<slug>/storyboard.json --facts videos/<slug>/facts.json --plan videos/<slug>/plan.json --out out/<slug>`. That runs the final variation check with the real length and writes `out/<slug>/publish/`: per-platform titles and captions with the sources and the standard footer, thumbnails, the AI-disclosure call and `checklist.md`.
8. **Gate 2, QA.** Tell the user to watch `out/<slug>/final.mp4` once, with sound, against `review/script.md`, using `out/<slug>/listen-back.md` and `out/<slug>/publish/checklist.md`. A failure goes back to step 4, the script, not to a re-render of the same script. STOP.
9. **After publishing** (the user says it is live): `npm run variation -- record --plan videos/<slug>/plan.json --storyboard videos/<slug>/storyboard.json --duration <seconds>`, or the variation rules have nothing to compare against.

## When something goes wrong

- **A check message you do not understand:** it names a scene id; open that scene in `rules.md` for its limits. Do not guess the fix.
- **The fact and the scene disagree:** reopen the source. Correct whichever is wrong from the source, never by copying one onto the other.
- **A map region is not found:** use the atlas spelling the message suggests ("United States of America"); regions must overlap the `focus` box.
- **Voice problems (network):** `npm run voice` and `npm run produce` need internet for Edge TTS; `--voice standin` gives placeholder audio and a rough length for a dry run only.
- **The voice misreads a word or name:** add it to `src/voice/pronunciations.ts` (written token to spoken form); captions keep the written form.
- **Listen-back flags a word:** listen to that moment. Speech recognition errs too; a real misreading is fixed in `pronunciations.ts` or the script.
- **Setup missing:** run `npm install`, `npm run setup:tts` and `npm run setup:whisper` once.

## Output to the user

Keep it short: the file paths, what the video claims, length, loudness, the facts and sources used, what listen-back flagged, and any warning you accepted and why.
