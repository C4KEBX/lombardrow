# Script review: No. 6 Why 'bankrupt' means 'broken bench'

**Score: 63/100**: The material is excellent: a hanging law, torn banknotes in a rag, and the same law creating the fresh start. But the open closes its own question, Perrott is never said to go bankrupt, and the closing question was already answered one line earlier. Not ready to build yet.

## The three fixes that would raise the score most

1. **Keep the hook's question open and make the first 15 s one thread, not three repeats. About +5** (Hook +3, Picture plan +2).
   The hook gives a strong claim and then answers its own second question straight away. "Broken bench" is then said three times in about 10 s (hook, italian, myth), while the hanging thread goes quiet until about 20 s. The hook has no "when", so viewers can't place "could hang". The pictures also fight the words: a Hogarth Fleet *prison* print (`rake-fleet`) lands on "broken" in `hook`, "broken" in `italian` and "smashed" in `myth`. A prison is not a smashed bench.
   - `hook`, as written: "In England, a bankrupt who hid his money could hang. And the word bankrupt? It means broken bench."
     Rewrite (17 words): "In 18th-century England, a bankrupt who hid his money could hang. Even the word bankrupt sounds violent."
     (The 1706 capital law ran until 1820 per f-1706-capital and f-four-hanged. "Sounds violent" is framing, not a claim, and it sets up the bench-breaking legend.)
   - `myth`, as written: "The popular story: a failed moneylender's bench was smashed. But here's the catch: the dictionary says that's probably figurative."
     Rewrite (19 words): "Legend says a failed moneylender's bench was smashed. But the dictionary says that's probably just a figure of speech."
     (This keeps the "probably" hedge from f-bench-myth. "Figure of speech" is easier to hear and to read one word at a time than "figurative".)
   - Pictures: drop `rake-fleet` from the `hook` "broken" shot, the `italian` "broken" shot and the `myth` "smashed" shot. Hold a tight `bankers-1340` crop on the counting table (the *banca*) with a kinetic split or crack on "broken" and "smashed". If you can source the plan's snapped-bench image, use it here.
   - `meta.hookLine` and `cover.line`: update to "In 18th-century England, a bankrupt who hid his money could hang."

2. **Make Perrott's story follow from one line to the next. About +5** (Story +2, Clarity +2, Picture plan +1).
   The script never says Perrott went bankrupt, so "his books came up short" and then "Newgate prison" come from nowhere. "They found" has no "they". "He wasn't even the last. Likely only 4..." sends the viewer two ways: "not even the last" suggests many, and "only 4" says few. A Tyburn print gets the caption "Smithfield" even though `assets.json` says "not Smithfield".
   - `short`, as written: "In 1760, his books came up 13,513 pounds short."
     Rewrite (13 words): "In 1760, at his bankruptcy hearing, his books came up 13,513 pounds short." (f-perrott-shop: "April 1760 bankruptcy examination".)
   - `trunk`, as written: "Then, in his trunk in Newgate prison, they found halves of banknotes tied up in a rag. Plus half a 1,000 pound note."
     Rewrite (25 words): "At the bottom of his trunk in Newgate prison, halves of four banknotes turned up, tied in a rag. Plus half a 1,000 pound note." ("Bottom of his trunk" and "four banknotes" are both in f-half-notes. They suggest the notes were hidden without the script claiming it.)
   - `four`, as written: "He wasn't even the last. Likely only 4 Englishmen were hanged for it. The penalty was abolished in 1820."
     Rewrite (18 words): "He was one of likely only four Englishmen hanged for it, before the penalty was abolished in 1820." (f-four-hanged, with "likely" kept. The Gazette corroboration in f-perrott-hanged calls Perrott "one of the few".)
   - `hanged` picture: don't zoom into the Tyburn gallows on "Smithfield". Hold the wide `tyburn-1747` shot under its honest title, and at "Smithfield" put up on-screen text "West Smithfield, 11 Nov 1761" so no Tyburn crop carries the Smithfield caption.

3. **End on a question the script hasn't already answered. About +3** (Ending +3).
   "The rope failed. The discharge lasted." answers "which kept bankrupts honest?" just before it is asked, so there is nothing left to argue about in the comments.
   - `fresh-start`, as written: "...The rope failed. The discharge lasted. So, rope or fresh start: which kept bankrupts honest?"
     Rewrite (last two sentences, 11 words): "...The rope failed. The discharge lasted. So: the rope, or a fresh start. Which would keep you honest?"
   - `meta.ending.prompt`: "The rope or a fresh start: which would keep you honest?" (`atWord` "So" stays). The question is personal and open, and it loops cleanly into "In 18th-century England, a bankrupt who hid his money could hang." It is not financial advice.

Word budget after all three fixes: about 198 written words (192 now: -1 in fix 1, +4 +2 -1 in fix 2, +2 in fix 3). Numbers such as "13,513" and "fifteen forty-two" take longer to say than they look, so re-time the TTS against the 62 to 70 s window. If it runs long, trim `law-1542`, not the Perrott scenes.

## Scores

