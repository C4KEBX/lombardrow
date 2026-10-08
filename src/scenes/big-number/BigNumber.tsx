import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BODY_FONT, DISPLAY_FONT } from "../../design/fonts";
import { fitFontSize, formatNumber } from "../../design/layout";
import { countUp, dataProgress, popIn, staggerDelay, sustainDrift } from "../../design/motion";
import { CAPTION_LANE, PALETTE, SAFE, VIDEO } from "../../design/tokens";
import type { BigNumberProps } from "../../schema/storyboard";
import type { SceneRenderProps } from "../types";

/** Card padding (112) + offset block (28) + rotation allowance (60) are kept inside the side gutters. */
const NUMBER_LANE_PX = VIDEO.width - 2 * SAFE.side - 200;

const render = (p: BigNumberProps, value: number) =>
  `${p.prefix}${formatNumber(value, p.decimals)}${p.suffix}`;

export const BigNumber: React.FC<SceneRenderProps<BigNumberProps>> = ({ props, cues, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tone = PALETTE[props.tone];

  const progress = dataProgress(frame, 6, 45);
  const shown = progress >= 1 ? props.value : countUp(props.value, progress, props.decimals);
  const text = render(props, shown);
  const size = fitFontSize(render(props, props.value), NUMBER_LANE_PX, 340);

  const block = popIn(frame, fps, 0);
  const numIn = popIn(frame, fps, staggerDelay(1));
  const labelIn = popIn(frame, fps, staggerDelay(2));
  const exit = interpolate(frame, [durationFrames - 8, durationFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const drift = sustainDrift(frame, 10, 90);
  const callout = cues.find((c) => c.do === "callout" && c.text);
  const calloutIn = callout ? popIn(frame, fps, callout.frame) : 0;

  return (
    <AbsoluteFill
      style={{
        background: PALETTE.ground,
        opacity: exit,
        justifyContent: "center",
        alignItems: "center",
        padding: `${SAFE.top}px ${SAFE.side}px ${VIDEO.height - CAPTION_LANE.top}px`,
      }}
    >
      <div style={{ position: "relative", transform: `translateY(${drift}px)` }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: tone,
            transform: `translate(28px, 28px) rotate(-3deg) scale(${block})`,
          }}
        />
        <div
          style={{
            position: "relative",
            background: PALETTE.ink,
            padding: "40px 56px",
            transform: `rotate(-3deg) scale(${block})`,
          }}
        >
          <div
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: size,
              lineHeight: 1,
              color: PALETTE.ground,
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
              transform: `scale(${numIn})`,
            }}
          >
            {text}
          </div>
        </div>
        {callout && (
          <div
            style={{
              position: "absolute",
              top: -90,
              right: -20,
              background: tone,
              color: PALETTE.ground,
              fontFamily: DISPLAY_FONT,
              fontSize: 56,
              padding: "14px 30px",
              transform: `rotate(5deg) scale(${calloutIn})`,
            }}
          >
            {callout.text}
          </div>
        )}
      </div>
      <div
        style={{
          marginTop: 110,
          fontFamily: BODY_FONT,
          fontSize: 54,
          color: PALETTE.ink,
          textAlign: "center",
          transform: `scale(${labelIn})`,
        }}
      >
        {props.label}
      </div>
    </AbsoluteFill>
  );
};
