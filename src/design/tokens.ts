import DEVICES from "../brand/devices.json";

export { DEVICES };

export const VIDEO = { width: 1080, height: 1920, fps: 30 } as const;

/**
 * Pixels kept clear of platform UI. Bottom and right come from the platform zones in
 * devices.json (bottom 20%, right 15% for the action rail); the left margin is the content
 * area's x. Top 8% keeps headlines clear of the status bar.
 */
export const SAFE = {
  top: Math.ceil(VIDEO.height * 0.08),
  bottom: VIDEO.height - DEVICES.platform_zones.bottom.y,
  left: DEVICES.content_area.x,
  right: VIDEO.width - DEVICES.platform_zones.right.x,
} as const;

/** The content area every scene draws inside: x 72 to 918, down to the bottom platform zone. */
export const CONTENT = {
  left: SAFE.left,
  right: VIDEO.width - SAFE.right,
  width: VIDEO.width - SAFE.left - SAFE.right,
  bottom: VIDEO.height - SAFE.bottom,
} as const;

/** Fixed lane for captions (devices.json captions box): below all scene content, above the platform zone. */
export const CAPTION_LANE = { top: DEVICES.devices.captions.box.top, bottom: CONTENT.bottom } as const;

/** Space for headline text: between the safe top and the caption lane, minus room for the kicker line. */
export const TITLE_LANE = {
  width: CONTENT.width,
  height: CAPTION_LANE.top - SAFE.top - 140,
} as const;

/** Space for stacked kinetic lines: safe top to the caption lane, minus breathing room. */
export const KINETIC_LANE = {
  width: CONTENT.width,
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
export const MAP_BOX = { left: CONTENT.left, right: CONTENT.right, top: 300, bottom: CAPTION_LANE.top - 40 } as const;

const YC = DEVICES.devices.year_counter;
/** Where content may start under the year counter: its number, gap and rule, plus breathing room. */
export const YEAR_CONTENT_TOP = YC.y + YC.number.size + YC.rule.gap + YC.rule.height + 45;

/** Text lanes for a scene, shortened from the top when the year counter is showing. */
export function lanesFor(hasYear: boolean) {
  const top = hasYear ? YEAR_CONTENT_TOP : SAFE.top;
  const cut = top - SAFE.top;
  return {
    top,
    title: { ...TITLE_LANE, height: TITLE_LANE.height - cut },
    kinetic: { ...KINETIC_LANE, height: KINETIC_LANE.height - cut },
    quote: { ...QUOTE_LANE, height: QUOTE_LANE.height - cut },
  };
}
