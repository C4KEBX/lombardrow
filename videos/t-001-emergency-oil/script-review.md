# Script review: No. T-01 America's emergency oil, hidden in salt

**Score: 79/100**: Build it. The new close-up first frame reads better on a phone, but it breaks the picture loop the ending had. The same three gaps remain: the Saudi twist needs an embargo link, the last 15 s are nine pipe shots in a row, and `hormuz` restates the hook.

Length check: 130 words of narration, unchanged (hook 20, hormuz 14, left 15, embargo 17, ford 17, salt 17, today 30). That is about 46 to 50 s, inside the 20 to 60 s window and slightly past the 30 to 45 s aim. The fixes below net +1 word.

What changed since the last review (pictures only, `hook`). Frame 0 is now `spr-wellhead` (a wellhead over a storage cavern at Bryan Mound, Texas, cropped w 0.55). It is followed by `spr-pumps` at "lowest", `spr-site` at "war." and `spr-piping` at "caves".
- **Gain:** a single close object reads at phone size in the 1 to 3 s swipe decision far better than the old aerial well pad, and it is literally the top of a cave of oil.
- **Losses:** (a) `today` still ends on `spr-wellpad` at "Refill", so the last frame no longer matches the first. The loop now works in sound only. (b) "caves" now lands on `spr-piping` (cavern piping on a well pad), a weaker match than the wellhead had. It is not wrong, and the asset's `depicts` does say "cavern piping".
- Net: Hook +1, Ending -1, Picture plan unchanged. The total holds at 79.

## The three fixes that would raise the score most

1. **Make the Saudi twist land, about +3 points (Payoff).** Scene `salt` says "It was Saudi crude.", but scene `embargo` says only "In 1973, Arab oil producers embargoed the United States." The viewer is never told Saudi Arabia was among them, so the irony depends on outside knowledge. f-embargo's source (State Dept. Historian) names only "Arab members of OPEC" and does not list Saudi Arabia as a member of the embargo, so naming it **needs a source**. Add that fact first, then rewrite `embargo`: "In 1973, Saudi Arabia and other Arab oil producers embargoed the United States. The price of a barrel doubled, then quadrupled." (+4 words). Without the fact, leave both lines as they are. Do not spell out the irony in `salt`.

2. **Break up the run of pipe shots and restore the picture loop, about +3 points (Picture plan, Ending).**
   - From "acquired" in `salt` to the end, the viewer sees nine shots in a row from the same six photos of the Gulf Coast sites.
   - `spr-site`, `spr-wellhead`, `spr-piping` and `spr-wellpad` each appear about three times.
   - "It was Saudi crude." lands on `spr-piping`, and "Salt doesn't let oil through" lands on the wellhead again.
   - There is still no picture of a cave.
   - Two new assets, each needing a checked `depicts`: a public-domain DOE cross-section of an SPR salt cavern for `today` at "Salt" (and `hook` at "caves"), and a public-domain 1977-era tanker or first-fill photo for `salt` at "Saudi".
   - Free fix for the loop: give the `today` shot at "Refill" `"assetId": "spr-wellhead"` with the hook's frame-0 crop (x 0.5, y 0.45, w 0.55). The question then sits on the exact frame the video opens on.

3. **Make `hormuz` show why the reserve is low, about +2 points (Story, Clarity).** Scene `hormuz`, as written: "With the Strait of Hormuz in crisis, Washington has been releasing it since March." After the hook's "during a Middle East war", this adds only "since March", and "it" has to reach back across the hook to mean the oil. Rewrite: "With Hormuz in crisis, Washington began releasing 172 million barrels in March." (12 words, -2). This gives the cause of the drop that `left` reports, with no pronoun. Fact check: f-release has the 11 March 2026 announcement of a 172 million barrel release tied to the Strait of Hormuz crisis. Fox Business (corroboration) says "authorized releasing up to 172 million". "Began releasing" claims only a start. The scene title keeps "The Strait of Hormuz" on screen. Cut "even" in `left` to hold the length.

## Scores

