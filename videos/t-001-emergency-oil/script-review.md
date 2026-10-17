# Script review: No. T-01 America's emergency oil, hidden in salt

**Score: 79/100**: Build it. The hook, the payoffs and the loop all work now, and the remaining gaps are small. The best twist, "It was Saudi crude.", only lands for viewers who already know who ran the embargo. The last 15 s are nine pipe shots in a row. And `hormuz` restates the hook instead of showing why the reserve is low.

Length check: 130 words of narration (hook 20, hormuz 14, left 15, embargo 17, ford 17, salt 17, today 30). That is about 46 to 50 s spoken, inside the 20 to 60 s window and slightly past the 30 to 45 s aim. The fixes below net +1 word.

## The three fixes that would raise the score most

1. **Make the Saudi twist land, about +3 points (Payoff).** Scene `salt` says "It was Saudi crude.", but scene `embargo` says only "In 1973, Arab oil producers embargoed the United States." The script never tells the viewer that Saudi Arabia was one of them, so the irony depends on outside knowledge. f-embargo's source (State Dept. Historian) names only "Arab members of OPEC" and does not list Saudi Arabia among them; I checked the page. So naming Saudi Arabia in the embargo **needs a source**. Add a fact first, from a primary or reputable source that names Saudi Arabia among the embargoing states. Then rewrite `embargo`: "In 1973, Saudi Arabia and other Arab oil producers embargoed the United States. The price of a barrel doubled, then quadrupled." (+4 words). Without that fact, leave both lines exactly as they are. Do not make the irony explicit in `salt`.

2. **Break up the run of nine pipe shots, about +3 points (Picture plan).** From "acquired" in `salt` to the end, the viewer sees nine shots in a row of the same six Gulf Coast plant photos:
   - `spr-wellhead`, `spr-pipes`, `spr-piping`, `spr-wellpad`, `spr-pumps`, `spr-wellhead`, `spr-pipes`, `spr-wellpad`.
   - `spr-site`, `spr-wellhead` and `spr-wellpad` each appear three times in the video.
   - "It was Saudi crude." lands on `spr-piping`.
   - "Salt doesn't let oil through" lands on the same wellhead again.
   - There is still no picture of a cave in a video titled "hidden in salt".

   Source two assets (each needs an asset, with a checked `depicts`): a public-domain DOE cross-section of an SPR salt cavern for `today` at "Salt" (and `hook` at "caves"), and a public-domain 1977-era tanker or first-fill photo for `salt` at "Saudi". Tightly captioned stills would beat one more pipe rack.

3. **Make `hormuz` show why the reserve is low, about +2 points (Story, Clarity).** Scene `hormuz`, as written: "With the Strait of Hormuz in crisis, Washington has been releasing it since March." After the hook's "during a Middle East war", this adds only "since March", and "it" has to reach back across the hook to mean the oil. Rewrite: "With Hormuz in crisis, Washington began releasing 172 million barrels in March." (12 words, -2). This gives the cause of the drop that `left` reports ("about 283 million barrels were left"), with no pronoun. Fact check: f-release says DOE announced a 172 million barrel release on 11 March 2026, tied to the Strait of Hormuz crisis. Fox Business (corroboration) says "authorized releasing up to 172 million". "Began releasing" claims a start, not a finished release, so it fits the source. The scene title "The Strait of Hormuz" carries the full name on screen. To keep the length, also cut "even" in `left` ("So why does it exist?").

## Scores

