import { DEVICES } from "../design/tokens";

/**
 * The Viral & trending stream (Justin, 2026-10-17): shorter videos on this week's news, numbered T-01, T-02 and so on.
 * They take door numbers from 901 up so they never collide with the main No. 00X series, and every rule keyed to a
 * door number (backdrops, the script score) applies to them as to the newest main videos.
 */
export const TRENDING_FROM_DOOR = 901;
export const isTrending = (doorNo: number): boolean => doorNo >= TRENDING_FROM_DOOR;
export const trendingNo = (doorNo: number): number => doorNo - TRENDING_FROM_DOOR + 1;

/** Three-digit door number: 4 -> "004". A trending door reads T-01: 901 -> "T-01". */
export const doorLabelText = (doorNo: number): string =>
  isTrending(doorNo)
    ? `T-${String(trendingNo(doorNo)).padStart(2, "0")}`
    : String(doorNo).padStart(DEVICES.devices.door_plate.number.digits, "0");
