# Production notes

Justin's standing notes from reviewing videos. Every video follows them, and every new note gets a line here, with its date, in the same change that builds it into the pipeline. Where the pipeline enforces a note, the line names the check or code that does it.

## Opening

- **Hook immediately.** There is no separate open. The video starts on its title card, with "No. 001" and the series across the top from frame 0. The headline must tell the viewer what they are watching within the first second (2026-10-08, 2026-10-09). Enforced by `check` (the first scene must be a `title` scene) and `src/scenes/title/Title.tsx`.

## Pacing

- **Fast, with very little air.** A scene ends 0.2 s after its last word (`DEFAULT_TAIL_PAD_MS`). Each sentence is voiced on its own and joined to the next with a 0.3 s gap (`src/voice/sentences.ts`), because Edge TTS otherwise holds about a second at every full stop (2026-10-09).
- **Vary the transitions.** Wipes run left to right, right to left, top to bottom and bottom to top, and the same direction never comes twice in a row (`wipeDirections` in `src/compose/wipe.ts`) (2026-10-09).

## Length and ending

- **At least 62 seconds and at most 70.** 62 s is the floor for TikTok and YouTube creator monetization. A short script gets more sourced narration, never padding or slower pacing. Enforced by `produce`, `npm run voice`, `check` and the publish checklist (`MIN_VIDEO_MS` in `src/schema/validate.ts`) (2026-10-09).
- **End abruptly.** The video stops 0.15 s after the sign-off's last word, with no held end card, so the loop restarts at once and can count a second view (`closeFrames` in `src/devices/tracks.ts`) (2026-10-09).

## Voice

- **British voice,** en-GB-RyanNeural by default (2026-10-08).
- **The sign-off says "Lombard Row" as two words**: not run together as "LombardRow", but not split apart by full stops either. It should sound natural, with some swing on "How money got this way." The approved take lives in `src/brand/signoff/` (2026-10-09; the take is still being chosen).

## Music

- **TikTok:** add a track in the app. **YouTube and Instagram:** a quiet bed from Pixabay Music under the voice, ducked while the voice speaks. The music thread owns this work (2026-10-09).

## Earlier decisions

- When captions and the source stamp would overlap, the stamp moves (2026-10-08).
- Nothing is uploaded automatically (2026-10-08).
