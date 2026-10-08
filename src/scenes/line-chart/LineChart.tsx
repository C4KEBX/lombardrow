import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { scaleLinear } from "d3-scale";
import { area as d3area, curveMonotoneX, line as d3line } from "d3-shape";
import { CalloutBadge } from "../../charts/CalloutBadge";
import {
  cursorX, decimalsForStep, niceTicks, pointOnPathAtX, valueAtX, yDomainAt,
  type DataPoint, type Domain,
} from "../../charts/geometry";
import { TICK_FONT_PX, badgeRect, overlaps, tickLabelRect } from "../../charts/labels";
import { CHART_BOX, placeBadge, readoutFontSize } from "../../charts/layout";
import { scheduleProgress } from "../../charts/schedule";
import { EXIT_FRAMES, LINE_DRAW, drawPlan } from "../../charts/timing";
import { BODY_FONT, NUMBER_FONT, TABULAR } from "../../design/fonts";
import { formatNumber } from "../../design/layout";
import { popIn, staggerDelay, sustainDrift } from "../../design/motion";
import { useTheme } from "../../design/theme";
import { CONTENT, SAFE, VIDEO } from "../../design/tokens";
import type { LineChartProps } from "../../schema/storyboard";
import type { SceneRenderProps } from "../types";

const LINE_WIDTH = 8;

