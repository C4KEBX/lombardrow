export const TIMELINE_LAYOUT = { spineX: 130, top: 340, maxPitch: 220, span: 750, rowHeight: 130 } as const;

/** Row spacing: roomy for few events, compressed so six still end above the caption lane. */
export const timelinePitch = (n: number): number => Math.min(TIMELINE_LAYOUT.maxPitch, TIMELINE_LAYOUT.span / (n - 1));

export const timelineRowY = (i: number, n: number): number => TIMELINE_LAYOUT.top + i * timelinePitch(n);
