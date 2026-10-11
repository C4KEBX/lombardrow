# Variation kit

Every Lombard Row video declares a plan before scripting. The plan is checked against the videos already published, so no two neighbours feel the same. This is what keeps a series with a consistent look from reading as a template.

- `variation/variation_spec.json`: every option, window and limit from the brand guidelines' variation table. Tune numbers there, not in code. If the checker rejects too often early on, loosen a window before removing a rule.
- `videos/history.jsonl`: one published plan per line, oldest first. Only `npm run variation -- record` writes it, after a video is published.
- `src/variation/index.ts`: the rules.

## Planning (before research)

1. `npm run variation -- suggest` lists, per dimension, the options the next video may use, least recently used first. Prefer the front of each list.
2. Write `videos/<no>-<slug>/plan.json` (copy `fixtures/no-004/plan.json`):
   - `doorNo`, `pillar` (origins, mechanics, words, hooks), `storyShape`, `hookType`, `era`, `region`, `primaryVisual`, `paletteLead`: one option each from the spec.
   - `visualMetaphor`: one concrete image invented for this topic ("a merchant's ledger column that doubles every nine lines"). Not a stock image; must not share half its words with any of the last 20.
   - `musicBed`: a library track id, or `null`.
   - `title`: its first three words must differ from the last 10 titles.
   - `angle`: one sentence saying what this video says that a generic explainer would not.
   - `sources`: the source URLs you expect to use, at least 3 sites.
3. `npm run variation -- check --plan videos/<no>-<slug>/plan.json`. Do not research or script until it passes. Change the plan, not the rules.

## Story shapes (the order of the middle 60 seconds)

| Shape | Middle |
| --- | --- |
| then_to_now | Origin, how it changed, what it means today |
| problem_it_solved | A crisis or pain point, the invention, the result |
| myth_vs_record | The popular story, the evidence, what actually happened |
| follow_the_money | One sum of money traced step by step through the system |
| two_people_one_deal | A buyer and a seller in history, what each gave and got |
| countdown | Three to five steps or facts building to the payoff |
| what_if_it_never_existed | Life without it, then why it was invented |

## Hooks (the first 3 seconds)

question ("Why is a home loan named after death?"), surprising_number ("Seventy-two. That one number tells you when your money doubles."), myth_to_correct, date ("Amsterdam, 1602."), cold_open_scene, everyday_object ("Look at the back of your credit card."), contrast_then_now.

## Scripting

- The storyboard must render the plan: `meta.doorNo` and `meta.paletteLead` match, `meta.series` is the pillar's series (origins "Why It Exists", mechanics "How It Works", words "Say It Right", hooks "On the Row Today"), the primary visual appears as a scene, and a question, number or date hook shows in the first sentence.
- The script (the storyboard's narration) runs 175 to 215 words (enough for the 62 s floor) and shares under 15% of its three-word phrases with any of the last 20 scripts.
- `npm run check -- --storyboard S --facts F --plan P` runs all of this with the storyboard checks.

## After publishing

`npm run variation -- record --plan P --storyboard S --duration <seconds>` appends the final plan, script and real length to `videos/history.jsonl`. It refuses a plan that fails.
