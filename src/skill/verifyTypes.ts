export type VerifyStatus = "supported" | "partial" | "not-found" | "unreachable" | "blocked";
/** The sentence on the source page where a number was found, for the human reviewer. */
export type Evidence = { token: string; sentence: string };
export type VerifyResult = {
  factId: string;
  url: string;
  status: VerifyStatus;
  found: string[];
  missing: string[];
  /** Small whole numbers (under 100) appear on almost any page, so they are never counted as support. */
  unverifiable?: string[];
  evidence?: Evidence[];
  /** A Wayback Machine snapshot of the source, so the evidence survives the page changing. */
  archiveUrl?: string;
  detail?: string;
};
