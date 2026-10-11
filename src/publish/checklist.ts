import { MAX_VIDEO_MS, MIN_VIDEO_MS } from "../schema/validate";
import { FOOTER, type PublishPackage } from "./package";

const MIN_S = MIN_VIDEO_MS / 1000;
const MAX_S = MAX_VIDEO_MS / 1000;

export type AutoChecks = {
  /** Real length from produce's manifest, in seconds. */
  durationSeconds?: number;
  /** Reasons the final variation check failed; empty when it passed; undefined when it was not run. */
  variation?: string[];
  /** Words and numbers the listen-back found wrong; undefined when it was not run. */
  listenBack?: { mismatches: number; drift: number };
  thumbnails: string[];
};

/** A step for the person at the QA gate. */
const human = (text: string, why = ""): string => `- [ ] ${text}${why ? `: ${why}` : ""}`;
/** A step the pipeline checks: ticked, FAILED, or not run yet. */
const box = (ok: boolean | undefined, text: string, why = ""): string =>
  `- [${ok === true ? "x" : " "}] ${text}${ok === false ? " **FAILED**" : ok === undefined ? " (not checked yet)" : ""}${why ? `: ${why}` : ""}`;

/** The brand guidelines' pre-publish checklist, with the items the pipeline can verify already ticked. */
export function renderChecklist(pkg: PublishPackage, auto: AutoChecks): string {
  const d = auto.durationSeconds;
  const lengthOk = d === undefined ? undefined : d >= MIN_S && d <= MAX_S;
  const descriptionsOk = [pkg.youtube.description, pkg.tiktok.caption, pkg.instagram.caption].every(
    (t) => t.includes(FOOTER) && pkg.sources.every((s) => t.includes(s.url)),
  );
  const lb = auto.listenBack;
  return [
    `# Pre-publish checklist: ${pkg.door}, ${pkg.title}`,
    "",
    "Ticked items were verified by the pipeline. The rest are for the QA watch-through: watch the whole video once, with sound, against `factcheck/script.md`. A failure goes back to the script, not to a re-render.",
    "",
    human("Every date, number and name matches a source in the script document", "ticked at the fact-check gate in `factcheck/script.md`"),
    human("No advice, no tickers, no named host or expert persona", "`check` lints for these; confirm by ear"),
    box(auto.variation === undefined ? undefined : auto.variation.length === 0, "Variation check passes on the final plan, script and length included", auto.variation?.join("; ")),
    box(lengthOk, `Runs ${MIN_S} to ${MAX_S} seconds`, d === undefined ? "" : `${d.toFixed(1)} s`),
    human("Source stamp on screen for every number and date", "`check` enforces it; confirm while watching"),
    // Speech recognition errs too, so listen-back findings are places to listen, not failures.
    lb && lb.mismatches === 0 && lb.drift === 0
      ? box(true, "Captions checked word for word", "listen-back heard the script exactly, captions in sync")
      : lb
        ? human("Captions checked word for word", `listen closely at the ${lb.mismatches + lb.drift} places in listen-back.md (${lb.mismatches} words differ, ${lb.drift} captions out of sync)`)
        : box(undefined, "Captions checked word for word", "run `npm run listen-back`"),
    box(true, "Photorealistic AI scenes disclosed", pkg.aiDisclosure.required ? `REQUIRED for ${pkg.aiDisclosure.scenes.join(", ")}: ${pkg.aiDisclosure.reason}` : `none needed (${pkg.aiDisclosure.reason})`),
    box(descriptionsOk, "Description has the sources and the standard footer", "youtube.txt, tiktok.txt, instagram.txt"),
    box(auto.thumbnails.length > 0, "Door number, title and thumbnail ready for every platform", auto.thumbnails.join(", ")),
    human("Final plan appended to history.jsonl after publishing", "`npm run variation -- record --plan ... --storyboard ... --duration ...`"),
    "",
  ].join("\n");
}
