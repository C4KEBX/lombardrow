import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { BODY_FONT, DISPLAY_FONT, TABULAR } from "../design/fonts";
import { easeOutCubic } from "../design/motion";
import { BRAND } from "../design/theme";
import { CONTENT, SAFE } from "../design/tokens";
import { doorLabelText } from "../devices/label";

/**
 * A bleed open keeps frame one clear: the door number and title come in at 2 s as a small tag in the top-right
 * corner (the year counter owns the top left), hold, then leave. The full title lives on the cover and in the caption.
 */
export const CORNER_TAG = { inFrame: 60, enterFrames: 8, holdFrames: 120, exitFrames: 8, maxWidth: 560 } as const;
export const cornerTagFrames = (): number => CORNER_TAG.inFrame + CORNER_TAG.holdFrames + CORNER_TAG.exitFrames;

export const CornerTag: React.FC<{ doorNo: number; title: string }> = ({ doorNo, title }) => {
  const frame = useCurrentFrame();
  const enter = easeOutCubic((frame - CORNER_TAG.inFrame) / CORNER_TAG.enterFrames);
  const exitStart = CORNER_TAG.inFrame + CORNER_TAG.holdFrames;
  const exit = interpolate(frame, [exitStart, exitStart + CORNER_TAG.exitFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opacity = Math.min(enter, exit);
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: SAFE.top,
        right: SAFE.right,
        maxWidth: Math.min(CORNER_TAG.maxWidth, CONTENT.width),
        padding: "12px 18px 14px",
        background: `${BRAND.ledgerInk}d9`,
        borderLeft: `4px solid ${BRAND.brass}`,
        borderRadius: 6,
        opacity,
        transform: `translateX(${(1 - enter) * 24}px)`,
        textAlign: "left",
      }}
    >
      <div style={{ fontFamily: DISPLAY_FONT, fontSize: 30, lineHeight: 1.1, color: BRAND.brass, ...TABULAR }}>No. {doorLabelText(doorNo)}</div>
      <div style={{ fontFamily: BODY_FONT, fontWeight: 600, fontSize: 28, lineHeight: 1.2, color: BRAND.parchment, marginTop: 4 }}>{title}</div>
    </div>
  );
};
