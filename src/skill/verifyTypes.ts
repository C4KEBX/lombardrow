export type VerifyStatus = "supported" | "partial" | "not-found" | "unreachable" | "blocked";
export type VerifyResult = { factId: string; url: string; status: VerifyStatus; found: string[]; missing: string[]; detail?: string };
