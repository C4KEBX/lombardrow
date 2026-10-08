import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { geoPath } from "d3-geo";
import { EXIT_FRAMES } from "../../charts/timing";
import { BODY_FONT } from "../../design/fonts";
import { dataProgress, popIn } from "../../design/motion";
import { MAP_BOX, PALETTE, SAFE, VIDEO } from "../../design/tokens";
import { COUNTRY_BY_NAME, visibleCountries } from "../../map/atlas";
import { labelPosition, lerpBbox, projectionFor, visibleBbox, wideBbox, type Bbox } from "../../map/camera";
import type { MapProps } from "../../schema/storyboard";
import type { SceneRenderProps } from "../types";
import { MAP, regionCueFrames } from "./timing";

const HALO = { stroke: PALETTE.ground, strokeWidth: 10, paintOrder: "stroke", strokeLinejoin: "round" } as const;

/** Zooms from a wide view into the focus box while countries light up on their spoken names. */
export const MapScene: React.FC<SceneRenderProps<MapProps>> = ({ props, cues, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tone = PALETTE[props.tone];
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
    <AbsoluteFill style={{ background: PALETTE.ground, opacity: exit }}>
      <svg width={VIDEO.width} height={VIDEO.height} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <clipPath id="map-box">
            <rect x={MAP_BOX.left} y={MAP_BOX.top} width={MAP_BOX.right - MAP_BOX.left} height={MAP_BOX.bottom - MAP_BOX.top} />
          </clipPath>
        </defs>
        <text x={SAFE.side} y={SAFE.top + 52} fontFamily={BODY_FONT} fontSize={52} fill={PALETTE.ink} fillOpacity={0.85 * titleIn}>
          {props.title}
        </text>
        <text x={SAFE.side} y={SAFE.top + 104} fontFamily={BODY_FONT} fontSize={34} fill={PALETTE.ink} fillOpacity={0.5}>
          Modern borders, approximate
        </text>
        <g clipPath="url(#map-box)">
          {countries.map((c) => (
            <path key={c.properties.name} d={path(c) ?? ""} fill={PALETTE.ink} fillOpacity={0.1} stroke={PALETTE.ground} strokeWidth={2} />
          ))}
          {props.regions.map((name, i) => {
            const country = COUNTRY_BY_NAME.get(name);
            const pop = Math.min(1, popIn(frame, fps, reveal[i]));
            if (!country || pop <= 0) return null;
            return <path key={name} d={path(country) ?? ""} fill={tone} fillOpacity={pop} stroke={PALETTE.ground} strokeWidth={2} />;
          })}
          {props.regions.map((name, i) => {
            const country = COUNTRY_BY_NAME.get(name);
            const pop = Math.min(1, popIn(frame, fps, reveal[i]));
            if (!country || pop <= 0) return null;
            const [x, y] = labelPosition(path, country, MAP_BOX);
            return (
              <text
                key={`${name}-label`} x={x} y={y} textAnchor="middle" opacity={pop}
                fontFamily={BODY_FONT} fontSize={38} fill={PALETTE.ink} {...HALO}
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
