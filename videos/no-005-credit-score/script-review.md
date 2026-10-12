# Script review: No. 005 Before credit scores, there was gossip

**Score: 63/100**: Strong archive material and a good closing question, but the spoken open starts on its hedge, not its claim, and it mixes up which company "started with your neighbors". Fix the open and the Tappan pictures before building.

## The three fixes that would raise the score most

1. **Lead with the claim, and keep the two companies apart in the open. About +6 points.** Scene `hook`. As written: "Critics said the company behind your credit report once filed rumors about people's marriages. It's called Equifax. And it all started with your neighbors." For the first ~3 s the viewer hears "Critics said the company behind…", a hedge and a vague subject, while the screen says something else ("Your credit report started as gossip."). "It all started with your neighbors" also tells the viewer that Equifax began with Tappan's neighbor-reporters. It didn't: Tappan's agency became R.G. Dun, and Equifax came from Retail Credit in 1899. And "the company behind your credit report" suggests there is only one bureau. Rewrite (27 words, +3):
   > "Your credit report started as gossip. Critics said the firm that became Equifax kept rumors on people's marriage troubles. But the gossip began decades earlier, with your neighbors."

   This speaks the on-screen hook line in the first 2 s, keeps the "Critics said" hedge (f-rumors), stays close to the source's "marital troubles", and names the firm "that became Equifax" (f-retail). It also makes the loop work: "…a number or your neighbors?" now runs straight into "Your credit report started as gossip."

2. **Make the lineage clear in `tappan` and `retail`, and use the founder's best detail. About +4 points.**
   - `retail` as written: "Then it came for shoppers." Here "it" can only mean Tappan's Mercantile Agency, which is wrong. Rewrite: "Then a new firm came for shoppers." (+2 words.)
   - `tappan` as written: "In 1841, Lewis Tappan, a merchant ruined in the panic of 1837, founded the Mercantile Agency." Rewrite: "In 1841, Lewis Tappan, an abolitionist merchant who failed in the panic of 1837, founded the Mercantile Agency." (+2 words.) "Abolitionist" is in f-tappan, and it is the script's best unused "I didn't know that": an anti-slavery campaigner built the first credit-rating network. "Failed" matches the source's wording more closely than "ruined".

   The script stays at about 187 words, inside the 180 to 200 budget.

3. **Remove the pictures that mislabel the words. About +4 points.**
   - `tappan`: the scene opens on `speculator-1852` (assets.json: "not Lewis Tappan") while the narrator says "In 1841, Lewis…". It cuts to the real portrait at "Tappan" and then back to the speculator at "ruined" and "founded". Viewers will take the frock-coated speculator for Tappan. Open on `correspondents-page` or `tappan-1873`, and stay on `tappan-1873` through "ruined". Then move to `correspondents-page` at "founded", so the picture shows the agency, not a stand-in man.
   - `rumors`: "in the 1970s, the government accused Retail Credit…" plays over four 1850s genre paintings. The picture contradicts the decade the words just named. Use `office-1987` (late-century office) or `capitol`, kept on screen from the `law` scene, at least for "the government accused".
   - `hook`: "Equifax" lands on `country-store` (1885, "not the Retail Credit Company"), which shows the company name over a shop that isn't it. With fix 1, move the cut to "Equifax" in "firm that became Equifax" and land it on `new-bonnet` (shoppers' private lives) instead.

## Scores

