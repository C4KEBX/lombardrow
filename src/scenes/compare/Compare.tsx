import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { CalloutBadge } from "../../charts/CalloutBadge";
import { CHART_BOX, placeBadge } from "../../charts/layout";
import { EXIT_FRAMES } from "../../charts/timing";
import { BODY_FONT, DISPLAY_FONT } from "../../design/fonts";
import { fitFontSize, formatNumber } from "../../design/layout";
import { countUp, dataProgress, popIn } from "../../design/motion";
import { PALETTE, SAFE, VIDEO } from "../../design/tokens";
import type { CompareProps } from "../../schema/storyboard";
import type { SceneRenderProps } from "../types";
import { COMPARE, barHeights } from "./layout";

const COLUMN_ROOM = 440;
const SIDE_COLORS = [PALETTE.neutral, PALETTE.highlight] as const;

export const Compare: React.FC<SceneRenderProps<CompareProps>> = ({ props, cues, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
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
        anchorX={ax} anchorY={ay} scale={popIn(frame, fps, callout.frame)} color={SIDE_COLORS[leader]}
      />
    );
  })();

  return (
    <AbsoluteFill style={{ background: PALETTE.ground, opacity: exit }}>
      <svg width={VIDEO.width} height={VIDEO.height} style={{ position: "absolute", inset: 0 }}>
        <text
          x={SAFE.side} y={SAFE.top + 52} fontFamily={BODY_FONT} fontSize={52} fill={PALETTE.ink}
          fillOpacity={0.85 * titleIn}
        >
          {props.title}
        </text>
        <line
          x1={CHART_BOX.left} x2={CHART_BOX.right} y1={COMPARE.baseline} y2={COMPARE.baseline}
          stroke={PALETTE.ink} strokeOpacity={0.35} strokeWidth={4}
        />
        {sides.map((side, i) => {
          const cx = COMPARE.centers[i];
          const h = heights[i] * grows[i];
          return (
            <g key={side.label}>
              <rect x={cx - COMPARE.barWidth / 2 + 10} y={COMPARE.baseline - h + 10} width={COMPARE.barWidth} height={h} fill={PALETTE.ink} fillOpacity={0.16} />
              <rect x={cx - COMPARE.barWidth / 2} y={COMPARE.baseline - h} width={COMPARE.barWidth} height={h} fill={SIDE_COLORS[i]} />
              <text
                x={cx} y={COMPARE.baseline - h - 28} textAnchor="middle"
                fontFamily={DISPLAY_FONT} fontSize={valueFont} fill={PALETTE.ink}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {fmt(countUp(side.value, grows[i], props.decimals))}
              </text>
              <text x={cx} y={COMPARE.labelY} textAnchor="middle" fontFamily={BODY_FONT} fontSize={44} fill={PALETTE.ink}>
                {side.label}
              </text>
            </g>
          );
        })}
        <g transform={`translate(540 ${COMPARE.baseline - 90}) scale(${Math.min(1, popIn(frame, fps, 24))})`}>
          <circle r={54} fill={PALETTE.ink} />
          <text textAnchor="middle" y={16} fontFamily={DISPLAY_FONT} fontSize={48} fill={PALETTE.ground}>VS</text>
        </g>
        {calloutNode}
      </svg>
    </AbsoluteFill>
  );
};
