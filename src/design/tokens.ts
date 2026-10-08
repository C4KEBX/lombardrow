export const VIDEO = { width: 1080, height: 1920, fps: 30 } as const;

/** Pixels kept clear of platform UI: top 8%, bottom 20% of the height; fixed side padding. */
export const SAFE = {
  top: Math.ceil(VIDEO.height * 0.08),
  bottom: Math.ceil(VIDEO.height * 0.2),
  side: 60,
} as const;

/** Bold flat palette. Semantic roles are fixed: gains/losses are never decorative. */
export const PALETTE = {
  ground: "#15133b",
  ink: "#fff7e8",
  positive: "#2ee59d",
  negative: "#ff5d5d",
  neutral: "#7c8cff",
  highlight: "#ffd23f",
} as const;

/** Fixed lane for captions: below all scene content, above the platform UI zone. */
export const CAPTION_LANE = { top: 1340, bottom: VIDEO.height - SAFE.bottom } as const;

/** Space for headline text: between the safe top and the caption lane, minus room for the kicker line. */
export const TITLE_LANE = {
  width: VIDEO.width - 2 * SAFE.side,
  height: CAPTION_LANE.top - SAFE.top - 140,
} as const;

/** Categorical series colors (bar races). Deliberately excludes the semantic gain/loss colors. */
export const CATEGORICAL = [
  "#ffd23f", "#7c8cff", "#ff9f5a", "#5ad1ff", "#c78bff", "#9be564", "#ff7ab6", "#8fa3b8",
] as const;

/** Space for stacked kinetic lines: safe top to the caption lane, minus breathing room. */
export const KINETIC_LANE = {
  width: VIDEO.width - 2 * SAFE.side,
  height: CAPTION_LANE.top - SAFE.top - 120,
  maxFont: 190,
} as const;

/** Quote text lane: the title lane minus room for the big quote mark above and the attribution below. */
export const QUOTE_LANE = {
  width: TITLE_LANE.width,
  height: TITLE_LANE.height - 360,
  maxFont: 120,
} as const;

/** The map's drawing area: below the title and footnote, above the caption lane. */
export const MAP_BOX = { left: SAFE.side, right: VIDEO.width - SAFE.side, top: 300, bottom: 1300 } as const;
