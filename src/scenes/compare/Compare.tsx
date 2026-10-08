import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { CalloutBadge } from "../../charts/CalloutBadge";
import { CHART_BOX, placeBadge } from "../../charts/layout";
import { EXIT_FRAMES } from "../../charts/timing";
import { BODY_FONT, DISPLAY_FONT, NUMBER_FONT, TABULAR } from "../../design/fonts";
import { fitFontSize, formatNumber } from "../../design/layout";
import { countUp, dataProgress, popIn } from "../../design/motion";
import { useTheme } from "../../design/theme";
import { CONTENT, SAFE, VIDEO } from "../../design/tokens";
import type { CompareProps } from "../../schema/storyboard";
import type { SceneRenderProps } from "../types";
import { COMPARE, barHeights } from "./layout";

const COLUMN_ROOM = 360;

export const Compare: React.FC<SceneRenderProps<CompareProps>> = ({ props, cues, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  /** The right side carries the accent; the left stays quiet. */
  const sideColors = [theme.tone.neutral, theme.tone.highlight] as const;
  const sides = [props.left, props.right] as const;
  const heights = barHeights(props.left.value, props.right.value);
  const fmt = (v: number) => `${props.prefix}${formatNumber(v, props.decimals)}${props.suffix}`;
  const valueFont = fitFontSize(fmt(Math.max(props.left.value, props.right.value)), COLUMN_ROOM, 130);
  const exit = interpolate(frame, [durationFrames - EXIT_FRAMES, durationFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleIn = Math.min(1, popIn(frame, fps, 0));
  const callout = cues.find((c) => c.do === "callout" && c.text !== undefined);
  const leader = props.left.value >= props.right.value ? 0 : 1;
  const grows = sides.map((_, i) => dataProgress(frame, COMPARE.growStart + i * COMPARE.sideDelay, COMPARE.growFrames));

  const calloutNode = (() => {
    if (!callout || frame < callout.frame) return null;
    const ax = COMPARE.centers[leader];
    const ay = COMPARE.baseline - heights[leader] * grows[leader] - valueFont - 40;
    return (
      <CalloutBadge
        badge={placeBadge(ax, ay, callout.text as string, SAFE.top + 160)} text={callout.text as string}
        anchorX={ax} anchorY={ay} scale={popIn(frame, fps, callout.frame)} color={sideColors[leader]}
      />
    );
  })();

  return (
    <AbsoluteFill style={{ background: theme.ground, opacity: exit }}>
      <svg width={VIDEO.width} height={VIDEO.height} style={{ position: "absolute", inset: 0 }}>
        <text
          x={CONTENT.left} y={SAFE.top + 44} fontFamily={BODY_FONT} fontWeight={600} fontSize={44} fill={theme.muted}
          fillOpacity={titleIn}
        >
          {props.title}
        </text>
        <line
          x1={CHART_BOX.left} x2={CHART_BOX.right} y1={COMPARE.baseline} y2={COMPARE.baseline}
          stroke={theme.axis} strokeWidth={4}
        />
        {sides.map((side, i) => {
          const cx = COMPARE.centers[i];
          const h = heights[i] * grows[i];
          return (
            <g key={side.label}>
              <rect x={cx - COMPARE.barWidth / 2} y={COMPARE.baseline - h} width={COMPARE.barWidth} height={h} fill={sideColors[i]} />
              <text
                x={cx} y={COMPARE.baseline - h - 28} textAnchor="middle"
                fontFamily={NUMBER_FONT} fontWeight={600} fontSize={valueFont} fill={theme.ink}
                style={TABULAR}
              >
                {fmt(countUp(side.value, grows[i], props.decimals))}
              </text>
              <text x={cx} y={COMPARE.labelY} textAnchor="middle" fontFamily={BODY_FONT} fontWeight={600} fontSize={44} fill={theme.ink}>
                {side.label}
              </text>
            </g>
          );
        })}
        <g transform={`translate(${COMPARE.middle} ${COMPARE.baseline - 90}) scale(${Math.min(1, popIn(frame, fps, 24))})`}>
          <circle r={54} fill={theme.ground} stroke={theme.ink} strokeWidth={3} />
          <text textAnchor="middle" y={14} fontFamily={DISPLAY_FONT} fontStyle="italic" fontSize={44} fill={theme.ink}>vs</text>
        </g>
        {calloutNode}
      </svg>
    </AbsoluteFill>
  );
};
