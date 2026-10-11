import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { DISPLAY_FONT } from "../design/fonts";
import { BRAND } from "../design/theme";
import { CONTENT, OVERLAY_TOP } from "../design/tokens";
import { CORNER_TAG } from "./CornerTag";

/**
 * The bleed open's frame-0 line: the claim burned in over the first image, so a viewer scrolling with the sound off
 * reads the stakes before anything moves (viral review of No. 004, 2026-10-11). It is on screen at frame 0 with no
 * entrance, and leaves just before the corner tag comes in.
 */
export const HOOK_LINE = { size: 74, exitFrames: 8, endFrame: CORNER_TAG.inFrame } as const;

export const HookLine: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [HOOK_LINE.endFrame - HOOK_LINE.exitFrames, HOOK_LINE.endFrame], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: OVERLAY_TOP,
        left: CONTENT.left,
        width: CONTENT.width,
        boxSizing: "border-box",
        padding: "22px 30px 26px",
        background: `${BRAND.ledgerInk}e6`,
        borderLeft: `6px solid ${BRAND.brass}`,
        borderRadius: 8,
        opacity,
        fontFamily: DISPLAY_FONT,
        fontSize: HOOK_LINE.size,
        lineHeight: 1.08,
        color: BRAND.parchment,
        textWrap: "balance",
      }}
    >
      {text}
    </div>
  );
};