| Criterion | Score | Why (cite scene ids and quote lines) |
|---|---|---|
| Hook | 15/25 | The stakes are real and personal ("your credit report", "rumors about people's marriages"). But the spoken open starts "Critics said the company behind…", so the concrete claim arrives after about 3 s. The on-screen hookLine "Your credit report started as gossip." is never spoken. "It all started with your neighbors" ties Equifax to the wrong origin. |
| Story and curiosity | 13/20 | Dates run forward: 1841, 1855, (1880), 1899, 1970, 1970s, 1989. `law` is a dead stretch: "In 1970, Congress passed a credit reporting law." is 8 words with no consequence, and none can be added without a source. Most microhooks are just each scene's first line ("Every name got a grade", "Then in 1989 came FICO") rather than reopened questions. `ratings` never says "1880", even though its title does. |
| Payoff and shareability | 9/15 | There are repeatable details: "a rough and ready Irishman", "rating its staff by how much negative information they found". But Equifax is named at about 5 s, so "That company became Equifax." in `retail` lands as a repeat, not a reveal. The abolitionist founder (f-tappan) is left out. |
| Clarity | 10/15 | `quotes`: "calls a man without a $ in the world" puts a bare "$" in narration and in the one-word captions. The TTS may read it oddly, and "calls a man without" parses badly. Write "a dollar" in the narration and keep "$" only in the on-screen line. `retail`: "Then it came for shoppers" has an unclear "it". `ratings`: "from A plus, $1,000,000 or more, down to K: less than $2,000" packs two grades and two sums into about 6 s, which is hard to take in by ear. |
| Picture plan | 9/15 | The cadence is good: roughly a new shot every 1.7 to 2.5 s in every scene. But the speculator stands in as Tappan in `tappan`, 1850s paintings run under the 1970s accusation in `rumors`, and "Equifax" lands on an 1885 store in `hook`. In `today`, "racial" lands on `census-1854`, a white family, which reads oddly against the word. |
| Ending and comments | 7/10 | "So which would you trust: a number or your neighbors?" is a clean two-way question people will answer. The last shot (`census-1854` at 0.47/0.42/0.42) matches the hook's "neighbors" crop, which is a good visual rhyme. But the words don't loop: "…your neighbors?" leads into "Critics said the company…", not into the hook line. |

## What works
- The forward timeline, from Tappan to ledgers to grades to Retail Credit to the law to FICO, is easy to follow, and each scene carries one main idea.
- The primary-source quotes in `quotes` ("without a $ in the world", "a rough and ready Irishman") are vivid and set up the bias payoff in `today`.
- The hedges are kept where the sources need them: "Critics said" in `hook`, "the government accused" in `rumors`, "Even FICO says" in `today`.
- "Even FICO says…" is a strong credibility turn just before the question.
- The cover and hook line "Your credit report started as gossip." is a strong thumbnail claim.
- The length fits: 180 words, inside the 62 to 70 s band.

## Accuracy flags
- `today`: "the old reports were full of racial, class and gender biases" is stronger than f-bias, which says "many of the opinions noted racial, class and gender biases". Suggested: "Even FICO says many of those old opinions carried racial, class and gender biases." (+2 words.)
- `hook`: "the company behind your credit report" implies that Equifax is the only source of a viewer's credit report, and no fact supports that. Fix 1 removes it.
- `hook`: "It all started with your neighbors", spoken right after "It's called Equifax", implies that Equifax descends from the neighbor-correspondent system. Per f-tappan and f-retail, the Mercantile Agency became R.G. Dun, and Retail Credit, founded separately in 1899, became Equifax. Fix 1 removes this.
- `retail`: "Then it came for shoppers" implies the Mercantile Agency moved into retail; it was a different company (f-retail). Fix 2 removes this.
- `tappan`: "ruined" is a little stronger than the source's "failed" (f-tappan). This is minor; fix 2 uses "failed".
- `ratings`: "Every name got a grade" is a slight generalization of f-ratings ("rated pecuniary strength from A+ … down to K"). It is acceptable, but "Each firm got a grade" would be closer.
- `law`: anything said about what the 1970 law did would need a source. f-fcra only supports that it passed in 1970.

## Trends checked
- Hooks should give the answer or an honest preview in the first line, and the first frame has to show the topic for sound-off viewers. Stating the conclusion early is fine as long as the video then explains how. Invented stakes hurt. (ShortsFast, "Faceless Shorts hooks and retention", 29 Jun 2026, updated 3 Oct 2026, https://shortsfast.com/blog/faceless-shorts-hooks-retention-2026/)
- About 30 to 50% of viewers leave in the first 3 s, and another 15 to 25% leave between 3 and 10 s if the hook doesn't lead into a payoff. Aim for a visual change every 1.5 to 2 s, with dips past 2.5 s. A loop works when the end re-asks the opening's question or matches its first frame. These are creator benchmarks, not YouTube figures. (Aibrify, "The YouTube Shorts Retention Curve Playbook (2026)", 22 Apr 2026, https://aibrify.com/en/blog/youtube-shorts-retention-curve-playbook)
- Shorts viewers decide in 2 to 3 s. On-screen text in the hook is linked to more watch time. Since March 2025 each loop counts as a view, so circular endings that match the opening visual pay off. (Virvid, "Faceless YouTube algorithm and retention 2026", 15 Feb 2026, https://virvid.ai/blog/faceless-youtube-algorithm-retention-2026)
