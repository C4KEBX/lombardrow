# Production notes

Justin's standing notes from reviewing videos. Every video follows them, and every new note gets a line here, with its date, in the same change that builds it into the pipeline. Where the pipeline enforces a note, the line names the check or code that does it.

## Opening

- **Hook immediately.** There is no separate open. The video starts on its title card, with "No. 001" and the series across the top from frame 0. The headline must tell the viewer what they are watching within the first second (2026-10-08, 2026-10-09). Enforced by `check` (the first scene must be a `title` scene) and `src/scenes/title/Title.tsx`.
- **Cold open (approved 2026-10-10, No. 003 on).** No. 001's TikTok viewers left at about 6 s, where the still title card ended, and 61% swiped away on YouTube while those who stayed watched it all. So the fix touches only the first seconds. With `meta.open: "cold"` the video starts on a moving visual (a ledger, chart, map or document) with the door number and title laid over the top for 1.5 s, then the visual rises into place. Under the masthead the first scene is drawn smaller, between the ink band and the caption lane, so captions never sit on it. The first line states a surprising claim, never a question or a date, and the key number lands within 5 s. Enforced by `check` (`openerIssues` in `src/skill/check.ts`) and drawn by `src/compose/ColdOpenMasthead.tsx`. Used for No. 003 only; the fast format below replaces it from No. 004. The schema default stays `"title-card"` so No. 001 and No. 002 render unchanged.

The nine changes below come from the TikTok teardown of No. 003 (research/tiktok-teardown/README.md, "Changes for No. 004"). Justin approved all of them on 2026-10-10, and they apply from No. 004 on, as the fast format (`meta.format: "fast"`).

- **Full-bleed first frame, no masthead (2026-10-10).** Frame one is an image filling 9:16 with nothing over it. At 2 s "No. 00X" and the title come in as a small tag in the top-right corner. The full title stays on the cover and in the caption. Set with `meta.open: "bleed"`. Drawn by `src/scenes/archival/BleedArchival.tsx` and `src/compose/CornerTag.tsx`. Enforced by `check` (`bleedOpenIssues` in `src/skill/check.ts`).
- **A new picture every 2 to 3 s for the first 15 s (2026-10-10).** After 15 s, no shot runs longer than about 5 s, with 20 or more visual changes a minute. No. 003 had about 8, and its first change came at 9.8 s. Cuts, cues and bleed shots all count. Enforced by `check` and reported again on the real voice by `produce` (`pacingIssues` in `src/skill/pacing.ts`).
- **Show the detail, not the page (2026-10-10).** Crop archival scans to the line being narrated, at a size a phone can read, and sweep a highlighter across it as it's spoken. No whole pages of blackletter. Uses `shots` with `mark` on a bleed archival scene (`src/scenes/archival/BleedArchival.tsx`).
- **Open a loop the first line doesn't close (2026-10-10).** The first line is a claim with stakes for the viewer, never a question or a date. The first payoff comes by 5 s, and a second question is planted for the ending to answer. The question and date parts are enforced by `check`. The rest is a script rule in the make-lombard skill, checked at Gate 1.
- **A microhook every 8 to 10 s (2026-10-10).** For example "But that's not the first reason." or "Here's the catch." Each one is listed in its scene's `microhooks`. `check` fails a gap over 10.5 s, or over 12 s from the last microhook to the end (`pacingIssues`).
- **Pick stories whose hook isn't already a famous fact (2026-10-10),** or lead with the lesser-known twist. "Mortgage means dead pledge" was already a well-worn TikTok fact. This is a planning rule in the make-lombard skill, step 1.
- **Bigger captions in the middle of the frame, one to three words at a time (2026-10-10).** They are Inter 800 at 88 px, with an ink outline so they read on any image, centred at y 1300 inside the safe zone. That puts them in the band that was empty below each scene. On bleed images they sit over the picture. They don't go higher because charts and text fill the frame down to about y 1200 (`BOLD_CAPTIONS` in `src/captions/Captions.tsx`, `CAPTION_LIMITS` in `src/captions/chunk.ts`).
- **Narration about 10% faster in the first 5 s (2026-10-10).** Scenes marked `brisk` are voiced at +10% (`voiceFor` in `src/voice/types.ts`). `check` requires `brisk` on every scene that starts in the first 5 s.
- **The open needs real energy, not a slow push-in (2026-10-10).** Justin on the cold opens: they "do move in the open but it's just not dynamic at all." So every bleed shot lands with a punch: it starts 18% closer, snaps back over a third of a second, then keeps pushing in and drifting sideways. The highlighter sweeps on top of that, and the cuts come every 2 to 3 s (`BLEED_MOTION` in `src/scenes/archival/BleedArchival.tsx`). The music bed is not an issue: Justin confirmed the posted videos have music. The fresh review saw none because it looked at the TikTok upload file, which is voice-only by design.
- **Keep the 62 s floor by adding visual beats, not longer shots (2026-10-10).** The length rule below is unchanged. The pacing check fails any shot that runs long.