| Criterion | Score | Why (cite scene ids and quote lines) |
|---|---|---|
| Hook | 16/25 | `hook` "a bankrupt who hid his money could hang" is concrete, has real stakes and is said within about 3 s. Good. But it has no date ("In England", when?), and "And the word bankrupt? It means broken bench." opens a question and closes it in the same breath. The title already gives that answer. The hanging thread then goes quiet until `law-1706` at about 20 s. |
| Story and curiosity | 13/20 | There are plenty of microhooks ("The real record is darker.", "It got worse.", "And that law hid one more idea."), and "hid one more idea" is a well-planted loop that `fresh-start` pays off. Dates run forward: 1542, 1706, 1760, 1761, 1820, then back to 1706, which "the same law" flags. Weak spots: `italian` and `myth` repeat what `hook` already said. `myth` resolves to the anticlimax "probably figurative". `perrott` "Meet John Perrott, a shopkeeper..." has no stakes. Perrott is never said to go bankrupt. `four` "He wasn't even the last" is a microhook that contradicts the line after it. |
| Payoff and shareability | 10/15 | Two lines are worth repeating to a friend: torn banknote halves "tied up in a rag", and the fact that the same 1706 law brought both the rope and the fresh start ("Almost as an afterthought"). The rope promise is paid off. The title's promise ("broken bench") pays off only with "probably figurative" and is never mentioned again. The torn halves are left unexplained (no fact explains why they were torn, so that needs a source), so they land as an oddity rather than a reveal. |
| Clarity | 9/15 | Some words are hard to hear or say little with the sound off: "figurative" (`myth`), "fraudulent bankruptcy" (`hanged`, glossed only indirectly by `law-1706`), "discharge of debt" (`fresh-start`, never glossed in plain words). "They found" (`trunk`) has no referent. "Plus half a 1,000 pound note" is a fragment. "13,513 pounds" is hard to hear, though the big-number card helps. In `law-1542` the cue at "jailed" puts up "law", so with the sound off the jail never appears. Change the cue text to "Jailed". |
| Picture plan | 9/15 | The cut rate is good: about 2 to 3 s per shot throughout. Defects: `rake-fleet` (a prison) lands on "broken" twice and on "smashed" once. `tyburn-1747` (Tyburn) is zoomed on "Smithfield" in `hanged`. The `trunk` title reads "Newgate prison, London, 1781" over the 1780 Gordon Riots burning of Newgate, for an event in 1760 to 1761, so the viewer sees the wrong date and a fire the words never mention. The plan reuses heavily: 7 assets across about 45 shots, with `boe-note` about 10 times, `rake-fleet` about 8 and `tyburn-1747` 6. The `law-1706` "idea" shot also lands on the prison print. |
| Ending and comments | 6/10 | It ends on the real reveal ("the same law brought in the discharge of debt"), and the last line loops back to the first well. But "The rope failed. The discharge lasted." answers the closing question before it is asked, so there is little to argue about in the comments. |
| **Total** | **63/100** | |

## What works
- `hook` first sentence: a concrete, true and shocking claim, said within about 3 s and backed by f-1706-capital.
- `law-1706` kinetic lines "Hide it. / Hang for it." read perfectly with the sound off, and "that law hid one more idea" is a clean open loop.
- `trunk` has the best image in the script: "halves of banknotes tied up in a rag." It is specific and strange, and it's the kind of detail people repeat.
- `fresh-start` "Almost as an afterthought" keeps Kadens's wording and gives a real twist: the same law brought both the death penalty and the fresh start.
- Hedges are handled well: "probably figurative" (f-bench-myth, a disputed fact) and "Likely only 4" (f-four-hanged) are both kept.
- Shot cadence is fast and steady, and the title cards are honest ("Hogarth, a London hanging, 1747").

## Accuracy flags
- `law-1542` "England passed its first bankruptcy law": f-1542 says "what scholars generally consider England's first bankruptcy law", so the script drops the hedge. Suggested wording: "In 1542, England passed what's usually called its first bankruptcy law." (+3 words, so trim elsewhere.)
- `short` props label "missing from Perrott's books": f-perrott-shop says the accounts "showed a deficiency". "Missing" implies taken. Use "short in Perrott's books" to match the narration's "short".
- `fresh-start` "The rope failed": f-discharge says "coercing the debtor to be honest proved a failure". Narrowing coercion to the rope is an acceptable paraphrase, since the coercion in question was the capital penalty. No change needed.
- `plan.json` angle says the discharge is "the fresh start bankruptcy still means today". That is not in `facts.json`. The script rightly doesn't say it, and any line claiming it needs a source.
- No other claims go beyond their facts. Every rewrite above has been checked against f-1706-capital, f-bench-myth, f-perrott-shop, f-half-notes, f-four-hanged, f-perrott-hanged and f-discharge.

## Trends checked
- Say what the viewer will learn and show a first frame that matches it. Revealing the conclusion early is fine if the video then explains how or why. Use real, verifiable stakes. Pay off the promised answer, and don't hold it back for false suspense. The page also says there is no platform-wide three-second retention target. (Faceless Shorts hooks and retention 2026, ShortsFast, published 29 Jun 2026, updated 3 Oct 2026, https://shortsfast.com/blog/faceless-shorts-hooks-retention-2026/)
- On TikTok, completion rate is one of the strongest signals. Rewatches, shares (counted above likes), comments and saves are all positive signals. This supports a loop ending and a comment question that is truly open. (How the TikTok Algorithm Works in 2026, eClincher, 23 Jul 2026, https://www.eclincher.com/articles/how-the-tiktok-algorithm-works-in-2026)
- On YouTube Shorts, "viewed vs swiped away" is the first and strongest filter, so the opening seconds decide distribution. The article targets retention of 70% or more, and treats replays, comments and shares as satisfaction signals. This source is about seven months old, just outside the six-month window. (YouTube Shorts Algorithm 2026: How Reach Actually Works, Go-Viral, 14 Mar 2026, https://www.go-viral.app/blog/youtube-shorts-algorithm-2026/)
