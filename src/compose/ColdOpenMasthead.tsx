import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { BODY_FONT, DISPLAY_FONT, TABULAR } from "../design/fonts";
import { fitTitleFontSize } from "../design/layout";
import { easeInOutCubic } from "../design/motion";
import { BRAND } from "../design/theme";
import { COLD_OPEN_HEADLINE, CONTENT, SAFE } from "../design/tokens";
import { doorLabelText } from "../devices/label";

/** A cold open shows its masthead for at most 1.5 s at 30 fps, then gets out of the visual's way. */
export const COLD_OPEN_MASTHEAD_FRAMES = 45;
const EXIT_FRAMES = 10;
/** Ink behind the masthead fades out by this depth, above where scenes put their first content row. */
const BAND_PX = 430;
/** The first scene starts this far into its own entrance, so frame 0 already shows the thing on screen. */
export const COLD_OPEN_PREROLL_FRAMES = 12;
/**
 * Under the masthead the first scene sits lower by the band's depth, drifting in from a slight close-up;
 * as the masthead lifts away the scene rises into its own place, so the two read as one move.
 */
const CAMERA = { fromScale: 1.05, scaleFrames: 75, shiftPx: 290, riseFrom: COLD_OPEN_MASTHEAD_FRAMES - 16, riseFrames: 16 } as const;

/**
 * Door number, series and title laid over the first scene, which is already moving underneath.
 * Ink fades down from the top so the masthead reads, then the whole band lifts away.
 */
export const ColdOpenMasthead: React.FC<{ doorNo: number; series: string; headline: string }> = ({ doorNo, series, headline }) => {
  const frame = useCurrentFrame();
  const exitStart = COLD_OPEN_MASTHEAD_FRAMES - EXIT_FRAMES;
  const out = easeInOutCubic(interpolate(frame, [exitStart, COLD_OPEN_MASTHEAD_FRAMES], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const fontSize = fitTitleFontSize(headline, CONTENT.width, COLD_OPEN_HEADLINE.boxPx, COLD_OPEN_HEADLINE.maxPx);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          opacity: 1 - out,
          background: `linear-gradient(180deg, ${BRAND.ledgerInk} 0px, ${BRAND.ledgerInk} ${BAND_PX - 60}px, ${BRAND.ledgerInk}00 ${BAND_PX}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: SAFE.top,
          left: CONTENT.left,
          width: CONTENT.width,
          opacity: 1 - out,
          transform: `translateY(${-out * 120}px)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", paddingBottom: 12 }}>
          <div style={{ fontFamily: DISPLAY_FONT, fontSize: 56, lineHeight: 1, color: BRAND.brass, ...TABULAR }}>No. {doorLabelText(doorNo)}</div>
          <div style={{ fontFamily: BODY_FONT, fontWeight: 500, fontSize: 22, letterSpacing: "0.28em", textTransform: "uppercase", color: BRAND.parchment }}>
            {series}
          </div>
        </div>
        <div style={{ height: 2, background: BRAND.parchment, marginBottom: 18 }} />
        <div style={{ fontFamily: DISPLAY_FONT, fontSize, lineHeight: 1.04, color: BRAND.parchment, textWrap: "balance" }}>{headline}</div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * Wraps the cold open's first scene: starts it partway into its entrance, holds it below the masthead,
 * then lifts it into place. The scene is drawn with its duration lengthened by the pre-roll, so its exit still
 * lands on the cut.
 */
export const ColdOpenCamera: React.FC<{ children: (prerolledFrames: number) => React.ReactNode; durationFrames: number }> = ({ children, durationFrames }) => {
  const frame = useCurrentFrame();
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
  const zoom = easeInOutCubic(interpolate(frame, [0, CAMERA.scaleFrames], [0, 1], clamp));
  const rise = easeInOutCubic(interpolate(frame, [CAMERA.riseFrom, CAMERA.riseFrom + CAMERA.riseFrames], [0, 1], clamp));
  const scale = CAMERA.fromScale + (1 - CAMERA.fromScale) * zoom;
  return (
    <AbsoluteFill style={{ transform: `translateY(${(1 - rise) * CAMERA.shiftPx}px) scale(${scale})`, transformOrigin: "50% 0%" }}>
      <Sequence from={-COLD_OPEN_PREROLL_FRAMES} durationInFrames={durationFrames + COLD_OPEN_PREROLL_FRAMES} layout="none">
        {children(durationFrames + COLD_OPEN_PREROLL_FRAMES)}
      </Sequence>
    </AbsoluteFill>
  );
};
