# Viral & trending (T-series)

Justin, 2026-10-17: "adding shorter posts focusing on current and viral topics that align with our channel will drive followers and views of our other videos ... they don't need to be over 62s. The branding & creative should be familiar to our channel though." The main No. 00X series is unchanged.

- **What qualifies.** A story in this week's news (prices, markets, a law, a crisis) with a true, sourced origin story behind it. The news gives the hook; the history is the payoff. Education only, never advice or predictions.
- **Numbering.** T-01, T-02 and so on, shown as "No. T-01" in the corner tag. In a storyboard, `meta.doorNo` is 900 + the T number (T-01 is 901), so trending videos never collide with main doors and every door-keyed rule (backdrops, the script score) applies (`src/devices/label.ts`). Series: "On the Row Today".
- **Length.** 20 to 60 s (`TRENDING_VIDEO_MS` in `src/schema/validate.ts`); the 62 s floor does not apply. Aim for 30 to 45 s.
- **Everything else is the main pipeline.** Fast format, bleed open, word captions, wipes, backdrops, reveal ending with a comment question, sourced facts with a primary source, the script score of at least 70 before the build, and Justin's approval before posting.
- **Files.** `videos/t-XXX-<slug>/`. Renders go to the shared `lombard-row/trending/t-XXX/` (set `LOMBARD_RENDERS_DIR` to the shared `trending` folder).
- **Platform: TikTok only, no music (Justin, 2026-10-17: "we wont need any of these with music. for tiktok only").** Storyboards set `audio.music` to null; the voice and sound effects are the whole mix, and Justin adds a TikTok sound in the app.
- **Freshness.** Use the newest figure a primary source publishes (for example the EIA's weekly data), and state its date in the narration or label.
