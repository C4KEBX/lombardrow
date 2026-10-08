import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import { EXIT_FRAMES } from "../../charts/timing";
import { BODY_FONT } from "../../design/fonts";
import { easeInOutCubic } from "../../design/motion";
import { BRAND, mix, useTheme } from "../../design/theme";
import { CAPTION_LANE, CONTENT, SAFE } from "../../design/tokens";
import type { ArchivalProps } from "../../schema/storyboard";
import type { SceneRenderProps } from "../types";

export const ARCHIVAL_FRAME = { top: 290, bottom: CAPTION_LANE.top - 50 } as const;

/** A public-domain image in a thin Brass frame, panning and zooming slowly across the whole scene. */
export const Archival: React.FC<SceneRenderProps<ArchivalProps> & { src?: string; credit?: string }> = ({ props, durationFrames, src, credit }) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const t = easeInOutCubic(frame / Math.max(1, durationFrames - 1));
  const at = (a: number, b: number) => a + (b - a) * t;
  const x = at(props.from.x, props.to.x);
  const y = at(props.from.y, props.to.y);
  const zoom = at(props.from.zoom, props.to.zoom);
  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const exit = interpolate(frame, [durationFrames - EXIT_FRAMES, durationFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const height = ARCHIVAL_FRAME.bottom - ARCHIVAL_FRAME.top;

  return (
    <AbsoluteFill style={{ background: theme.ground, opacity: exit }}>
      <div style={{ position: "absolute", left: CONTENT.left, top: SAFE.top + 4, fontFamily: BODY_FONT, fontWeight: 600, fontSize: 44, color: theme.muted, opacity: fadeIn }}>
        {props.title}
      </div>
      <div
        style={{
          position: "absolute", left: CONTENT.left, top: ARCHIVAL_FRAME.top, width: CONTENT.width, height,
          overflow: "hidden", outline: `3px solid ${theme.accent}`, outlineOffset: 10, background: mix(BRAND.ledgerInk, BRAND.parchment, 0.85),
          opacity: fadeIn,
        }}
      >
        {src ? (
          <Img
            src={src}
            style={{
              width: "100%", height: "100%", objectFit: "cover", objectPosition: `${x * 100}% ${y * 100}%`,
              transform: `scale(${zoom})`, transformOrigin: `${x * 100}% ${y * 100}%`,
            }}
          />
        ) : null}
        {credit ? (
          <div
            style={{
              position: "absolute", left: 0, right: 0, bottom: 0, padding: "48px 24px 18px",
              background: `linear-gradient(to bottom, transparent, ${mix(BRAND.ledgerInk, BRAND.parchment, 0.9)}cc)`,
              fontFamily: BODY_FONT, fontSize: 24, color: mix(BRAND.parchment, BRAND.ledgerInk, 0.85),
            }}
          >
            {credit}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
