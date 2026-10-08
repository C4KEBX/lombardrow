import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BODY_FONT, DISPLAY_FONT } from "../../design/fonts";
import { fitTitleFontSize } from "../../design/layout";
import { dataProgress, popIn, staggerDelay, sustainDrift } from "../../design/motion";
import { useTheme } from "../../design/theme";
import { CAPTION_LANE, SAFE, VIDEO, lanesFor } from "../../design/tokens";
import { TITLE_MAX_FONT_PX } from "../../schema/validate";
import type { TitleProps } from "../../schema/storyboard";
import type { SceneRenderProps } from "../types";

/** Kicker in tracked capitals, a Caslon headline landing word by word, then a Brass rule drawing under it. */
export const Title: React.FC<SceneRenderProps<TitleProps>> = ({ props, durationFrames, year }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const words = props.headline.split(/\s+/);
  const lanes = lanesFor(year !== undefined);
  const fontSize = fitTitleFontSize(props.headline, lanes.title.width, lanes.title.height, TITLE_MAX_FONT_PX);
  const exit = interpolate(frame, [durationFrames - 8, durationFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const kickerIn = Math.min(1, popIn(frame, fps, 0));
  const drift = sustainDrift(frame, 8, 80);
  const rule = dataProgress(frame, 6 + staggerDelay(words.length), 18);

  return (
    <AbsoluteFill
      style={{
        background: theme.ground,
        opacity: exit,
        justifyContent: "center",
        padding: `${lanes.top}px ${SAFE.right}px ${VIDEO.height - CAPTION_LANE.top}px ${SAFE.left}px`,
      }}
    >
      {props.kicker && (
        <div
          style={{
            fontFamily: BODY_FONT,
            fontWeight: 500,
            fontSize: 32,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: theme.muted,
            opacity: kickerIn,
            marginBottom: 36,
          }}
        >
          {props.kicker}
        </div>
      )}
      <div style={{ transform: `translateY(${drift}px)` }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: `0 ${Math.round(fontSize * 0.15)}px` }}>
          {words.map((word, i) => {
            const p = Math.min(1, popIn(frame, fps, 6 + staggerDelay(i)));
            return (
              <span
                key={`${word}-${i}`}
                style={{
                  fontFamily: DISPLAY_FONT,
                  fontSize,
                  lineHeight: 1.02,
                  color: theme.ink,
                  display: "inline-block",
                  opacity: p,
                  transform: `translateY(${(1 - p) * 24}px)`,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
        <div
          style={{
            width: 220, height: 6, marginTop: 40, background: theme.accent,
            transform: `scaleX(${rule})`, transformOrigin: "left center",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
