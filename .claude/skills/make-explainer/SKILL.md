---
name: make-explainer
description: Use when the user asks to make, script or produce a 60-second vertical animated explainer video about finance, investing or history in this repo ("make a video about X", "/make-explainer <topic>"). Runs research, sourced facts, a validated storyboard, a human review gate and the final narrated render.
---

# Make a 60-second explainer

Turn a topic into a finished 1080x1920 video with this repo's pipeline. It costs nothing: you do the research, writing and repair; the scripts check and render. Work from the repo root. Read `.claude/skills/make-explainer/rules.md` before writing a storyboard.

## Hard rules

- Every number, date, name and quote on screen comes from a fact in `facts.json` whose source you actually opened with WebFetch. Never type a figure from memory. If you cannot source a claim, cut it. Narration states only what a page you opened says; do not pad with background claims you did not read.
- Never edit `src/`, `tests/`, the validators or this skill to make a storyboard pass. Fix the storyboard or the facts. Never change a fact's data to match a storyboard, or the reverse, without re-reading the source.
- STOP at the review gate (step 6). Do not run `npm run produce` until the user approves the review sheet.
- Finance and investing are educational and historical: no advice, no predictions, no "you should". Name the period and the source for every figure.

## Workflow

Everything for a video lives in `videos/<slug>/` (lowercase letters, digits, hyphens): `facts.json`, `storyboard.json`, `review/`.

1. **Brief.** Settle the topic, a one-sentence claim the video proves, and the audience. Ask one question only if the claim is unclear. Default voice `en-GB-RyanNeural`, music `null`. Ask for the door number (`meta.doorNo`) and the series label (`meta.series`, e.g. "How it works") if the user has not given them.
2. **Research.** WebSearch, then WebFetch primary and scholarly sources (BLS, Federal Reserve, SEC, original documents; university press books and peer-reviewed journals for history). Wikipedia is secondary: use it to find sources, and corroborate anything taken from it. Copy numbers from the page. Write 5 to 8 facts: `id`, `claim` (a full sentence with units and period, as the source states it), `value` for one number or `dataset` for the exact data a chart or list will show, and `source` with name, url and `tier` (see rules.md: at least 3 sites, 1 primary or scholarly). Never leave "demo data" wording in a claim.
3. **Verify.** `npm run verify-facts -- --facts videos/<slug>/facts.json --out videos/<slug>/verify.json`. For every `not-found`, `partial` or `unreachable`: reopen the source, fix or drop the fact. The tool is advisory; you own accuracy. It quotes the sentence where each number was found and saves a Wayback Machine snapshot of each source (`--no-archive` skips it). Small whole numbers (under 100) are never counted as support: read the source line yourself. After you edit `facts.json` for any reason, run `verify-facts` again; the review sheet marks a stale result.
4. **Script and storyboard.** About 155 words of narration in total (145 to 165; the whole video runs 65 to 70 seconds including the 2 s open and the door-plate close with its spoken sign-off, which the pipeline adds), 6 to 10 scenes, a hook in scene 1, one idea per scene, scene types varied (never three alike in a row). Use `storyboard.schema.json` for exact fields and limits and copy the shape of `fixtures/no-004/rule-of-72.storyboard.json` (the reference Lombard Row video), `fixtures/finance.storyboard.json`, `fixtures/history.storyboard.json` and `fixtures/ancient.storyboard.json`. Give each scene `speaks` for the facts behind the figures it says aloud. Write `videos/<slug>/storyboard.json`.
5. **Check and repair.** `npm run check -- --storyboard videos/<slug>/storyboard.json --facts videos/<slug>/facts.json`. Fix every issue (each message names the scene and the fix) and re-run, at most 6 rounds; if something still blocks, report exactly what. Treat warnings (length, advice phrasing, untraced text) as things to fix or justify. The length estimate is good to about 10 percent (real words per second ranged 2.5 to 3.2), so aim for 65 to 70 s.
   Then measure the real length: `npm run voice -- --storyboard videos/<slug>/storyboard.json --facts videos/<slug>/facts.json`. It voices every scene and the sign-off (cached for `produce`), prints each scene's time and the total, and fails outside 65 to 70 s. Trim or add narration and re-run until it passes; report its total, not the estimate, at the gate.
6. **Review gate.** `npm run sheet -- --storyboard videos/<slug>/storyboard.json --facts videos/<slug>/facts.json --verify videos/<slug>/verify.json --out videos/<slug>/review`. Tell the user to open `videos/<slug>/review/review.html`. Summarize: the claim, scene list, word count and the measured length from `npm run voice`, each fact with its source check, and every warning. Ask for approval or edits. STOP and wait.
7. **Produce.** After approval: `npm run produce -- --storyboard videos/<slug>/storyboard.json --facts videos/<slug>/facts.json --out out/<slug>`. It takes about two minutes. If it rejects the length or a scene is too short, change the narration, re-run `check`, produce again (voice audio is cached by text). Report the file path, length and loudness. Say plainly what you did not judge: voice quality, pronunciation, pacing and taste. Ask the user to watch it.

## When something goes wrong

- **A check message you do not understand:** it names a scene id; open that scene in `rules.md` for its limits. Do not guess the fix.
- **The fact and the scene disagree:** reopen the source. Correct whichever is wrong from the source, never by copying one onto the other.
- **A map region is not found:** use the atlas spelling the message suggests ("United States of America"); regions must overlap the `focus` box.
- **Voice problems (network):** `npm run voice` and `npm run produce` need internet for Edge TTS; `--voice standin` gives placeholder audio and a rough length for a dry run only.
- **The voice misreads a word or name:** add it to `src/voice/pronunciations.ts` (written token to spoken form); captions keep the written form.
- **Setup missing:** run `npm install` and `npm run setup:tts` once.

## Output to the user

Keep it short: the file path, what the video claims, length, loudness, the facts and sources used, and any warning you accepted and why.