| Criterion | Score | Why (cite scene ids and quote lines) |
|---|---|---|
| Hook | 20/25 | `hook`: "America's emergency oil just hit its lowest since 1982, during a Middle East war. And it's kept in caves of salt." It is concrete, current and has stakes, and it opens a real mystery within about 3 s on a present-day frame (`spr-wellpad`). It loses points because the stakes are national, not personal. Also the on-screen line "Emergency oil: lowest since 1982" doesn't say whose oil. "US emergency oil: lowest since 1982" would read with the sound off. The cover is still the 1973 `gas-empty` pump, which never appears in the video. That works as a feed thumbnail, but it is a small promise the video doesn't show. |
| Story and curiosity | 16/20 | Microhooks fall about every 5 to 7 s, the hinge in `left` "So why does it even exist?" is strong, and the dates run forward (1973, 1975, 1977, today). `salt` now ends on a turn ("It was Saudi crude."). `hormuz` is the soft spot (fix 3). |
| Payoff and shareability | 11/15 | `today` pays off both promises from the open: "Salt doesn't let oil through" and "the reserve holds under a third of Ford's billion". "It was Saudi crude." is the most repeatable line in the video, but only half lands without the embargo link (fix 1). |
| Clarity | 13/15 | Every "it" now points at the reserve. The numbers are heard cleanly. Defects: the "it" in `hormuz` (fix 3), and five dates in about 48 s. |
| Picture plan | 10/15 | The pace is good and no title mislabels a picture now: `hook` stays on SPR frames under "The Strategic Petroleum Reserve", and `embargo` is correctly labelled "Oregon, 1973 to 1974". `ford-1975` under "signed a law" is an exact match. `today` ends on `spr-wellpad`, the opening frame, so the loop works in picture too. Defects: the run of nine pipe shots and repeated assets, no cave picture, and no picture for "Saudi" (fix 2). "The price of a barrel" over an odd-even rationing sign is acceptable. |
| Ending and comments | 9/10 | "Refill it, or let it run down?" ends on the reveal. It is two-sided, on topic and not financial advice, and it loops in sound and picture back to "America's emergency oil just hit its lowest since 1982" on `spr-wellpad`. Points held back only because a policy question can draw political pile-ons; moderate the comments. |
| **Total** | **79/100** | |

## What works
- The open has a fresh, primary-sourced peg (EIA, week ending 9 Oct, released 15 Oct 2026), a stake ("during a Middle East war") and a mystery ("caves of salt").
- Both promises from the open are paid off, and "Ford's billion" calls back cleanly to the kinetic "Up to / a billion / barrels".
- "It was Saudi crude." is a genuine turn, and it is word for word from f-first-oil.
- No picture contradicts or mislabels its words any more. The loop now works in both sound and picture.
- Every narrated claim maps to a fact id in `speaks`. The hedges are intact ("up to a billion", "about 283 million", "under a third").
- `audio.music: null` is noted as intentional (a TikTok sound is added on the platform).

## Accuracy flags
- None in the current narration.
- `hook` "during a Middle East war": supported by f-release, and the coordinator confirms the war is ongoing as of 16 Oct 2026 news.
- `today` "under a third of Ford's billion": accurate (28 percent of the up-to-one-billion goal). It is about 40 percent of actual capacity (Rigzone corroboration, 714 million), so never caption it as "a third full".
- Fix 1 (Saudi Arabia in the embargo) needs a source: f-embargo's State Dept. page does not name Saudi Arabia as an embargo member.
- "Oil over $100" from the brief still has no fact and correctly does not appear.
- No line reads as financial advice.

## Trends checked
- "Viewed vs swiped away" is the main Shorts signal and is decided in the first 1 to 3 s. Loop replays count as views, and endings that lead back to the opening support looping. Comments are a strong signal. (AITuber, "YouTube Shorts Algorithm Explained", published 28 Feb 2026, updated 3 Oct 2026, https://aituber.app/blog/youtube-shorts-algorithm-explained/). Supports the sound-and-picture loop now built.
- Open on a first frame that matches the topic and give the answer before the setup drags. Read retention dips section by section rather than blaming the hook. (ShortsFast, "Faceless Shorts hooks and retention 2026", published 29 Jun 2026, updated 3 Oct 2026, https://shortsfast.com/blog/faceless-shorts-hooks-retention-2026/). The first frame complies. The run of pipe shots is the likeliest dip (fix 2).
- TikTok's 2026 "qualified retention" weighs absolute watch time as well as completion. Videos under 15 s lost reach. Conversation-style comments outweigh low-effort ones. Spoken words and on-screen text are indexed for search. (TT Calculator, "2026 TikTok Algorithm Roundup", published 17 Feb 2026, updated 9 Jul 2026, https://ttcalculator.net/blog/tiktok-algorithm-changes-2026-roundup/; it calls its figures directional creator estimates). About 48 s with a two-sided question suits TikTok-only distribution. Speak and show "Strategic Petroleum Reserve" for search; it is shown in the titles, though never spoken.
