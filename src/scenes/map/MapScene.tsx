import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { geoPath } from "d3-geo";
import { EXIT_FRAMES } from "../../charts/timing";
import { BODY_FONT } from "../../design/fonts";
import { dataProgress, popIn } from "../../design/motion";
import { useTheme } from "../../design/theme";
import { CONTENT, MAP_BOX, SAFE, VIDEO } from "../../design/tokens";
import { COUNTRY_BY_NAME, visibleCountries } from "../../map/atlas";
import { labelPosition, lerpBbox, projectionFor, visibleBbox, wideBbox, type Bbox } from "../../map/camera";
import type { MapProps } from "../../schema/storyboard";
import type { SceneRenderProps } from "../types";
import { MAP, regionCueFrames } from "./timing";

/** Zooms from a wide view into the focus box while countries light up on their spoken names. */
export const MapScene: React.FC<SceneRenderProps<MapProps>> = ({ props, cues, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const tone = theme.tone[props.tone];
  const halo = { stroke: theme.ground, strokeWidth: 10, paintOrder: "stroke", strokeLinejoin: "round" } as const;
  const focus = props.focus as unknown as Bbox;
  const zoom = dataProgress(frame, 0, MAP.zoomFrames);
  const projection = projectionFor(lerpBbox(wideBbox(focus), focus, zoom), MAP_BOX);
  const path = geoPath(projection);
  const countries = visibleCountries(visibleBbox(projection, MAP_BOX));
  const reveal = regionCueFrames(props.regions, cues);
  const titleIn = Math.min(1, popIn(frame, fps, 0));
  const exit = interpolate(frame, [durationFrames - EXIT_FRAMES, durationFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: theme.ground, opacity: exit }}>
      <svg width={VIDEO.width} height={VIDEO.height} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <clipPath id="map-box">
            <rect x={MAP_BOX.left} y={MAP_BOX.top} width={MAP_BOX.right - MAP_BOX.left} height={MAP_BOX.bottom - MAP_BOX.top} />
          </clipPath>
        </defs>
        <text x={CONTENT.left} y={SAFE.top + 44} fontFamily={BODY_FONT} fontWeight={600} fontSize={44} fill={theme.muted} fillOpacity={titleIn}>
          {props.title}
        </text>
        <text x={CONTENT.left} y={SAFE.top + 92} fontFamily={BODY_FONT} fontSize={28} fill={theme.muted}>
          Modern borders, approximate
        </text>
        <g clipPath="url(#map-box)">
          {countries.map((c) => (
            <path key={c.properties.name} d={path(c) ?? ""} fill={theme.ink} fillOpacity={0.1} stroke={theme.ground} strokeWidth={2} />
          ))}
          {props.regions.map((name, i) => {
            const country = COUNTRY_BY_NAME.get(name);
            const pop = Math.min(1, popIn(frame, fps, reveal[i]));
            if (!country || pop <= 0) return null;
            return <path key={name} d={path(country) ?? ""} fill={tone} fillOpacity={pop} stroke={theme.ground} strokeWidth={2} />;
          })}
          {props.regions.map((name, i) => {
            const country = COUNTRY_BY_NAME.get(name);
            const pop = Math.min(1, popIn(frame, fps, reveal[i]));
            if (!country || pop <= 0) return null;
            const [x, y] = labelPosition(path, country, MAP_BOX);
            return (
              <text
                key={`${name}-label`} x={x} y={y} textAnchor="middle" opacity={pop}
                fontFamily={BODY_FONT} fontWeight={600} fontSize={34} fill={theme.ink} {...halo}
              >
                {name}
              </text>
            );
          })}
        </g>
      </svg>
    </AbsoluteFill>
  );
};
