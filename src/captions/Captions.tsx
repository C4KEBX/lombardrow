import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { BODY_FONT, TABULAR } from "../design/fonts";
import { THEMES, type Ground } from "../design/theme";
import { CAPTION_LANE, CONTENT, DEVICES } from "../design/tokens";
import { activeWordIndex, chunkAt, type CaptionChunk } from "./chunk";

const SPEC = DEVICES.devices.captions;

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
}> = ({ chunks, grounds = [] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const chunk = chunkAt(chunks, ms);
  if (!chunk) return null;
  const active = activeWordIndex(chunk, ms);
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
