export const QUOTE = { start: 6, wordGap: 3, attrLead: 10, settle: 18 } as const;

/** Frames until the last word has landed, the attribution rule has drawn and everything has settled. */
export const quoteRevealFrames = (wordCount: number): number =>
  QUOTE.start + (wordCount - 1) * QUOTE.wordGap + QUOTE.attrLead + QUOTE.settle;