## Pacing

- **Fast, with very little air.** A scene ends 0.2 s after its last word (`DEFAULT_TAIL_PAD_MS`). Each sentence is voiced on its own and joined to the next with a 0.3 s gap (`src/voice/sentences.ts`), because Edge TTS otherwise holds about a second at every full stop (2026-10-09).
- **Vary the transitions.** Wipes run left to right, right to left, top to bottom and bottom to top, and the same direction never comes twice in a row (`wipeDirections` in `src/compose/wipe.ts`) (2026-10-09).

## Length and ending

- **At least 62 seconds and at most 70.** 62 s is the floor for TikTok and YouTube creator monetization. A short script gets more sourced narration, never padding or slower pacing. Enforced by `produce`, `npm run voice`, `check` and the publish checklist (`MIN_VIDEO_MS` in `src/schema/validate.ts`) (2026-10-09).
- **End abruptly.** The video stops 0.15 s after the sign-off's last word, with no held end card, so the loop restarts at once and can count a second view (`closeFrames` in `src/devices/tracks.ts`) (2026-10-09).

## Voice

- **British voice,** en-GB-RyanNeural by default (2026-10-08).
- **The sign-off is "Lombard Row, how money got this way!" in one natural breath.** "Lombard Row" is two words, but it is never run together, spliced or split by full stops. Justin picked the take, which lives in `src/brand/signoff/`, and every video reuses it (2026-10-09).

## Music

- **TikTok:** add a track in the app. **YouTube and Instagram:** a quiet bed from Pixabay Music under the voice, ducked while the voice speaks. The music thread owns this work (2026-10-09).

## Files

- **One folder per video.** Everything made for a video lives in `renders/no-XXX/`: `factcheck/`, `final/`, `drafts/`, `audio/`, `research/`. Once a video passes QA it gets a posting folder, `posting/no-XXX/`, with the final file, thumbnails, keywords, descriptions and anything else needed to post (2026-10-09). `produce`, `sheet`, `listen-back` and `publish-kit` write there by default (`src/pipeline/renderDir.ts`).

## Accuracy on screen

- **One date per source (2026-10-10).** No. 003 called Littleton's book "1600" (the edition we showed), then put "Littleton's Tenures" at 1481 (when it was written) on the timeline. A viewer sees a contradiction. When a work has two dates, say both ("written 1481, printed 1600") or use one throughout. This is a script rule in the make-lombard skill.
- **No made-up figures mid-animation (2026-10-10).** No. 001's compare bars counted up from zero, so a paused frame showed "0.658 yrs vs 0.000 yrs". Compare values now fade in at their true figure as each bar finishes (`valueIn` in `src/scenes/compare/Compare.tsx`).

## Earlier decisions

- When captions and the source stamp would overlap, the stamp moves (2026-10-08).
- Nothing is uploaded automatically (2026-10-08).
