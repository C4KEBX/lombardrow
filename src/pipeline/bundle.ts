import path from "node:path";
import { bundle } from "@remotion/bundler";

let cached: Promise<string> | undefined;

/** Bundles the Remotion project once per process. */
export function getServeUrl(): Promise<string> {
  cached ??= bundle({ entryPoint: path.resolve("src/index.ts") });
  return cached;
}

/**
 * Browser for Remotion to render with. Unset means Remotion's own download (the normal case on a dev machine);
 * set REMOTION_BROWSER_EXECUTABLE where that download is blocked and a Chromium headless shell is installed.
 */
export function browserExecutable(): string | null {
  return process.env.REMOTION_BROWSER_EXECUTABLE || null;
}
