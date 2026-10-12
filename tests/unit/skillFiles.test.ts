import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SCENE_TYPES } from "../../src/schema/storyboard";

const DIR = path.resolve(".claude/skills/make-lombard");
const skill = fs.readFileSync(path.join(DIR, "SKILL.md"), "utf-8");
const rules = fs.readFileSync(path.join(DIR, "rules.md"), "utf-8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf-8")) as { scripts: Record<string, string> };

const frontmatter = (text: string): Record<string, string> => {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) throw new Error("no frontmatter");
  return Object.fromEntries(m[1].split("\n").map((l) => [l.slice(0, l.indexOf(":")).trim(), l.slice(l.indexOf(":") + 1).trim()]));
};

describe("SKILL.md", () => {
  it("has valid frontmatter whose name matches its directory", () => {
    const fm = frontmatter(skill);
    expect(fm.name).toBe("make-lombard");
    expect(path.basename(DIR)).toBe(fm.name);
    expect(fm.description.length).toBeGreaterThan(40);
    expect(fm.description.length).toBeLessThanOrEqual(1024);
    expect(fm.description.toLowerCase()).toContain("explainer");
    expect(fm.description.toLowerCase()).toContain("video");
  });
  it("stays short enough to be read in full", () => {
    expect(skill.split("\n").length).toBeLessThanOrEqual(200);
  });
  it("keeps the hard rules and the human gate", () => {
    expect(skill).toMatch(/never edit/i);
    expect(skill).toMatch(/STOP/);
    expect(skill).toMatch(/fact-check gate/i);
    expect(skill).toMatch(/QA gate/i);
    expect(skill).toMatch(/never type a (figure|number)/i);
  });
});

describe("skill files reference real things", () => {
  const text = `${skill}\n${rules}`;
  it("every `npm run <script>` mentioned exists in package.json", () => {
    const scripts = [...text.matchAll(/npm run ([a-z][a-z0-9:-]*)/g)].map((m) => m[1]);
    expect(scripts.length).toBeGreaterThan(0);
    for (const s of scripts) expect(pkg.scripts[s], `npm run ${s}`).toBeDefined();
    for (const s of ["check", "sheet", "verify-facts", "produce", "catalog", "variation", "voice", "listen-back", "publish-kit"]) expect(text).toContain(`npm run ${s}`);
  });
  it("every repo path mentioned exists", () => {
    const paths = [...text.matchAll(/`((?:fixtures|src|scripts)\/[A-Za-z0-9_./-]+)`/g)].map((m) => m[1]);
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) expect(fs.existsSync(p), p).toBe(true);
  });
  it("the schema and the example storyboards it points to are present", () => {
    expect(fs.existsSync(path.join(DIR, "storyboard.schema.json"))).toBe(true);
    for (const f of ["finance", "history", "ancient", "ledger"]) expect(skill).toContain(`fixtures/${f}.storyboard.json`);
  });
});

describe("rules.md", () => {
  it("documents every scene type under its own heading", () => {
    for (const type of SCENE_TYPES) expect(rules, type).toContain(`### ${type}`);
  });
  it("covers cues, narration style, facts and finance safety", () => {
    for (const heading of ["## Cues", "## Narration style", "## Facts", "## Finance and investing"]) expect(rules).toContain(heading);
  });
});
