import fs from "node:fs";
import path from "node:path";
import { parseFacts } from "../src/schema/facts";
import { parseFlags } from "../src/skill/flags";
import { verifyFacts } from "../src/skill/verifyFacts";

try {
  const { values, flags } = parseFlags(process.argv.slice(2), { values: ["--facts", "--out"], booleans: ["--no-archive"] });
  const factsPath = values.get("--facts");
  if (!factsPath) throw new Error("Missing required flag --facts");
  const facts = parseFacts(JSON.parse(fs.readFileSync(factsPath, "utf-8")));
  verifyFacts(facts, fetch, { archive: !flags.has("--no-archive") }).then((results) => {
    for (const r of results) {
      const missing = r.missing.length ? ` missing: ${r.missing.slice(0, 8).join(", ")}` : "";
      console.log(`${r.status.padEnd(11)} ${r.factId}  ${r.url}${r.detail ? `  (${r.detail})` : ""}${missing}`);
      for (const e of r.evidence ?? []) console.log(`            ${e.token}: "${e.sentence}"`);
      if (r.unverifiable?.length) console.log(`            not counted (small whole numbers): ${r.unverifiable.join(", ")}`);
      if (r.archiveUrl) console.log(`            snapshot: ${r.archiveUrl}`);
    }
    console.log("Advisory only: a number on the page does not prove it means what the claim says. Read the source.");
    const out = values.get("--out");
    if (out) fs.writeFileSync(path.resolve(out), `${JSON.stringify(results, null, 2)}\n`);
  });
} catch (error) {
  console.error(`verify-facts failed: ${(error as Error).message}`);
  process.exit(2);
}
