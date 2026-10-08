import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { scheduleProgress } from "../../charts/schedule";
import { EXIT_FRAMES } from "../../charts/timing";
import { BODY_FONT, DISPLAY_FONT } from "../../design/fonts";
import { formatYear } from "../../design/layout";
import { popIn, sustainDrift } from "../../design/motion";
import { useTheme } from "../../design/theme";
import { CONTENT, SAFE, VIDEO } from "../../design/tokens";
import type { TimelineProps } from "../../schema/storyboard";
import type { SceneRenderProps } from "../types";
import { TIMELINE_LAYOUT, timelineRowY } from "./layout";
import { TIMELINE, eventCueFramesFor, timelinePlan } from "./timing";

/** A vertical rule that draws down to each event as it is spoken; the newest event is bright, older ones dim. */
export const Timeline: React.FC<SceneRenderProps<TimelineProps>> = ({ props, cues, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const tone = theme.tone[props.tone];
  const toneText = theme.toneText[props.tone];
  const { events } = props;
  const n = events.length;
  const plan = timelinePlan(eventCueFramesFor(events, cues), durationFrames);
  const progress = scheduleProgress(frame, plan.knots);
  const topY = timelineRowY(0, n);
  const tipY = topY + progress * (timelineRowY(n - 1, n) - topY);
  const { spineX } = TIMELINE_LAYOUT;
  const titleIn = Math.min(1, popIn(frame, fps, 0));
  const tipIn = Math.min(1, popIn(frame, fps, TIMELINE.start));
  const exit = interpolate(frame, [durationFrames - EXIT_FRAMES, durationFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: theme.ground, opacity: exit }}>
      <svg width={VIDEO.width} height={VIDEO.height} style={{ position: "absolute", inset: 0 }}>
        <text x={CONTENT.left} y={SAFE.top + 44} fontFamily={BODY_FONT} fontWeight={600} fontSize={44} fill={theme.muted} fillOpacity={titleIn}>
          {props.title}
        </text>
        <line x1={spineX} x2={spineX} y1={topY} y2={timelineRowY(n - 1, n)} stroke={theme.axis} strokeOpacity={0.2} strokeWidth={4} />
        <line x1={spineX} x2={spineX} y1={topY} y2={tipY} stroke={tone} strokeWidth={4} />
        {events.map((event, i) => {
          const y = timelineRowY(i, n);
          const pop = Math.min(1, popIn(frame, fps, plan.frames[i]));
          const older = i < n - 1 && frame >= plan.frames[i + 1];
          return (
            <g key={`${event.year}-${event.label}`} opacity={pop * (older ? 0.55 : 1)} transform={`translate(${(1 - pop) * 30} 0)`}>
              <circle cx={spineX} cy={y} r={16 * pop} fill={theme.ground} stroke={tone} strokeWidth={4} />
              <circle cx={spineX} cy={y} r={7 * pop} fill={tone} />
              <text x={spineX + 56} y={y + 8} fontFamily={DISPLAY_FONT} fontSize={72} fill={toneText} style={{ fontVariantNumeric: "lining-nums" }}>
                {formatYear(event.year)}
              </text>
              <text x={spineX + 56} y={y + 62} fontFamily={BODY_FONT} fontWeight={600} fontSize={40} fill={theme.ink}>
                {event.label}
              </text>
            </g>
          );
        })}
        <g transform={`translate(${spineX} ${tipY})`} opacity={tipIn}>
          <circle r={28 + sustainDrift(frame, 6, 30)} fill="none" stroke={tone} strokeWidth={4} strokeOpacity={0.5} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
