# Music beds and sound effects

Every video gets a music bed under the narration and quiet sound effects on the devices and cuts. Both come from small libraries in this repo, so renders stay offline and every file's license is written down next to it.

## Using them

- Pick a bed with `npm run audio -- list` and set its id as the plan's `musicBed` and the storyboard's `audio.music`. `null` means no music; `"ambient"` is the old generated drone.
- `produce` loudness-matches the bed, fades it in under the hook and out over the door plate, and ducks it about 4 dB under the voice (`src/audio/graph.ts`: `MUSIC_BED_DB`, `DUCK`, `MUSIC_FADE`).
- Sound effects are automatic (`src/audio/cues.ts`): a pen under each title card's rule, a soft whoosh on each wipe, ticks while the year counter rolls, a thud as each source stamp lands, paper for archival and ledger-page scenes, and a low hit under the door plate. Turn them off with `"sfx": { "auto": false }`, or add a cue by hand: `"sfx": { "cues": [{ "scene": "summa", "sound": "coin", "atMs": 1200 }] }`.
- `publish-kit` adds the bed's credit line to every description when its license asks for one.

## Adding tracks and sounds

`npm run audio -- add-music` cuts a bed to 90 s, normalizes it to the library loudness (-20 LUFS) and records it in `music/library.json`; `npm run audio -- add-sfx` trims and peak-normalizes a sound into `sfx/`. Run either without flags for the full usage. Only add audio whose license you have read on its own page:

- `cc0`, `public-domain`, `pixabay` (the Pixabay Content License), `original`: no credit needed. Pixabay blocks automated downloads, so download Pixabay tracks in a browser and add them with `--license pixabay --source-url <the track page>`.
- `cc-by-4.0`: give `--credit`; it is printed in every description that uses the track.
- `licensed`: a paid library you subscribe to (Epidemic Sound, Artlist). Download while subscribed; the track page is the `--source-url`.

## The starter set

Beds: eight pieces by Kevin MacLeod (incompetech.com), CC BY 4.0, credited automatically. They are not registered with YouTube Content ID; if a claim appears anyway, dispute it with the credit and the license link.

| id | Mood | Suits |
|---|---|---|
| almost-new | curious, warm | Default origin story |
| envision | mysterious, driving | Myth vs record, investigations |
| teller-of-the-tales | old world, reflective | Medieval and Renaissance (Venice, Florence) |
| sinfonia-5 | baroque, somber | 17th to 18th century |
| feel-it-coming | tense, driving | Bubbles, panics, frauds |
| river-of-io | tense, mysterious | Stories that build to a reveal |
| on-the-shore | reflective, somber | Losses and lessons |
| perspectives | uplifting, warm | Compounding and payoff endings |

Sound effects: twelve CC0 sounds from Freesound (no credit required; each source page is in `sfx/library.json`).

The original downloads are kept outside the repo, on the Mac at `~/Claude Code/lombard-row/audio-library-src/`.
