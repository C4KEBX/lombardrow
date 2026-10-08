import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { CalloutBadge } from "../../charts/CalloutBadge";
import { CHART_BOX, placeBadge } from "../../charts/layout";
import { raceStateAt } from "../../charts/race";
import { EXIT_FRAMES, RACE_RUN, raceRunFrames } from "../../charts/timing";
import { BODY_FONT, DISPLAY_FONT } from "../../design/fonts";
import { fitFontSize, formatNumber } from "../../design/layout";
import { dataProgress, popIn } from "../../design/motion";
import { CAPTION_LANE, CATEGORICAL, PALETTE, SAFE, VIDEO } from "../../design/tokens";
import type { BarRaceProps } from "../../schema/storyboard";
import type { SceneRenderProps } from "../types";

const BARS_TOP = 640;
const BARS_BOTTOM = CAPTION_LANE.top - 24;
const MAX_PITCH = 170;
const NAME_ROW = 36;
const VALUE_ROOM = 300;
const MAX_BAR_WIDTH = CHART_BOX.right - CHART_BOX.left - VALUE_ROOM;

export const BarRace: React.FC<SceneRenderProps<BarRaceProps>> = ({ props, cues, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tone = PALETTE.highlight;
  const n = props.frames.length;

  const progress = dataProgress(frame, RACE_RUN.start, raceRunFrames(durationFrames));
  const state = raceStateAt(props.frames, (n - 1) * progress, props.topN);
  const grow = dataProgress(frame, 0, 18);

  const pitch = Math.min(MAX_PITCH, (BARS_BOTTOM - BARS_TOP) / props.topN);
  const barH = pitch - NAME_ROW - 14;
  const fmt = (v: number) => `${props.prefix}${formatNumber(v, props.decimals)}${props.suffix}`;
  const maxValue = Math.max(...props.frames.flatMap((f) => f.values.map((v) => v.value)));
  const valueFont = fitFontSize(fmt(maxValue), VALUE_ROOM - 16, barH * 0.5);

  const titleIn = Math.min(1, popIn(frame, fps, 0));
  const exit = interpolate(frame, [durationFrames - EXIT_FRAMES, durationFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const leader = state.bars[0];
  const callout = cues.find((c) => c.do === "callout" && c.text !== undefined);
  const calloutNode = (() => {
    if (!callout || !leader || frame < callout.frame) return null;
    const w = Math.max(0, (leader.value / state.axisMax) * MAX_BAR_WIDTH * grow);
    const ax = CHART_BOX.left + w;
    const ay = BARS_TOP + leader.rank * pitch + NAME_ROW + barH / 2;
    return (
      <CalloutBadge
        badge={placeBadge(ax, ay, callout.text as string, SAFE.top + 160)} text={callout.text as string}
        anchorX={ax} anchorY={ay} scale={popIn(frame, fps, callout.frame)} color={tone}
      />
    );
  })();

  return (
    <AbsoluteFill style={{ background: PALETTE.ground, opacity: exit }}>
      <div
        style={{
          position: "absolute", left: SAFE.side, top: SAFE.top,
          fontFamily: BODY_FONT, fontSize: 52, color: PALETTE.ink, opacity: 0.85,
          transform: `scale(${titleIn})`, transformOrigin: "left center",
        }}
      >
        {props.title}
      </div>

      <svg width={VIDEO.width} height={VIDEO.height} style={{ position: "absolute", inset: 0 }}>
        <text
          x={CHART_BOX.right} y={BARS_TOP + props.topN * pitch - 20} textAnchor="end"
          fontFamily={DISPLAY_FONT} fontSize={260} fill={PALETTE.ink} fillOpacity={0.1}
        >
          {state.label}
        </text>

        {state.bars.map((bar) => {
          const w = Math.max(0, (bar.value / state.axisMax) * MAX_BAR_WIDTH * grow);
          const color = CATEGORICAL[bar.colorIndex % CATEGORICAL.length];
          return (
            <g key={bar.name} opacity={bar.opacity} transform={`translate(${CHART_BOX.left} ${BARS_TOP + bar.rank * pitch})`}>
              <rect x={8} y={NAME_ROW + 8} width={w} height={barH} fill={PALETTE.ink} fillOpacity={0.16} />
              <rect y={NAME_ROW} width={w} height={barH} fill={color} />
            </g>
          );
        })}
        {state.bars.map((bar) => {
          const w = Math.max(0, (bar.value / state.axisMax) * MAX_BAR_WIDTH * grow);
          const halo = { stroke: PALETTE.ground, strokeWidth: 10, paintOrder: "stroke", strokeLinejoin: "round" } as const;
          return (
            <g key={`${bar.name}-label`} opacity={bar.opacity} transform={`translate(${CHART_BOX.left} ${BARS_TOP + bar.rank * pitch})`}>
              <text y={30} fontFamily={BODY_FONT} fontSize={38} fill={PALETTE.ink} {...halo}>
                {bar.name}
              </text>
              {bar.present >= 0.999 && (
                <text
                  x={w + 16} y={NAME_ROW + barH * 0.68}
                  fontFamily={DISPLAY_FONT} fontSize={valueFont} fill={PALETTE.ink} {...halo}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {fmt(bar.value)}
                </text>
              )}
            </g>
          );
        })}
        {calloutNode}
      </svg>
    </AbsoluteFill>
  );
};
