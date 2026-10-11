import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BODY_FONT, NUMBER_FONT, TABULAR } from "../../design/fonts";
import { fitFontSize, formatNumber } from "../../design/layout";
import { dataProgress, popIn, staggerDelay, sustainDrift } from "../../design/motion";
import { useTheme } from "../../design/theme";
import { CAPTION_LANE, CONTENT, SAFE, VIDEO, lanesFor } from "../../design/tokens";
import type { BigNumberProps } from "../../schema/storyboard";
import type { SceneRenderProps } from "../types";

/** The number spans the content area, less a little air on each side. */
const NUMBER_LANE_PX = CONTENT.width - 40;

const render = (p: BigNumberProps, value: number) =>
  `${p.prefix}${formatNumber(value, p.decimals)}${p.suffix}`;

/** A figure in tabular Inter, popping in at its true value, over a tone rule, the label beneath; a callout lands as a ruled tag. */
export const BigNumber: React.FC<SceneRenderProps<BigNumberProps>> = ({ props, cues, durationFrames, year }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const mark = theme.tone[props.tone];
  const ink = theme.toneText[props.tone];

  // The true figure from the first frame, never a count-up: a paused frame mid-count showed an invented number
  // (No. 004's draft read "€6.87" for €11.35; the same note as compare values, 2026-10-10).
  const text = render(props, props.value);
  const size = fitFontSize(render(props, props.value), NUMBER_LANE_PX, 300);

  const numIn = Math.min(1, popIn(frame, fps, 0));
  const rule = dataProgress(frame, staggerDelay(1), 24);
  const labelIn = Math.min(1, popIn(frame, fps, staggerDelay(2)));
  const exit = interpolate(frame, [durationFrames - 8, durationFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const drift = sustainDrift(frame, 10, 90);
  const callout = cues.find((c) => c.do === "callout" && c.text);
  const calloutIn = callout ? Math.min(1, popIn(frame, fps, callout.frame)) : 0;

  return (
    <AbsoluteFill
      style={{
        background: theme.ground,
        opacity: exit,
        justifyContent: "center",
        alignItems: "center",
        padding: `${lanesFor(year !== undefined).top}px ${SAFE.right}px ${VIDEO.height - CAPTION_LANE.top}px ${SAFE.left}px`,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", transform: `translateY(${drift}px)` }}>
        {callout && (
          <div
            style={{
              fontFamily: BODY_FONT, fontWeight: 600, fontSize: 44, color: theme.ink,
              border: `4px solid ${mark}`, padding: "12px 28px", marginBottom: 48,
              opacity: calloutIn, transform: `translateY(${(1 - calloutIn) * 20}px)`,
            }}
          >
            {callout.text}
          </div>
        )}
        <div
          style={{
            fontFamily: NUMBER_FONT, fontWeight: 600, fontSize: size, lineHeight: 1, color: ink,
            whiteSpace: "nowrap", opacity: numIn, transform: `scale(${0.96 + 0.04 * numIn})`, ...TABULAR,
          }}
        >
          {text}
        </div>
        <div
          style={{
            width: Math.min(NUMBER_LANE_PX, size * 1.6), height: 6, marginTop: 36, background: mark,
            transform: `scaleX(${rule})`,
          }}
        />
        <div
          style={{
            marginTop: 48, fontFamily: BODY_FONT, fontWeight: 600, fontSize: 52, lineHeight: 1.25,
            color: theme.ink, textAlign: "center", opacity: labelIn,
          }}
        >
          {props.label}
        </div>
      </div>
    </AbsoluteFill>
  );
};
