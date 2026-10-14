# Script review: No. 6 Why 'bankrupt' means 'broken bench'

**Score: 68/100**: A strong open and a great trunk detail, but the closing question is answered before it is asked, the back half is a row of single facts with no re-hook, and the payoff plays over a burning prison and a mob.

Word budget: about 173 words written (numerals counted as one word), about 185 spoken, measured at about 68 s. All three fixes are word-neutral in both counts, so length and the 175-word floor do not change.

## The three fixes that would raise the score most

1. **Ask a question history hasn't already answered, about +3 points (Ending).** `fresh-start` as written: "So, owing a fortune, which keeps you honest: the rope, or the reward?" (13 words). Two lines earlier the script says "The rope failed. The reward lasted.", so the viewer has nothing left to argue. Keep that verdict, because it is the payoff of "one more idea", and make the question personal. Rewrite (13 words): **"So, owing a fortune, with the rope waiting: would you have hidden it?"** "Hidden it" loops straight back to the first line, "A bankrupt who hid his money could hang.", and a yes/no question is easy to answer in a comment.
   - Change `props.lines` to "With the rope waiting," / "would you have hidden it?".
   - Change `meta.ending.prompt` to "With the rope waiting, would you have hidden it?" and keep `atWord` "So".
   - Checked against f-1706-capital and f-discharge. It asks a historical "what would you do" and makes no claim. Nothing in it reads as financial advice.

2. **Re-hook the back half at the deficiency, about +3 points (Story +2, Clarity +1).** From `perrott` (about 27 s) to `four`, the script runs name, number, find, hanging, statistic, one fact per scene. The microhooks there are sentence fragments ("That merchant was John Perrott,", "Perrott was hanged at Smithfield"), not re-openers. The biggest gap is between `short` and `trunk`: "13,513 pounds short" is the setup for the trunk, but nothing asks the question, and "In Newgate prison" then arrives with no bridge.
   - `short`, as written: "In 1760, the officials running his bankruptcy said he was 13,513 pounds short." (13). Rewrite: **"In 1760, his bankruptcy officials said he was 13,513 pounds short. Where was it?"** (14). Set the microhook to "Where was it?". The hedge "officials said" stays, and so does the card label "short, by the officials' count".
   - `law-1706`, as written: "And that law hid one more idea." Rewrite: "That law hid one more idea." (−1). Update its microhook to match.
   - Net: 0 words. "Where was it?" is a question, not a claim. Do not answer it with "found it" or "the missing money": f-half-notes only says the notes were found in his trunk, not that they made up the £13,513.

