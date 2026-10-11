import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { EXIT_FRAMES } from "../../charts/timing";
import { DISPLAY_FONT } from "../../design/fonts";
import { popIn, sustainDrift } from "../../design/motion";
import { useTheme } from "../../design/theme";
import { CAPTION_LANE, SAFE, VIDEO, lanesFor } from "../../design/tokens";
import { emphasisTarget } from "../../schema/emphasis";
import type { KineticTextProps } from "../../schema/storyboard";
import type { SceneRenderProps } from "../types";
import { KINETIC, kineticFontSize } from "./timing";

/** Stacked Caslon lines slide up out of masks; an emphasize cue draws a tone rule under its word and recolors it. */
export const KineticText: React.FC<SceneRenderProps<KineticTextProps>> = ({ props, cues, durationFrames, year }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const mark = theme.tone[props.tone];
  const ink = theme.toneText[props.tone];
  const lanes = lanesFor(year !== undefined);
  const size = kineticFontSize(props.lines, lanes.kinetic);
  const exit = interpolate(frame, [durationFrames - EXIT_FRAMES, durationFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const emphasis = cues
    .filter((c) => c.do === "emphasize" && c.text !== undefined)
    .flatMap((c) => {
      const target = emphasisTarget(props.lines, c.text as string);
      return target ? [{ cue: c, target }] : [];
    });

  return (
    <AbsoluteFill
      style={{
        background: theme.ground, opacity: exit, justifyContent: "center",
        padding: `${lanes.top}px ${SAFE.right}px ${VIDEO.height - CAPTION_LANE.top}px ${SAFE.left}px`,
      }}
    >
      <div style={{ transform: `translateY(${sustainDrift(frame, 6, 90)}px)` }}>
        {props.lines.map((line, li) => {
          const rise = Math.min(1, popIn(frame, fps, KINETIC.firstDelay + li * KINETIC.lineGap));
          // The mask reaches below the line box so descenders (y, g, p) are not clipped; the negative
          // margin keeps the line spacing as it was.
          const descent = size * KINETIC.descender;
          const maskHeight = size * KINETIC.lineHeight + descent;
          return (
            <div key={`${line}-${li}`} style={{ overflow: "hidden", height: maskHeight, marginBottom: -descent }}>
              <div
                style={{
                  display: "flex", whiteSpace: "nowrap", gap: `0 ${size * 0.18}px`,
                  transform: `translateY(${(1 - rise) * maskHeight * 1.05}px)`,
                }}
              >
                {line.split(/\s+/).filter(Boolean).map((word, wi) => {
                  const hit = emphasis.find((e) => e.target.line === li && e.target.word === wi);
                  const e = hit ? Math.min(1, popIn(frame, fps, hit.cue.frame)) : 0;
                  return (
                    <span
                      key={`${word}-${wi}`}
                      style={{
                        fontFamily: DISPLAY_FONT, fontSize: size, lineHeight: KINETIC.lineHeight,
                        color: e > 0.5 ? ink : theme.ink,
                        backgroundImage: `linear-gradient(${mark}, ${mark})`,
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "0 96%",
                        backgroundSize: `${e * 100}% ${Math.max(6, Math.round(size * 0.06))}px`,
                        padding: `0 ${size * 0.06}px`,
                      }}
                    >
                      {word}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
