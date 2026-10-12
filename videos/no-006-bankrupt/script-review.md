# Script review: No. 6 Why 'bankrupt' means 'broken bench'

**Score: 66/100**: A true, dark story with a real twist, but the hook says "hang" late and then goes soft, "The real record is darker" is followed by a line that isn't darker, and the best fact in the file ("almost as an afterthought") is left out. Close to buildable, not there yet.

Word count now: 195 written words. Word count after all three fixes: 195 (fix 1: 0, fix 2: -2, fix 3: +2). The 62 to 70 s timing does not change.

## The three fixes that would raise the score most

1. **Say "hang" by about 2 s, make the spoken line match the on-screen hook, and replace the weak second sentence. About +4** (Hook +3, Ending +1). Change: 0 words.
   - `hook`, as written: "In 18th-century England, a bankrupt who hid his money could hang. Even the word bankrupt sounds violent."
   - Rewrite (17 words): "A bankrupt who hid his money could hang, in 18th-century England. Even the word hides a break."
   - Why: "hang" moves from word 11 to word 8, and the date no longer comes before the stakes. The spoken words now match `meta.hookLine` ("A bankrupt who hid money could hang."), so a viewer with the sound off reads the same claim they would hear. "Sounds violent" is an opinion many viewers won't share. "Hides a break" is a fact (f-banca-rotta: rotta comes from Latin rumpere, "to break") and opens a second question for `italian` to answer. The open now loops cleanly: "...Which would keep you honest?" leads straight into "A bankrupt who hid his money could hang".
   - Shots: rename the `hook` shot at `atWord` "violent" to "break". For the visual loop, change the last `fresh-start` shot (at "So") from `bankers-1340` to `tyburn-1747` at x 0.62, y 0.4, w 0.3, the cover framing, so the last frame matches the first.

