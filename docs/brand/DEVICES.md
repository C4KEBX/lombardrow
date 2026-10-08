# Lombard Row: signature device components

Brief for Claude Code. Build the four signature devices as reusable components in the render pipeline, so every video uses them identically and no video draws them by hand.

Visual reference: the "Lombard Row Logo" design canvas, row "Signature devices" (four 9:16 style frames and a Device specs board). Exact values are in `devices.json` next to this file. Treat `devices.json` as the single source of truth and read every value from it; do not hard-code numbers in components.

## What to build

One component per device, each taking only the inputs listed. Use whatever component or template system the pipeline's rendering tool provides.

| Component | Inputs | When it appears |
| --- | --- | --- |
| LedgerLineOpen | door_no, series_name | 0 to 2 s of every video |
| YearCounter | start_year, end_year, in_s, out_s | While the story is in the past; hidden once it reaches today |
| SourceStamp | text, in_s, out_s | Every time a number or date is on screen |
| DoorPlate | door_no | Final 3 s of every video |

Also expose the ledger line as a chart axis: the same rule at the same position, recolored per `devices.json`, so the first chart grows out of the opening line.

## Rules

- Canvas is 1080 x 1920. Positions are px from the top-left.
- Nothing with text or a key graphic may enter the platform zones: bottom 384 px and right 162 px. Add a check that fails the render if any device's bounding box crosses them.
- Background is either Ledger Ink or Parchment (the video's `palette_lead`; Banker's Green ground is not used for devices). Each device has a color for each ground in `devices.json`. The year counter is dark-ground only: if the ground is Parchment, fail with a clear error.
- Brass is the single accent. On Parchment, Brass is used for shapes only, never text.
- SourceStamp text is capped at 60 characters. Fail rather than truncate.
- Numbers use tabular figures so counting digits do not shift.
- Fonts: Libre Caslon Text and Inter (both on Google Fonts, OFL licensed). Bundle the font files with the pipeline rather than loading them at render time.

## Acceptance

Render four still frames that match the canvas style frames (same sample text: door No. 004, year 1494, the Pacioli source line, the Rule of 72 chart caption) and one full 68-second test video using the No. 004 plan. Then compare the stills side by side with the canvas frames. Motion timings in `devices.json` are first proposals; flag any that look wrong in motion.
