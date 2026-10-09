import fs from "node:fs";
import path from "node:path";

/**
 * Everything made for one video lives in one folder, renders/no-XXX/ (Justin, 2026-10-09):
 * factcheck/ for the Gate 1 review, final/ for the cut that goes to QA and its publish kit,
 * drafts/ for superseded cuts, audio/ for music and SFX tests, research/ for source scans.
 * Set LOMBARD_RENDERS_DIR to put the renders folder somewhere else, such as the shared Lombard Row folder.
 */
export const RENDERS_ENV = "LOMBARD_RENDERS_DIR";
export const RENDER_STAGES = ["factcheck", "final", "drafts", "audio", "research"] as const;
export type RenderStage = (typeof RENDER_STAGES)[number];

export const doorFolder = (doorNo: number): string => `no-${String(doorNo).padStart(3, "0")}`;

export const rendersRoot = (env: NodeJS.ProcessEnv = process.env): string => path.resolve(env[RENDERS_ENV] || "renders");

export const renderDir = (doorNo: number, stage: RenderStage, root: string = rendersRoot()): string =>
  path.join(root, doorFolder(doorNo), stage);

/** The door number in a storyboard file, without validating the rest of it. */
export function storyboardDoor(storyboardPath: string): number {
  const door = (JSON.parse(fs.readFileSync(storyboardPath, "utf-8")) as { meta?: { doorNo?: unknown } }).meta?.doorNo;
  if (typeof door !== "number" || !Number.isInteger(door)) throw new Error(`${storyboardPath} has no meta.doorNo`);
  return door;
}

/** `--out` when given; otherwise the video's final/ folder. */
export const outDirFor = (storyboardPath: string, out?: string, root?: string): string =>
  out ?? renderDir(storyboardDoor(storyboardPath), "final", root);
