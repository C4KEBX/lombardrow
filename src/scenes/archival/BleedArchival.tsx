import React from "react";
import { AbsoluteFill, Img, useCurrentFrame } from "remotion";
import { BODY_FONT } from "../../design/fonts";
import { clamp01, easeOutCubic } from "../../design/motion";
import { BRAND } from "../../design/theme";
import { CONTENT, VIDEO } from "../../design/tokens";
import type { ArchivalProps, ArchivalShot } from "../../schema/storyboard";

/** Where a shot's centre sits on the frame: above the middle, so the bold captions below sit on the image, not on the crop's focus. */
export const BLEED_ANCHOR = { x: VIDEO.width / 2, y: 760 } as const;
/**
 * Each cut lands with a punch: the shot starts 18% closer and snaps back over 10 frames, then keeps pushing in
 * (12% over the shot) while drifting sideways, so the open never reads as a still (Justin, 2026-10-10: the cold
 * open moved, "but it's just not dynamic at all").
 */
export const BLEED_MOTION = { push: 0.12, settle: 0.18, settleFrames: 10, driftPx: 40 } as const;
/** The highlighter starts a few frames after the cut and sweeps across the marked words. */
export const BLEED_MARK = { delayFrames: 4, sweepFrames: 14, opacity: 0.5 } as const;

/** Index of the shot showing at `frame`: the last one that has started. */
export function shotAt(shotFrames: readonly number[], frame: number): number {
  let index = 0;
  shotFrames.forEach((start, i) => {
    if (start <= frame) index = i;
  });
  return index;
}

/**
 * Where the image sits for a shot, `t` frames in, lasting `length` frames: its scale and the top-left offset that
 * puts the shot's centre on the anchor.
 */
export function shotTransform(shot: ArchivalShot, size: { width: number; height: number }, t: number, length: number) {
  const base = VIDEO.width / (shot.w * size.width);
  const push = 1 + BLEED_MOTION.push * clamp01(t / Math.max(1, length));
  const settle = 1 + BLEED_MOTION.settle * (1 - easeOutCubic(t / BLEED_MOTION.settleFrames));
  const scale = base * push * settle;
  const drift = BLEED_MOTION.driftPx * (clamp01(t / Math.max(1, length)) - 0.5);
  return { scale, left: BLEED_ANCHOR.x - shot.x * size.width * scale + drift, top: BLEED_ANCHOR.y - shot.y * size.height * scale };
}

/**
 * A public-domain image filling the whole 9:16 frame, cutting between crops on spoken words. Each crop shows
 * a detail at a size a phone can read (a line of type, a face, a figure) and can sweep a highlighter across
 * the words being said.
 */
export const BleedArchival: React.FC<{
  props: ArchivalProps;
  shotFrames: readonly number[];
  durationFrames: number;
  src?: string;
  credit?: string;
  size?: { width: number; height: number };
}> = ({ props, shotFrames, durationFrames, src, credit, size }) => {
  const frame = useCurrentFrame();
  const shots = props.shots ?? [];
  const index = shotAt(shotFrames, frame);
  const shot = shots[index];
  if (!shot || !src || !size) return <AbsoluteFill style={{ background: BRAND.ledgerInk }} />;
  const start = shotFrames[index] ?? 0;
  const end = shotFrames[index + 1] ?? durationFrames;
  const t = frame - start;
  const { scale, left, top } = shotTransform(shot, size, t, end - start);
  const sweep = easeOutCubic((t - BLEED_MARK.delayFrames) / BLEED_MARK.sweepFrames);

  return (
    <AbsoluteFill style={{ background: BRAND.ledgerInk, overflow: "hidden" }}>
      <div style={{ position: "absolute", left, top, width: size.width * scale, height: size.height * scale }}>
        <Img src={src} style={{ width: "100%", height: "100%", display: "block" }} />
        {shot.mark && sweep > 0 ? (
          <div
            style={{
              position: "absolute",
              left: `${shot.mark.x * 100}%`,
              top: `${shot.mark.y * 100}%`,
              width: `${shot.mark.w * 100 * sweep}%`,
              height: `${shot.mark.h * 100}%`,
              background: BRAND.brass,
              opacity: BLEED_MARK.opacity,
              mixBlendMode: "multiply",
              borderRadius: 4,
            }}
          />
        ) : null}
      </div>
      {/* Shade at the top for the corner tag and year, and at the bottom for the captions and source stamp. */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${BRAND.ledgerInk}99 0px, ${BRAND.ledgerInk}00 320px, ${BRAND.ledgerInk}00 1080px, ${BRAND.ledgerInk}cc 1560px)`,
        }}
      />
      {credit ? (
        <div
          style={{
            position: "absolute", right: VIDEO.width - CONTENT.right, top: 1436, maxWidth: CONTENT.width,
            fontFamily: BODY_FONT, fontSize: 22, color: BRAND.parchment, opacity: 0.75, textAlign: "right",
          }}
        >
          {credit}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
