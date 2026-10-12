import fs from "node:fs";
import path from "node:path";
import { buildCatalog } from "../src/skill/catalog";

const file = path.resolve(".claude/skills/make-lombard/storyboard.schema.json");
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, buildCatalog());
console.log(`wrote ${file}`);
