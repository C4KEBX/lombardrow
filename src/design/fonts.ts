import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

/** Bundled locally (public/fonts, SIL OFL) so renders never depend on Google Fonts being reachable. */
const FACES: readonly { family: string; file: string; weight: string; style?: string }[] = [
  { family: "Libre Caslon Text", file: "libre-caslon-text-latin-400-normal.woff2", weight: "400" },
  { family: "Libre Caslon Text", file: "libre-caslon-text-latin-700-normal.woff2", weight: "700" },
  { family: "Libre Caslon Text", file: "libre-caslon-text-latin-400-italic.woff2", weight: "400", style: "italic" },
  { family: "Inter", file: "inter-latin-400-normal.woff2", weight: "400" },
  { family: "Inter", file: "inter-latin-500-normal.woff2", weight: "500" },
  { family: "Inter", file: "inter-latin-600-normal.woff2", weight: "600" },
];

// Only in a browser (Studio or a render); unit tests import scenes in Node, where there is no document.
if (typeof document !== "undefined") {
  for (const face of FACES) {
    void loadFont({ family: face.family, url: staticFile(`fonts/${face.file}`), weight: face.weight, style: face.style ?? "normal", format: "woff2" });
  }
}

/** Headlines, quotes, the year counter and the door plate. */
export const DISPLAY_FONT = "Libre Caslon Text";
/** Captions, labels and every number (with tabular figures). */
export const BODY_FONT = "Inter";
export const NUMBER_FONT = BODY_FONT;

/** Tabular figures so counting numbers never jump. */
export const TABULAR = { fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"' } as const;
