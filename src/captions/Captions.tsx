import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { BODY_FONT, TABULAR } from "../design/fonts";
import { easeOutCubic } from "../design/motion";
import { BRAND, THEMES, type Ground } from "../design/theme";
import { CAPTION_LANE, CONTENT, DEVICES } from "../design/tokens";
import { activeWordIndex, chunkAt, type CaptionChunk, type CaptionStyle } from "./chunk";

const SPEC = DEVICES.devices.captions;

/**
 * The fast format's captions: Inter 800 at 88 px, one to three words, parchment with an ink outline so they read
 * on any ground or image, centred at y 1300, in the band between the scene and the platform UI. Each chunk lands
 * with a small pop.
 */
export const BOLD_CAPTIONS = { size: 88, weight: 800, lineHeight: 1.08, centerY: 1300, boxHeight: 220, stroke: 12, popFrames: 4 } as const;

/**
 * Parchment with an ink outline over images and the ink ground. On a light ground that outline read as hollow
 * letters on a phone (viral review of No. 004 v2), so there the words are solid ink with no outline.
 */
export function boldColors(ground: Ground): React.CSSProperties {
  if (ground === "ink") return { color: BRAND.parchment, WebkitTextStroke: `${BOLD_CAPTIONS.stroke}px ${BRAND.ledgerInk}`, paintOrder: "stroke fill" };
  return { color: THEMES[ground].ink };
}

/** Ground under the captions at `frame`: the last scene that has started. */
export function groundAt(grounds: readonly { startFrame: number; ground: Ground }[], frame: number): Ground {
  let ground: Ground = grounds[0]?.ground ?? "ink";
  for (const g of grounds) if (g.startFrame <= frame) ground = g.ground;
  return ground;
}

/**
 * Captions per the device spec: Inter 52/600, centered in the content area from y 1250, at most two
 * lines. Words already spoken are full strength and upcoming words dimmed, so no accent color is spent.
 */
export const Captions: React.FC<{
  chunks: CaptionChunk[];
  grounds?: readonly { startFrame: number; ground: Ground }[];
  style?: CaptionStyle;
}> = ({ chunks, grounds = [], style = "lane" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const chunk = chunkAt(chunks, ms);
  if (!chunk) return null;
  const active = activeWordIndex(chunk, ms);
  if (style === "bold") {
    const sinceStart = frame - (chunk.startMs / 1000) * fps;
    const pop = 0.9 + 0.1 * easeOutCubic(sinceStart / BOLD_CAPTIONS.popFrames);
    return (
      <div
        style={{
          position: "absolute", left: CONTENT.left, width: CONTENT.width,
          top: BOLD_CAPTIONS.centerY - BOLD_CAPTIONS.boxHeight / 2, height: BOLD_CAPTIONS.boxHeight,
          display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
          fontFamily: BODY_FONT, fontWeight: BOLD_CAPTIONS.weight, fontSize: BOLD_CAPTIONS.size, lineHeight: BOLD_CAPTIONS.lineHeight,
          ...boldColors(groundAt(grounds, frame)),
          transform: `scale(${pop})`, ...TABULAR,
        }}
      >
        <div>
          {chunk.words.map((word, i) => (
            <span key={`${word.startMs}-${i}`} style={{ opacity: i <= active ? 1 : 0.5 }}>
              {i > 0 ? " " : ""}
              {word.text}
            </span>
          ))}
        </div>
      </div>
    );
  }
  const color = THEMES[groundAt(grounds, frame)].ink;

  return (
    <div
      style={{
        position: "absolute",
        left: CONTENT.left,
        width: SPEC.box.width,
        top: CAPTION_LANE.top,
        maxHeight: SPEC.max_lines * SPEC.size * SPEC.line_height,
        overflow: "hidden",
        textAlign: "center",
        fontFamily: BODY_FONT,
        fontWeight: SPEC.weight,
        fontSize: SPEC.size,
        lineHeight: SPEC.line_height,
        color,
        ...TABULAR,
      }}
    >
      {chunk.words.map((word, i) => (
        <span key={`${word.startMs}-${i}`} style={{ opacity: i <= active ? 1 : 0.45 }}>
          {i > 0 ? " " : ""}
          {word.text}
        </span>
      ))}
    </div>
  );
};
