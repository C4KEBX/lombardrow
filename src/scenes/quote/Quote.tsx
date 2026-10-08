import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { EXIT_FRAMES } from "../../charts/timing";
import { BODY_FONT, DISPLAY_FONT } from "../../design/fonts";
import { QUOTE_WORD_GAP_EM, fitTitleFontSize } from "../../design/layout";
import { popIn, sustainDrift } from "../../design/motion";
import { CAPTION_LANE, PALETTE, QUOTE_LANE, SAFE, VIDEO } from "../../design/tokens";
import type { QuoteProps } from "../../schema/storyboard";
import type { SceneRenderProps } from "../types";
import { QUOTE } from "./timing";

/** A big flat quote mark, the words landing one by one, then a rule and the attribution. */
export const Quote: React.FC<SceneRenderProps<QuoteProps>> = ({ props, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = props.quote.split(/\s+/).filter(Boolean);
  const size = fitTitleFontSize(props.quote, QUOTE_LANE.width, QUOTE_LANE.height, QUOTE_LANE.maxFont, undefined, QUOTE_WORD_GAP_EM);
  const attrDelay = QUOTE.start + (words.length - 1) * QUOTE.wordGap + QUOTE.attrLead;
  const exit = interpolate(frame, [durationFrames - EXIT_FRAMES, durationFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const markIn = Math.min(1, popIn(frame, fps, 0));
  const attrIn = Math.min(1, popIn(frame, fps, attrDelay));

  return (
    <AbsoluteFill
      style={{
        background: PALETTE.ground, opacity: exit, justifyContent: "center",
        padding: `${SAFE.top}px ${SAFE.side}px ${VIDEO.height - CAPTION_LANE.top}px`,
      }}
    >
      <div style={{ transform: `translateY(${sustainDrift(frame, 6, 90)}px)` }}>
        <div
          style={{
            fontFamily: DISPLAY_FONT, fontSize: 320, lineHeight: 0.8, height: 200, color: PALETTE.highlight,
            transform: `scale(${markIn})`, transformOrigin: "left top",
          }}
        >
          “
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: `0 ${QUOTE_WORD_GAP_EM}em`, fontSize: size, marginTop: 24 }}>
          {words.map((word, i) => {
            const p = Math.min(1, popIn(frame, fps, QUOTE.start + i * QUOTE.wordGap));
            return (
              <span
                key={`${word}-${i}`}
                style={{
                  fontFamily: DISPLAY_FONT, fontSize: size, lineHeight: 1.02, color: PALETTE.ink,
                  opacity: p, transform: `translateY(${(1 - p) * 24}px)`, display: "inline-block",
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
        <div style={{ marginTop: 48, display: "flex", alignItems: "center", gap: 28, opacity: attrIn }}>
          <div style={{ width: 140, height: 8, background: PALETTE.highlight, transform: `scaleX(${attrIn})`, transformOrigin: "left center" }} />
          <div style={{ fontFamily: BODY_FONT, fontSize: 48, color: PALETTE.highlight, whiteSpace: "nowrap" }}>{props.attribution}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
