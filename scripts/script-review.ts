import fs from "node:fs";
import { parseStoryboard } from "../src/schema/storyboard";
import { parseFlags } from "../src/skill/flags";
import {
  SCRIPT_REVIEW, parseReport, readReview, reviewPathFor, scriptGateIssue, scriptHash, type ScriptReview,
} from "../src/skill/scriptReview";

/**
 * npm run script-review -- record   --storyboard <path>   reads the reviewer's script-review.md, stamps it
 * npm run script-review -- status   --storyboard <path>   says whether produce may run (exit 1 if not)
 * npm run script-review -- override --storyboard <path> --by Justin --reason "<why>"   Justin's word only
 */
function main(): void {
  const [command, ...rest] = process.argv.slice(2);
  const { values } = parseFlags(rest, { values: ["--storyboard", "--by", "--reason"] });
  const storyboardPath = values.get("--storyboard");
  if (!storyboardPath) throw new Error("Missing required flag --storyboard");
  const sb = parseStoryboard(JSON.parse(fs.readFileSync(storyboardPath, "utf-8")));
  const jsonPath = reviewPathFor(storyboardPath);
  const write = (review: ScriptReview) => fs.writeFileSync(jsonPath, `${JSON.stringify(review, null, 2)}\n`);

  if (command === "record") {
    const reportPath = reviewPathFor(storyboardPath, SCRIPT_REVIEW.report);
    if (!fs.existsSync(reportPath)) throw new Error(`No ${reportPath}; run the script-reviewer agent first`);
    const { score, verdict } = parseReport(fs.readFileSync(reportPath, "utf-8"));
    write({ score, verdict, scriptHash: scriptHash(sb), reviewedAt: new Date().toISOString() });
    console.log(`Script review: ${score}/100 (minimum ${SCRIPT_REVIEW.minScore}). ${verdict}`);
  } else if (command === "override") {
    const by = values.get("--by");
    const reason = values.get("--reason");
    if (!by || !reason) throw new Error("override needs --by and --reason");
    const review = readReview(storyboardPath);
    if (!review) throw new Error("No script review to override; record one first");
    if (review.scriptHash !== scriptHash(sb)) throw new Error("The script changed after its review; review it again first");
    write({ ...review, override: { by, reason, at: new Date().toISOString() } });
    console.log(`Script review overridden by ${by}: ${reason}`);
  } else if (command !== "status") {
    throw new Error(`Unknown command "${command ?? ""}"; use record, status or override`);
  }
  const issue = scriptGateIssue(sb, readReview(storyboardPath));
  if (command === "status") console.log(issue ?? "Script review passed; produce may run.");
  if (issue) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(`script-review failed: ${(error as Error).message}`);
  process.exit(1);
}