2. **Make "darker" true: jail in 1542, then death in 1706. About +3** (Story +2, Picture plan +1). Change: -2 words.
   - `law-1542`, as written: "The real record is darker. In 1542, England passed what's considered its first bankruptcy law."
   - Rewrite (19 words): "The real record is darker. In 1542, England passed what's considered its first bankruptcy law. Debtors could be jailed."
   - `law-1706`, as written: "It got worse. In 1706, hiding your assets from creditors became a crime punishable by death. And that law hid one more idea."
   - Rewrite (17 words): "In 1706, hiding assets from creditors became punishable by death. And that law hid one more idea."
   - Why: As written, "darker" leads to a line that only says a law was passed, which is about 5 s with nothing dark in it. Going from jail to death builds the threat without needing the stock line "It got worse". Sources: f-1542 ("debtors could be punished by imprisonment"; the hedge "what's considered" is kept) and f-1706-capital. Remove "It got worse." from `law-1706.microhooks`.
   - Pictures: add a cue `{atWord: "jailed", do: "emphasize", text: "Jailed"}` and move the `rake-fleet` shot (the debtors' prison) from "law" to "jailed". The prison picture then lands on the word that names it, instead of on "law" over a 1735 print.

3. **Pay off the "one more idea" loop with the source's own twist. About +3** (Payoff +2, Story +1). Change: +2 words (+3 in `fresh-start`, -1 in `four`).
   - `fresh-start`, as written: "That other idea? The same law brought in the discharge of debt, a reward for cooperating. The rope failed. The discharge lasted. So: the rope, or a fresh start. Which would keep you honest?"
   - Rewrite (37 words): "That other idea? Almost an afterthought: the same law brought in the discharge of debt, a reward for cooperating. The rope failed. The discharge lasted. So: the rope, or a fresh start. Which would keep you honest?"
   - `four`, as written: "And he wasn't the last." Rewrite: "He wasn't the last." (-1 word.)
   - Why: The line a viewer would repeat to a friend is that the law that brought in hanging for bankrupts also brought in debt discharge, almost as an afterthought. f-discharge says exactly that ("almost as an afterthought, it also introduced discharge of debt"). As written, the reveal gives the fact but drops the irony.

## Scores

| Criterion | Score | Why (cite scene ids and quote lines) |
|---|---|---|
| Hook | 17/25 | `hook` "a bankrupt who hid his money could hang" is concrete and true, it has stakes, and it opens a "who hanged?" question that isn't answered until `hanged` at about 45 s. But it opens with a date ("In 18th-century England,"), so "hang" doesn't arrive until about 3.5 s. The stakes stay historical rather than personal. "Even the word bankrupt sounds violent" is subjective and lets the noose thread drop just as it starts. |
| Story and curiosity | 12/20 | There are microhooks about every 5 to 8 s ("But here's the catch:", "The real record is darker.", "And that law hid one more idea."), and "hid one more idea" is a well-planted loop. Dates run forward: 1542, 1706, 1760, 1761, 1820, then back to 1706, which "the same law" flags. Weak spots: the hanging thread goes quiet from about 4 s to about 26 s, across `italian`, `myth` and `law-1542`. `myth` ends on the anticlimax "probably a figure of speech". `law-1542` doesn't pay off "darker". `four` "And he wasn't the last" leads the viewer to expect many hangings, then "Likely only 4" says few, so the microhook works against its own fact. |
| Payoff and shareability | 10/15 | `trunk` "halves of four banknotes ... tied in a rag. Plus half a 1,000 pound note." is the strongest image and very repeatable. The hanging promise is paid off in `hanged`. But the title's promise ("broken bench") is given away in the first 6 s and then deflated by "probably a figure of speech". The final twist, discharge, is stated without the source's irony ("almost as an afterthought"), so it lands as information rather than as a surprise. |
| Clarity | 10/15 | One idea per scene, and it's always clear who "he" and "it" are. Problems: `trunk` "halves of four banknotes" drops f-half-notes' "the other halves", so viewers can't tell these match halves found somewhere else. Restoring "other" costs one word and is worth doing if the TTS timing allows. `hanged` "fraudulent bankruptcy" is a new term the viewer heard earlier only as "hiding your assets". `fresh-start` "discharge of debt" is jargon, and "a reward for cooperating" only partly explains it. "13,513 pounds" takes seven words to say, though the big-number card helps. |
| Picture plan | 10/15 | Cuts come every 2 to 3 s throughout. Defects: in `four`, the "Englishmen" zoom on the Tyburn crowd sits under the label "bankrupts likely hanged". That puts a group caption over unrelated people, since `assets.json` says the print shows neither Perrott nor a bankrupt. Move that shot to the gallows or keep it wide. `four` puts "Abolished, 1820" over the Fleet debtors' prison (`rake-fleet`), a picture with nothing to do with abolition. `trunk` lays "in his trunk" over Newgate burning in the 1780 Gordon Riots, so the viewer sees a fire the words never mention. `law-1542` shows a 1735 Hogarth arrest under "1542" with no title to date it. `tyburn-1747` appears in 5 of 11 scenes. Check that the `hook` title "Hogarth, a London hanging, 1747" doesn't stay on screen over the `bankers-1340` and `boe-note` shots, and likewise for the `trunk` title over `boe-note`. |
| Ending and comments | 7/10 | It ends on the reveal, and "The rope, or a fresh start. Which would keep you honest?" is a personal, binary question that is easy to answer in a comment, with no financial advice in it. Weak spots: "The rope failed. The discharge lasted." leans towards an answer just before the question is asked. The last shot (`bankers-1340` at "So") doesn't match the first frame (`tyburn-1747`), so the visual loop breaks. |
| **Total** | **66/100** | |

## What works
- `hook`: a true, shocking claim backed by f-1706-capital, and the on-screen hook line is short and readable.
- `law-1706` kinetic lines "Hide it. / Hang for it." read perfectly with the sound off.
- `trunk` "tied in a rag" and "half a 1,000 pound note" are specific and strange, the detail people repeat.
- Hedges are kept throughout: "what's considered its first bankruptcy law" (f-1542), "probably a figure of speech" (f-bench-myth, a disputed fact) and "Likely only 4" (f-four-hanged).
- Titles are honest about illustrative art ("Hogarth, a London hanging, 1747" under `hanged`), so the Tyburn print isn't passed off as Smithfield.
- The closing question is personal and open, and it isn't financial advice.

## Accuracy flags
- `short` cue callout "Unaccounted for": f-deficiency says only that there was "a deficiency of the sum of 13,513 pounds". "Unaccounted for" implies money was missing or taken, which is stronger than the source. Use "Deficiency" or "Short", which also matches the narration.
- `fresh-start` "The rope failed": f-discharge says "coercing the debtor to be honest proved a failure". The coercion was the capital penalty, so this paraphrase is acceptable. No change needed.
- `plan.json` angle says the discharge is "the fresh start bankruptcy still means today". That is not in `facts.json`. The script rightly doesn't say it, and any "today" line would need a source.
- Every rewrite above was checked against f-banca-rotta, f-1542, f-1706-capital, f-discharge and f-four-hanged. No other line goes beyond its fact.

## Trends checked
- State what the viewer will learn, make the first frame or readable text match the topic so it works with the sound off, and use true stakes the video pays off. Revealing the conclusion early is fine if the video then explains how or why. The page says there is "no platform-wide three-second retention target". (Faceless Shorts hooks and retention 2026, ShortsFast, published 29 Jun 2026, updated 3 Oct 2026, https://shortsfast.com/blog/faceless-shorts-hooks-retention-2026/)
- The page estimates that 30 to 50% of viewers leave in the first 0 to 3 s, and another 15 to 25% leave between 3 and 10 s if the hook doesn't lead to a payoff. It recommends a visual change every 1.5 to 2 s and matching the last frame to the first so the video loops. (YouTube Shorts retention curve playbook, Aibrify, 22 Apr 2026, https://aibrify.com/blog/youtube-shorts-retention-curve-playbook)
- Use 3 to 4 open loops under 60 s, close the main hook loop in the final 20% of the video, and avoid repeating stock re-hooks ("It got worse"-style lines) that train viewers to ignore them. This source is about seven months old, just outside the six-month window. (Open loops in content 2026, Socialync, 4 Mar 2026, https://www.socialync.io/blog/open-loops-in-content-2026)
