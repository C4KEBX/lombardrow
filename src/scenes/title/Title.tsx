import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BODY_FONT, DISPLAY_FONT } from "../../design/fonts";
import { fitTitleFontSize } from "../../design/layout";
import { popIn, staggerDelay, sustainDrift } from "../../design/motion";
import { CAPTION_LANE, PALETTE, SAFE, TITLE_LANE, VIDEO } from "../../design/tokens";
import { TITLE_MAX_FONT_PX } from "../../schema/validate";
import type { TitleProps } from "../../schema/storyboard";
import type { SceneRenderProps } from "../types";

export const Title: React.FC<SceneRenderProps<TitleProps>> = ({ props, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = props.headline.split(/\s+/);
  const fontSize = fitTitleFontSize(props.headline, TITLE_LANE.width, TITLE_LANE.height, TITLE_MAX_FONT_PX);
  const exit = interpolate(frame, [durationFrames - 8, durationFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const kickerIn = popIn(frame, fps, 0);
  const drift = sustainDrift(frame, 8, 80);

  return (
    <AbsoluteFill
      style={{
        background: PALETTE.ground,
        opacity: exit,
        justifyContent: "center",
        padding: `${SAFE.top}px ${SAFE.side}px ${VIDEO.height - CAPTION_LANE.top}px`,
      }}
    >
      {props.kicker && (
        <div
          style={{
            fontFamily: BODY_FONT,
            fontSize: 44,
            letterSpacing: 8,
            color: PALETTE.highlight,
            transform: `scale(${kickerIn})`,
            transformOrigin: "left center",
            marginBottom: 32,
          }}
        >
          {props.kicker}
        </div>
      )}
      <div style={{ transform: `translateY(${drift}px)`, display: "flex", flexWrap: "wrap", gap: "0 28px" }}>
        {words.map((word, i) => (
          <span
            key={`${word}-${i}`}
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize,
              lineHeight: 1.02,
              color: i % 2 === 0 ? PALETTE.ink : PALETTE.highlight,
              display: "inline-block",
              transform: `scale(${popIn(frame, fps, 6 + staggerDelay(i))})`,
              transformOrigin: "left bottom",
            }}
          >
            {word}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
