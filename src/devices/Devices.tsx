import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BODY_FONT, DISPLAY_FONT, TABULAR } from "../design/fonts";
import { formatYear } from "../design/layout";
import { clamp01, easeOutCubic } from "../design/motion";
import { BRAND, THEMES, mix, type Ground } from "../design/theme";
import { DEVICES } from "../design/tokens";
import { doorLabelText } from "./label";
import type { StampSpan, YearSpan } from "./tracks";

const D = DEVICES.devices;
const PARCHMENT_72 = mix(BRAND.parchment, BRAND.ledgerInk, 0.72);
const fade = (frame: number, start: number, frames: number) => clamp01((frame - start) / Math.max(1, frames));

const doorLabel = doorLabelText;

/** Top-left Caslon Brass year, counting between scenes, over a short Brass rule. Ledger Ink only. */
export const YearCounter: React.FC<{ spans: readonly YearSpan[] }> = ({ spans }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const span = spans.find((s) => frame >= s.startFrame && frame < s.endFrame);
  if (!span) return null;
  const y = D.year_counter;
  const local = frame - span.startFrame;
  const count = span.from === span.to ? 1 : easeOutCubic(local / (y.motion.count_duration_s * fps));
  let year = Math.round(span.from + (span.to - span.from) * count);
  if (year === 0) year = span.to > 0 ? 1 : -1; // there is no year 0
  const fadeFrames = y.motion.fade_s * fps;
  const opacity =
    (span.fadeIn ? fade(local, 0, fadeFrames) : 1) * (span.fadeOut ? 1 - fade(frame, span.endFrame - fadeFrames, fadeFrames) : 1);
  return (
    <div style={{ position: "absolute", left: y.x, top: y.y, opacity, display: "flex", flexDirection: "column", gap: y.rule.gap }}>
      <div style={{ fontFamily: DISPLAY_FONT, fontSize: y.number.size, lineHeight: 1, color: BRAND.brass, whiteSpace: "nowrap", ...TABULAR }}>
        {formatYear(year)}
      </div>
      <div style={{ width: y.rule.width, height: y.rule.height, background: BRAND.brass }} />
    </div>
  );
};

/** Bottom-left "Source: ..." line, just above the platform zone, shown whenever a number or date is. */
export const SourceStamp: React.FC<{ spans: readonly StampSpan[]; groundAt: (frame: number) => Ground }> = ({ spans, groundAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const span = spans.find((s) => frame >= s.startFrame && frame < s.endFrame);
  if (!span) return null;
  const s = D.source_stamp;
  const f = s.motion.fade_s * fps;
  const opacity = fade(frame, span.startFrame, f) * (1 - fade(frame, span.endFrame - f, f));
  const ground = groundAt(frame);
  const color = ground === "parchment" ? BRAND.slate : ground === "ink" ? PARCHMENT_72 : THEMES.green.muted;
  return (
    <div
      style={{
        position: "absolute", left: s.x, top: s.y, opacity, whiteSpace: "nowrap",
        fontFamily: BODY_FONT, fontWeight: s.weight, fontSize: s.size, lineHeight: 1, color, ...TABULAR,
      }}
    >
      {span.text}
    </div>
  );
};

/** The end card: a Brass-framed door plate with the number, the wordmark and the sign-off line. */
export const DoorPlate: React.FC<{ doorNo: number }> = ({ doorNo }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { plate, label, number, wordmark, motion } = D.door_plate;
  const inT = easeOutCubic(frame / (motion.scale_in.duration_s * fps));
  const scale = interpolate(inT, [0, 1], [motion.scale_in.from, motion.scale_in.to]);
  const markIn = fade(frame, Math.round(0.3 * fps), Math.round(0.3 * fps));
  return (
    <AbsoluteFill style={{ background: BRAND.ledgerInk }}>
      <div
        style={{
          position: "absolute", left: plate.x, top: plate.y, width: plate.width, height: plate.height,
          boxSizing: "border-box", border: `${plate.border}px solid ${BRAND.brass}`, borderRadius: plate.radius,
          padding: plate.inner_inset, opacity: inT, transform: `scale(${scale})`,
        }}
      >
        <div
          style={{
            width: "100%", height: "100%", boxSizing: "border-box",
            border: `${plate.inner_border}px solid ${mix(BRAND.brass, BRAND.ledgerInk, plate.inner_opacity)}`,
            borderRadius: plate.inner_radius, display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: 8,
          }}
        >
          <div
            style={{
              fontFamily: BODY_FONT, fontWeight: label.weight, fontSize: label.size, letterSpacing: `${label.tracking_em}em`,
              marginRight: `-${label.tracking_em}em`, textTransform: "uppercase",
              color: mix(BRAND.parchment, BRAND.ledgerInk, label.opacity),
            }}
          >
            {label.text}
          </div>
          <div style={{ fontFamily: DISPLAY_FONT, fontSize: number.size, lineHeight: 1, color: BRAND.parchment, ...TABULAR }}>
            {doorLabel(doorNo)}
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, top: wordmark.y, width: "100%", display: "flex", justifyContent: "center", opacity: markIn }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 14 }}>
          <div
            style={{
              fontFamily: DISPLAY_FONT, fontSize: wordmark.size, lineHeight: 1, color: BRAND.parchment, whiteSpace: "nowrap",
              letterSpacing: `${wordmark.tracking_em}em`, marginRight: `-${wordmark.tracking_em}em`,
            }}
          >
            LOMBARD ROW
          </div>
          <div style={{ height: wordmark.rule_height, background: BRAND.brass }} />
          <div
            style={{
              fontFamily: BODY_FONT, fontWeight: 500, fontSize: wordmark.signoff_size, textAlign: "center",
              letterSpacing: `${wordmark.signoff_tracking_em}em`, marginRight: `-${wordmark.signoff_tracking_em}em`,
              textTransform: "uppercase", color: mix(BRAND.parchment, BRAND.ledgerInk, 0.86),
            }}
          >
            {wordmark.signoff}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
