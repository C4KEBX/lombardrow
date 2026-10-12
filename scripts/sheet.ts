import path from "node:path";
import { renderDir, storyboardDoor } from "../src/pipeline/renderDir";
import { parseFlags } from "../src/skill/flags";
import { renderSheet } from "../src/skill/sheetRender";

const { values } = parseFlags(process.argv.slice(2), { values: ["--storyboard", "--facts", "--out", "--verify"] });
const need = (flag: string): string => {
  const v = values.get(flag);
  if (!v) {
    console.error(`sheet failed: Missing required flag ${flag}`);
    process.exit(2);
  }
  return path.resolve(v);
};
const storyboardPath = need("--storyboard");
renderSheet({
  storyboardPath,
  factsPath: need("--facts"),
  // The Gate 1 review goes to renders/no-XXX/factcheck unless --out says otherwise.
  outDir: values.get("--out") ? path.resolve(values.get("--out") as string) : renderDir(storyboardDoor(storyboardPath), "factcheck"),
  verifyPath: values.get("--verify") ? path.resolve(values.get("--verify") as string) : undefined,
})
  .then((file) => console.log(`Review sheet: ${file}`))
  .catch((error: Error) => {
    console.error(`sheet failed: ${error.message}`);
    process.exit(1);
  });