export const LineChart: React.FC<SceneRenderProps<LineChartProps>> = ({ props, cues, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const tone = theme.tone[props.tone];
  const { points } = props;

  const calloutCues = cues.filter((c) => c.do === "callout" && c.text !== undefined && c.x !== undefined);
  const plan = drawPlan(
    calloutCues.map((c) => ({ frame: c.frame, x: c.x as number })),
    points,
    durationFrames,
  );
  const progress = scheduleProgress(frame, plan.knots);
  const cx = cursorX(points, progress);
  const xDomain: Domain = [points[0].x, points[points.length - 1].x];
  const yDomain = yDomainAt(points, progress, props.baseline);
  const sx = scaleLinear().domain([xDomain[0], xDomain[1]]).range([CHART_BOX.left, CHART_BOX.right]);
  const sy = scaleLinear().domain([yDomain[0], yDomain[1]]).range([CHART_BOX.bottom, CHART_BOX.top]);
  const toX = (d: DataPoint) => sx(d.x);
  const toY = (d: DataPoint) => sy(d.y);
  const linePath = d3line<DataPoint>().x(toX).y(toY).curve(curveMonotoneX)(points) ?? "";
  const zeroY = sy(Math.min(Math.max(0, yDomain[0]), yDomain[1]));
  const areaBase = props.baseline === "zero" ? zeroY : CHART_BOX.bottom;
  const areaPath = d3area<DataPoint>().x(toX).y0(areaBase).y1(toY).curve(curveMonotoneX)(points) ?? "";
  const tip = pointOnPathAtX(linePath, sx(cx));

  const fmt = (v: number, decimals: number) => `${props.prefix}${formatNumber(v, decimals)}${props.suffix}`;
  const readout = fmt(valueAtX(points, cx), props.decimals);
  const readoutSize = readoutFontSize(
    points.map((p) => p.y),
    (v) => fmt(v, props.decimals),
    CONTENT.width,
    200,
  );

  const yTicks = niceTicks(yDomain, 4);
  const yTickDecimals = decimalsForStep(yTicks.length > 1 ? yTicks[1] - yTicks[0] : 1);
  const rawXTicks = niceTicks(xDomain, 5);
  const xTicks = props.xFormat === "year" ? rawXTicks.filter(Number.isInteger) : rawXTicks;
  const xTickDecimals =
    props.xFormat === "year" ? 0 : decimalsForStep(rawXTicks.length > 1 ? rawXTicks[1] - rawXTicks[0] : 1);
  const xLabel = (t: number) => (props.xFormat === "year" ? String(t) : formatNumber(t, xTickDecimals));

  const callouts = calloutCues.map((c, i) => {
    const ax = sx(c.x as number);
    const ay = sy(valueAtX(points, c.x as number));
    return { c, appear: plan.appear[i], ax, ay, badge: placeBadge(ax, ay, c.text as string) };
  });
  const shown = callouts.filter((k) => frame >= k.appear);
  const covered = shown.map((k) => badgeRect(k.badge));

  const titleIn = Math.min(1, popIn(frame, fps, 0));
  const dotIn = Math.min(1, popIn(frame, fps, LINE_DRAW.start));
  const exit = interpolate(frame, [durationFrames - EXIT_FRAMES, durationFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: theme.ground, opacity: exit }}>
      <div style={{ position: "absolute", left: CONTENT.left, top: SAFE.top, width: CONTENT.width }}>
        <div
          style={{
            fontFamily: BODY_FONT, fontWeight: 600, fontSize: 44, color: theme.muted,
            opacity: titleIn,
          }}
        >
          {props.title}
        </div>
        <div
          style={{
            fontFamily: NUMBER_FONT, fontWeight: 600, fontSize: readoutSize, lineHeight: 1.05,
            color: theme.toneText[props.tone], whiteSpace: "nowrap", marginTop: 20, ...TABULAR,
          }}
        >
          {readout}
        </div>
      </div>

      <svg width={VIDEO.width} height={VIDEO.height} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <clipPath id="line-reveal">
            <rect x={0} y={0} width={sx(cx)} height={VIDEO.height} />
          </clipPath>
        </defs>

        {yTicks.map((t, i) => {
          const y = sy(t);
          const fade =
            Math.min(1, Math.max(0, (y - CHART_BOX.top) / 60)) * Math.min(1, popIn(frame, fps, staggerDelay(i, 3)));
          return (
            <line
              key={t} x1={CHART_BOX.left} x2={CHART_BOX.right} y1={y} y2={y} opacity={fade}
              stroke={theme.axis} strokeOpacity={0.12} strokeWidth={2}
            />
          );
        })}
        <line
          x1={CHART_BOX.left} x2={CHART_BOX.right} y1={CHART_BOX.bottom} y2={CHART_BOX.bottom}
          stroke={theme.axis} strokeWidth={4}
        />
        {xTicks.map((t) => (
          <text
            key={t} x={sx(t)} y={CHART_BOX.bottom + 56} textAnchor="middle"
            fontFamily={BODY_FONT} fontSize={TICK_FONT_PX} fill={theme.muted}
          >
            {xLabel(t)}
          </text>
        ))}

        {yDomain[0] < 0 && yDomain[1] > 0 && (
          <line
            x1={CHART_BOX.left} x2={CHART_BOX.right} y1={zeroY} y2={zeroY}
            stroke={theme.axis} strokeOpacity={0.5} strokeWidth={3}
          />
        )}
        <g clipPath="url(#line-reveal)">
          <path d={areaPath} fill={tone} fillOpacity={0.12} />
          <path d={linePath} fill="none" stroke={tone} strokeWidth={LINE_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {yTicks.map((t, i) => {
          const y = sy(t);
          const text = fmt(t, yTickDecimals);
          if (covered.some((r) => overlaps(r, tickLabelRect(y, text)))) return null;
          const fade =
            Math.min(1, Math.max(0, (y - CHART_BOX.top) / 60)) * Math.min(1, popIn(frame, fps, staggerDelay(i, 3)));
          return (
            <text
              key={t} x={CHART_BOX.left} y={y - 12} opacity={fade}
              fontFamily={BODY_FONT} fontSize={TICK_FONT_PX} fill={theme.muted}
              style={TABULAR} stroke={theme.ground} strokeWidth={10} paintOrder="stroke" strokeLinejoin="round"
            >
              {text}
            </text>
          );
        })}

        <g transform={`translate(${tip.x} ${tip.y})`} opacity={dotIn}>
          <circle r={28 + sustainDrift(frame, 6, 30)} fill="none" stroke={tone} strokeWidth={4} strokeOpacity={0.5} />
          <circle r={12} fill={tone} />
        </g>

        {shown.map(({ c, appear, ax, ay, badge }) => (
          <CalloutBadge
            key={`${c.frame}-${c.x}`} badge={badge} text={c.text as string}
            anchorX={ax} anchorY={ay} scale={popIn(frame, fps, appear)} color={tone}
          />
        ))}
      </svg>
    </AbsoluteFill>
  );
};
