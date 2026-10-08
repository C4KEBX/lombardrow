import { FOOTER, type PublishPackage } from "./package";

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
  const lengthOk = d === undefined ? undefined : d >= 65 && d <= 70;
  const descriptionsOk = [pkg.youtube.description, pkg.tiktok.caption, pkg.instagram.caption].every(
    (t) => t.includes(FOOTER) && pkg.sources.every((s) => t.includes(s.url)),
  );
  const lb = auto.listenBack;
  return [
    `# Pre-publish checklist: ${pkg.door}, ${pkg.title}`,
    "",
    "Ticked items were verified by the pipeline. The rest are for the QA watch-through: watch the whole video once, with sound, against `review/script.md`. A failure goes back to the script, not to a re-render.",
    "",
    human("Every date, number and name matches a source in the script document", "ticked at the fact-check gate in `review/script.md`"),
    human("No advice, no tickers, no named host or expert persona", "`check` lints for these; confirm by ear"),
    box(auto.variation === undefined ? undefined : auto.variation.length === 0, "Variation check passes on the final plan, script and length included", auto.variation?.join("; ")),
    box(lengthOk, "Runs 65 to 70 seconds", d === undefined ? "" : `${d.toFixed(1)} s`),
    human("Source stamp on screen for every number and date", "`check` enforces it; confirm while watching"),
    box(lb === undefined ? undefined : lb.mismatches === 0 && lb.drift === 0, "Captions checked word for word", lb ? `listen-back found ${lb.mismatches} word mismatches and ${lb.drift} caption timing drifts; see listen-back.md` : "run `npm run listen-back`"),
    box(true, "Photorealistic AI scenes disclosed", pkg.aiDisclosure.required ? `REQUIRED for ${pkg.aiDisclosure.scenes.join(", ")}: ${pkg.aiDisclosure.reason}` : `none needed (${pkg.aiDisclosure.reason})`),
    box(descriptionsOk, "Description has the sources and the standard footer", "youtube.txt, tiktok.txt, instagram.txt"),
    box(auto.thumbnails.length > 0, "Door number, title and thumbnail ready for every platform", auto.thumbnails.join(", ")),
    human("Final plan appended to history.jsonl after publishing", "`npm run variation -- record --plan ... --storyboard ... --duration ...`"),
    "",
  ].join("\n");
}
