import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { scheduleProgress } from "../../charts/schedule";
import { EXIT_FRAMES } from "../../charts/timing";
import { BODY_FONT } from "../../design/fonts";
import { popIn, sustainDrift } from "../../design/motion";
import { useTheme } from "../../design/theme";
import { CONTENT, SAFE, VIDEO } from "../../design/tokens";
import type { FlowDiagramProps } from "../../schema/storyboard";
import type { SceneRenderProps } from "../types";
import { stepCueFrames, stepPlan } from "../steps/timing";
import { FLOW_LAYOUT, flowStepY } from "./layout";

/** Follow the money: a Brass token travels down a chain of steps, lighting each one as it is spoken. */
export const FlowDiagram: React.FC<SceneRenderProps<FlowDiagramProps>> = ({ props, cues, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const tone = theme.tone[props.tone];
  const toneText = theme.toneText[props.tone];
  const { steps } = props;
  const n = steps.length;
  const plan = stepPlan(stepCueFrames(steps.map((s) => s.label), cues), durationFrames, "step");
  const progress = scheduleProgress(frame, plan.knots);
  const { boxHeight, left, width, label, note, arrowText } = FLOW_LAYOUT;
  const spineX = left + 56;
  const centerY = (i: number) => flowStepY(i, n) + boxHeight / 2;
  const tokenY = centerY(0) + progress * (centerY(n - 1) - centerY(0));
  const titleIn = Math.min(1, popIn(frame, fps, 0));
  const exit = interpolate(frame, [durationFrames - EXIT_FRAMES, durationFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: theme.ground, opacity: exit }}>
      <svg width={VIDEO.width} height={VIDEO.height} style={{ position: "absolute", inset: 0 }}>
        <text x={CONTENT.left} y={SAFE.top + 44} fontFamily={BODY_FONT} fontWeight={600} fontSize={44} fill={theme.muted} fillOpacity={titleIn}>
          {props.title}
        </text>
        {steps.slice(0, -1).map((_, i) => {
          const y1 = flowStepY(i, n) + boxHeight;
          const y2 = flowStepY(i + 1, n);
          const lit = frame >= plan.frames[i + 1];
          const textIn = Math.min(1, popIn(frame, fps, plan.frames[i] + 4));
          return (
            <g key={`arrow-${i}`}>
              <line x1={spineX} x2={spineX} y1={y1 + 6} y2={y2 - 14} stroke={lit ? tone : theme.axis} strokeOpacity={lit ? 1 : 0.3} strokeWidth={4} />
              <path d={`M ${spineX - 12} ${y2 - 22} L ${spineX} ${y2 - 6} L ${spineX + 12} ${y2 - 22}`} fill="none" stroke={lit ? tone : theme.axis} strokeOpacity={lit ? 1 : 0.3} strokeWidth={4} />
              {props.arrows ? (
                <text x={spineX + 36} y={(y1 + y2) / 2 + arrowText * 0.35} fontFamily={BODY_FONT} fontWeight={600} fontSize={arrowText} fill={toneText} fillOpacity={textIn} style={{ fontVariantNumeric: "tabular-nums" }}>
                  {props.arrows[i]}
                </text>
              ) : null}
            </g>
          );
        })}
        {steps.map((step, i) => {
          const y = flowStepY(i, n);
          const reached = Math.min(1, popIn(frame, fps, plan.frames[i]));
          const visible = Math.min(1, popIn(frame, fps, i * 3));
          return (
            <g key={`${step.label}-${i}`} opacity={visible}>
              <rect x={left} y={y} width={width} height={boxHeight} rx={10} fill={tone} fillOpacity={0.1 * reached} stroke={reached > 0.5 ? tone : theme.axis} strokeOpacity={0.3 + 0.7 * reached} strokeWidth={3} />
              <text x={left + 112} y={y + (step.note ? 58 : 80)} fontFamily={BODY_FONT} fontWeight={600} fontSize={label} fill={theme.ink} fillOpacity={0.45 + 0.55 * reached}>
                {step.label}
              </text>
              {step.note ? (
                <text x={left + 112} y={y + 104} fontFamily={BODY_FONT} fontWeight={500} fontSize={note} fill={theme.muted} fillOpacity={0.45 + 0.55 * reached}>
                  {step.note}
                </text>
              ) : null}
            </g>
          );
        })}
        <g transform={`translate(${spineX} ${tokenY})`} opacity={Math.min(1, popIn(frame, fps, plan.knots[0].frame))}>
          <circle r={30 + sustainDrift(frame, 4, 30)} fill="none" stroke={theme.accent} strokeWidth={3} strokeOpacity={0.5} />
          <circle r={20} fill={theme.accent} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