3. **Take the trunk reveal off the Newgate riot print, about +2 points (Picture plan).** The renderer fills a 9:16 frame, so a shot shows a strip of the image `w` wide and about 1.78 × `w` tall (by the image's width), centred about 40% of the way down. With `newgate-1780` at w0.28, that strip covers most of the print's height. At "trunk" (x0.55 y0.42) it shows the flames and smoke over the roof. The opening shot (x0.68 y0.55) shows the armed mob and the engraved caption "Destruction of NEWGATE by the Rioters". So "at the bottom of his trunk, tied in a rag", the quietest and best line in the script, plays over a riot that happened 19 years later. A viewer will read the fire as part of Perrott's story. No 9:16 crop of this landscape print leaves out both the fire and the mob.
   - `trunk` narration, as written: "In Newgate prison, at the bottom of his trunk," Rewrite: **"In prison, at the very bottom of his trunk,"** (0 words net). This lets the picture be a prison that is not named Newgate without the credit contradicting the words.
   - Set the scene `assetId` to `rake-fleet` and the title to "A London prison, by Hogarth". First shot: x0.70 y0.17 w0.25, the barred window and the shelf, with no riot or fire. At "trunk": `rake-fleet` x0.92 y0.70 w0.2, the bag and box on the floor at bottom right. Nudge y up if the engraved verse at the foot of the print comes into frame. Keep the two `boe-note` shots at "halves" and "1,000". Both land on torn edges of the note and stay clear of the "SPECIMEN" stamp, which reads as "half a note".
   - Optional: `law-1706` at "idea" also uses `rake-fleet`. Move that shot to `rake-arrest` x0.5 y0.5 w0.4 so the Fleet print appears twice, not three times.

**Required regardless of score (see Accuracy flags):** in `myth`, change "Dictionaries say it's probably just a figure of speech." (9 words) to "A dictionary says it's probably a figure of speech." (9 words).

## Scores
| Criterion | Score | Why (cite scene ids and quote lines) |
|---|---|---|
| Hook | 19/25 | `hook`: "A bankrupt who hid his money could hang." This is concrete, with life-or-death stakes, in eight plain words under 3 s. It matches `meta.hookLine` and the cover. "One London merchant did" opens a real question. Points lost: the stakes are historical with no way in for "you". "In 18th-century England" is vague. "Even the word 'bankrupt' hides something broken." starts a second thread at about 6 s, before the first has taken hold. |
| Story and curiosity | 13/20 | The dates run forward (1706, 1760, 1761, 1820). "The real record is darker." (`myth`) now turns the word detour back toward the story, and "And that law hid one more idea." is a good long loop paid off in `fresh-start`. Points lost: the merchant promised at 3 s is named only at about 27 s. After that the script is a list, `perrott` (8 words), `short`, `trunk`, `hanged`, `four`, and no line re-opens a question in the 35 to 55 s stretch. `four` ("one of only 4 Englishmen hanged for it. In 1820, hanging for it was abolished.") comes after the climax and plays as a fact list. |
| Payoff and shareability | 11/15 | `trunk`: "tied in a rag: halves of four banknotes. And half a 1,000 pound note." is the line people will repeat, and "one of only 4" is a good second. The promise of the open is paid at `hanged`. "Almost an afterthought ... The reward lasted." is a real "I didn't know that". Points lost: the script never says why the notes were in halves, which is the obvious next question. That needs a source. |
| Clarity | 10/15 | `myth`: "Dictionaries say" claims more than the one source that says "probably figurative" (see Accuracy flags). `trunk`: "In Newgate prison" is a jump: nothing says he was arrested, and no fact covers it. `four`: "for it" twice in two sentences. `short`: "thirteen thousand five hundred and thirteen pounds" is long to hear, but the big-number card carries it. `italian` and the kinetic lines ("Hide it. / Hang for it.") read cleanly with the sound off. |
| Picture plan | 9/15 | The pace is good: about 40 shots in 68 s. Each shot's credit follows its own asset, and the Tyburn crops stay below the printed "Executed at Tyburn" heading. Points lost: the `trunk` payoff sits on the Newgate riot print, with fire at "trunk" and the mob and the engraved "NEWGATE by the Rioters" in the first shot. `bankers-1340` holds the screen from "word" (about 6 s) to the end of `myth` (about 19 s): fourteen seconds of one painting, with "smashed" and "broken" landing on an intact table. The Tyburn hanging print appears in 5 of 10 scenes, which blunts it at `hanged`. In `short`, "officials" lands on the note's Britannia crest. |
| Ending and comments | 6/10 | It ends on a question, and "rope" calls back to "hang". But "The rope failed. The reward lasted." answers "which keeps you honest: the rope, or the reward?" four seconds before it is asked. |
| **Total** | **68/100** | |

## What works
- The open line: "A bankrupt who hid his money could hang." Concrete, deadly, short, and the same on the cover.
- The hedges hold: "Legend says", "probably", "the officials running his bankruptcy said", "He was likely one of only 4", and the card "bankrupts likely hanged, 1706 to 1820".
- `trunk` is specific and visual: "at the bottom of his trunk, tied in a rag".
- The "one more idea" / "That other idea?" loop gives the last 15 s a job to do, and "Almost an afterthought" is quoted faithfully from Kadens.
- `myth` now ends on "The real record is darker.", which turns the etymology back into the story.

## Accuracy flags
- `myth`: "Dictionaries say it's probably just a figure of speech." f-bench-myth rests on one dictionary (Etymonline). The Merriam-Webster corroboration covers only the derivation, and the Gazette corroboration leans the other way ("the bench was broken in a symbolic show of failure"). Change it to "A dictionary says it's probably a figure of speech." This is word-neutral.
- `trunk`: "halves of four banknotes" is fine, but the source says "the other halves". Don't strengthen it into "the missing money" or "the hidden £13,513", and don't explain why the notes were halved without a source.
- `trunk` / `short`: why Perrott was in Newgate (arrest, charge) needs a source before any line explains it.
- Every other line matches its fact. `f-1542` is unused, which is fine.

## Trends checked
- Retention is mostly decided in the first three seconds. Aim for a visual change every 1 to 2 s, because static frames "invite the swipe". Loop endings that end mid-thought and restart cleanly earn replays. The benchmarks come from third-party aggregators. (Top Attributes of High-Retention YouTube Shorts, GoFaceless, published 26 July 2026, updated 11 October 2026, https://www.gofaceless.ai/en/blog/high-retention-youtube-shorts-attributes). This supports fix 1 (a loop back to "hid") and the note on the 14 s spent on one painting.
- If viewers leave mid-video, fix the pacing or the unclear step there; "a new hook alone may not help." Use only true, verifiable stakes. No universal three-second target is published. (Faceless Shorts hooks and retention, ShortsFast, published 29 June 2026, updated 3 October 2026, https://shortsfast.com/blog/faceless-shorts-hooks-retention-2026/). This supports fix 2: the 35 to 55 s run is the mid-video pacing risk.
- Plan 3 to 5 beats, each a small payoff that earns the next few seconds. Change the visual every 2 to 4 s. Put bold on-screen text in the first frame, since most views are on mute. Put the call to action in the last 5 s, after the value. (How to Write Hooks That Stop the Scroll (2026 Guide), Eliro, 7 April 2026, https://eliro.pro/blog/short-form-video-hooks-script-guide-2026). This is a little over six months old. It supports the beat-by-beat re-hook in fix 2.