| Criterion | Score | Why (cite scene ids and quote lines) |
|---|---|---|
| Hook | 21/25 | `hook`: "America's emergency oil just hit its lowest since 1982, during a Middle East war. And it's kept in caves of salt." It is concrete and current, has stakes, and opens a mystery within about 3 s. It now opens on a legible close-up of the real thing (`spr-wellhead`). It loses points because the stakes are national, not personal, and the on-screen line "Emergency oil: lowest since 1982" doesn't say whose oil ("US emergency oil: lowest since 1982" reads with the sound off). The cover (`gas-empty`, 1973) never appears in the video. |
| Story and curiosity | 16/20 | Microhooks fall about every 5 to 7 s, and the hinge in `left` "So why does it even exist?" is strong. The dates run forward (1973, 1975, 1977, today), and `salt` ends on a turn ("It was Saudi crude."). `hormuz` is the soft spot (fix 3). |
| Payoff and shareability | 11/15 | `today` pays off both promises from the open: "Salt doesn't let oil through" and "the reserve holds under a third of Ford's billion". "It was Saudi crude." is the most repeatable line in the video, but it only half lands without the embargo link (fix 1). |
| Clarity | 13/15 | Pronouns are clear apart from "releasing it" in `hormuz` (fix 3). The numbers are heard cleanly. Five dates in about 48 s is a heavy load. |
| Picture plan | 10/15 | No title mislabels a picture: SPR frames sit under "The Strategic Petroleum Reserve", and `embargo` is labelled "Oregon, 1973 to 1974". `ford-1975` under "signed a law" is an exact match, and the new frame 0 is a strong opener. Defects: the run of nine pipe shots, no cave picture, no picture for "Saudi", and "caves" now lands on piping rather than the wellhead (fix 2). |
| Ending and comments | 8/10 | "Refill it, or let it run down?" ends on the reveal. It is two-sided, on topic, not financial advice, and loops in sound back to "America's emergency oil...". The picture loop is now broken: it ends on `spr-wellpad` and opens on `spr-wellhead`. Fix 2 restores it for free. Moderate the comments for political pile-ons. |
| **Total** | **79/100** | |

## What works
- The open has a fresh, primary-sourced peg (EIA, week ending 9 Oct, released 15 Oct 2026), a stake ("during a Middle East war"), a mystery ("caves of salt") and now a close-up that reads at phone size.
- Both promises from the open are paid off, and "Ford's billion" calls back cleanly to the kinetic "Up to / a billion / barrels".
- "It was Saudi crude." is a genuine turn, word for word from f-first-oil.
- No picture contradicts or mislabels its words.
- Every narrated claim maps to a fact id in `speaks`, and the hedges are intact ("up to a billion", "about 283 million", "under a third").
- `audio.music: null` is intentional (a TikTok sound is added on the platform).

## Accuracy flags
- None in the current narration (unchanged since the last review).
- `hook` "during a Middle East war": supported by f-release, and the coordinator confirms the war is ongoing as of 16 Oct 2026 news.
- `today` "under a third of Ford's billion": accurate (28 percent of the up-to-one-billion goal). It is about 40 percent of actual capacity (Rigzone corroboration, 714 million), so never caption it "a third full".
- Fix 1 (Saudi Arabia in the embargo) needs a source: f-embargo's State Dept. page does not name Saudi Arabia as a member of the embargo.
- "Oil over $100" from the brief still has no fact and correctly does not appear.
- No line reads as financial advice.

## Trends checked
- "Viewed vs swiped away" is the main Shorts signal and is decided in the first 1 to 3 s. Loop replays count as views, and endings that lead back to the opening support looping. Comments are a strong signal. (AITuber, "YouTube Shorts Algorithm Explained", published 28 Feb 2026, updated 3 Oct 2026, https://aituber.app/blog/youtube-shorts-algorithm-explained/). Supports the legible close-up first frame, and restoring the matching last frame (fix 2).
- Open on a first frame that matches the topic and give the answer before the setup drags. Read retention dips section by section. (ShortsFast, "Faceless Shorts hooks and retention 2026", published 29 Jun 2026, updated 3 Oct 2026, https://shortsfast.com/blog/faceless-shorts-hooks-retention-2026/). The new frame 0 complies. The run of pipe shots is the likeliest dip.
- TikTok's 2026 "qualified retention" weighs absolute watch time as well as completion. Videos under 15 s lost reach. Conversation-style comments outweigh low-effort ones. Spoken words and on-screen text are indexed for search. (TT Calculator, "2026 TikTok Algorithm Roundup", published 17 Feb 2026, updated 9 Jul 2026, https://ttcalculator.net/blog/tiktok-algorithm-changes-2026-roundup/; it calls its figures directional creator estimates). About 48 s with a two-sided question suits TikTok-only distribution. "Strategic Petroleum Reserve" is shown in titles but never spoken.
