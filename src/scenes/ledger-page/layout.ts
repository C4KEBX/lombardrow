import { CAPTION_LANE, CONTENT } from "../../design/tokens";

/** A ruled page inside the content area; entries on the left, amounts right-aligned in a money column. */
export const LEDGER_LAYOUT = {
  pageTop: 290,
  pageBottom: CAPTION_LANE.top - 50,
  pageLeft: CONTENT.left,
  pageRight: CONTENT.right,
  firstRow: 430,
  pitch: 132,
  entryX: CONTENT.left + 48,
  moneyRuleX: CONTENT.right - 260,
  amountX: CONTENT.right - 40,
  entrySize: 44,
  amountSize: 42,
  dateSize: 28,
} as const;

export const ledgerRowY = (i: number): number => LEDGER_LAYOUT.firstRow + i * LEDGER_LAYOUT.pitch;
