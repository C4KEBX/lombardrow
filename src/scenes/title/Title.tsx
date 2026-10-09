import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BODY_FONT, DISPLAY_FONT, TABULAR } from "../../design/fonts";
import { fitTitleFontSize } from "../../design/layout";
import { dataProgress, popIn, staggerDelay, sustainDrift } from "../../design/motion";
import { useTheme } from "../../design/theme";
import { CAPTION_LANE, DOOR_HEADER_PX, SAFE, VIDEO, lanesFor } from "../../design/tokens";
import { doorLabelText } from "../../devices/label";
import { TITLE_MAX_FONT_PX } from "../../schema/validate";
import type { TitleProps } from "../../schema/storyboard";
import type { SceneRenderProps } from "../types";

export type DoorHeader = { doorNo: number; series: string };

/** Frames before the headline starts landing. The opening card starts mid-landing so frame 0 already reads. */
const HEADLINE_DELAY = { opener: -6, section: 6 } as const;
const WORD_GAP = { opener: 2, section: 4 } as const;
const MASTHEAD_GAP = 64;
const DOOR_NO_PX = 96;

/** Series label size that fits beside the door number: 30 px, smaller only for a long series name. */
function seriesFontSize(series: string, laneWidth: number): number {
  const doorWidth = "No. 000".length * DOOR_NO_PX * 0.62; // Caslon advance, as in the device bounds check
  const perPx = series.length * (0.56 + 0.28); // Inter advance plus tracking, in em
  return Math.min(30, Math.floor((laneWidth - doorWidth - 32) / perPx));
}

/**
 * Kicker in tracked capitals, a Caslon headline landing word by word, then a Brass rule drawing under it.
 * The video's first scene also carries the door number and series as a masthead, on screen from frame 0.
 */
export const Title: React.FC<SceneRenderProps<TitleProps> & { door?: DoorHeader }> = ({ props, durationFrames, year, door }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const words = props.headline.split(/\s+/);
  const lanes = lanesFor(year !== undefined);
  const fontSize = fitTitleFontSize(props.headline, lanes.title.width, lanes.title.height - (door ? DOOR_HEADER_PX : 0), TITLE_MAX_FONT_PX);
  const delay = door ? HEADLINE_DELAY.opener : HEADLINE_DELAY.section;
  const gap = door ? WORD_GAP.opener : WORD_GAP.section;
  const exit = interpolate(frame, [durationFrames - 8, durationFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const kickerIn = door ? 1 : Math.min(1, popIn(frame, fps, 0));
  const drift = sustainDrift(frame, 8, 80);
  const rule = dataProgress(frame, delay + staggerDelay(words.length, gap), door ? 12 : 18);

  return (
    <AbsoluteFill
      style={{
        background: theme.ground,
        opacity: exit,
        justifyContent: "center",
        padding: `${lanes.top}px ${SAFE.right}px ${VIDEO.height - CAPTION_LANE.top}px ${SAFE.left}px`,
      }}
    >
      {door && (
        <div style={{ height: DOOR_HEADER_PX - MASTHEAD_GAP, marginBottom: MASTHEAD_GAP, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", paddingBottom: 22 }}>
            <div style={{ fontFamily: DISPLAY_FONT, fontSize: DOOR_NO_PX, lineHeight: 1, color: theme.accent, ...TABULAR }}>
              No. {doorLabelText(door.doorNo)}
            </div>
            <div
              style={{
                fontFamily: BODY_FONT, fontWeight: 500, fontSize: seriesFontSize(door.series, lanes.title.width), letterSpacing: "0.28em",
                textTransform: "uppercase", color: theme.muted,
              }}
            >
              {door.series}
            </div>
          </div>
          <div style={{ height: 2, background: theme.axis }} />
        </div>
      )}
      {props.kicker && (
        <div
          style={{
            fontFamily: BODY_FONT,
            fontWeight: 500,
            fontSize: 32,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: theme.muted,
            opacity: kickerIn,
            marginBottom: 36,
          }}
        >
          {props.kicker}
        </div>
      )}
      <div style={{ transform: `translateY(${drift}px)` }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: `0 ${Math.round(fontSize * 0.15)}px` }}>
          {words.map((word, i) => {
            const p = Math.min(1, popIn(frame, fps, delay + staggerDelay(i, gap)));
            return (
              <span
                key={`${word}-${i}`}
                style={{
                  fontFamily: DISPLAY_FONT,
                  fontSize,
                  lineHeight: 1.02,
                  color: theme.ink,
                  display: "inline-block",
                  opacity: p,
                  transform: `translateY(${(1 - p) * 24}px)`,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
        <div
          style={{
            width: 220, height: 6, marginTop: 40, background: theme.accent,
            transform: `scaleX(${rule})`, transformOrigin: "left center",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
