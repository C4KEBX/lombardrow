/**
 * Average advance width per character, in em, measured from the bundled woff2 files.
 * Libre Caslon Text 400: lowercase 0.54, digits 0.56, capitals 0.74; 0.62 covers capital-heavy headlines.
 * Inter 600: digits 0.61 (tabular), "$" 0.65, "%" 1.00; 0.68 covers a mixed figure like "$1,234%".
 */
export const DISPLAY_CHAR_WIDTH_EM = 0.62;
export const NUMBER_CHAR_WIDTH_EM = 0.68;

export function fitFontSize(
  text: string,
  maxWidthPx: number,
  maxSizePx: number,
  charWidthEm = NUMBER_CHAR_WIDTH_EM,
): number {
  if (maxWidthPx <= 0 || maxSizePx <= 0) throw new RangeError("maxWidthPx and maxSizePx must be positive");
  const chars = Math.max(1, text.length);
  return Math.min(maxSizePx, Math.floor(maxWidthPx / (chars * charWidthEm)));
}

export function formatNumber(value: number, decimals: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: "negative", // no sign when the rounded result is zero
  });
}

export const TITLE_MIN_SIZE_PX = 64;
const TITLE_LINE_HEIGHT = 1.02;
export const TITLE_WORD_GAP_EM = 0.15;
/** Quotes render a roomier gap than headlines; the fit check and the renderer both use it. */
export const QUOTE_WORD_GAP_EM = 0.22;

/** Largest even font size (<= maxSizePx) at which the wrapped headline fits the lane; throws if none. */
export function fitTitleFontSize(
  headline: string,
  laneWidthPx: number,
  laneHeightPx: number,
  maxSizePx: number,
  charWidthEm = DISPLAY_CHAR_WIDTH_EM,
  wordGapEm = TITLE_WORD_GAP_EM,
): number {
  const words = headline.split(/\s+/).filter(Boolean);
  for (let size = maxSizePx; size >= TITLE_MIN_SIZE_PX; size -= 2) {
    const widthOf = (word: string) => word.length * size * charWidthEm;
    if (words.some((word) => widthOf(word) > laneWidthPx)) continue;
    const gap = size * wordGapEm;
    let lines = 1;
    let lineWidth = 0;
    for (const word of words) {
      const w = widthOf(word);
      if (lineWidth === 0) lineWidth = w;
      else if (lineWidth + gap + w <= laneWidthPx) lineWidth += gap + w;
      else {
        lines += 1;
        lineWidth = w;
      }
    }
    if (lines * size * TITLE_LINE_HEIGHT <= laneHeightPx) return size;
  }
  throw new RangeError(`Headline "${headline}" cannot fit the title lane at ${TITLE_MIN_SIZE_PX}px or larger`);
}

/** Display form of a historical year: negative years are BC, years below 1000 are AD-prefixed. */
export function formatYear(year: number): string {
  if (year < 0) return `${-year} BC`;
  return year < 1000 ? `AD ${year}` : String(year);
}
