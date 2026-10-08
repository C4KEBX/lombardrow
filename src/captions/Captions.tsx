import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { DISPLAY_FONT } from "../design/fonts";
import { popIn } from "../design/motion";
import { CAPTION_LANE, PALETTE, SAFE } from "../design/tokens";
import { activeWordIndex, chunkAt, type CaptionChunk } from "./chunk";

/** Word-by-word captions: the spoken word sits on a highlighted block, upcoming words are dimmed. */
export const Captions: React.FC<{ chunks: CaptionChunk[] }> = ({ chunks }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const chunk = chunkAt(chunks, ms);
  if (!chunk) return null;
  const active = activeWordIndex(chunk, ms);
  const pop = Math.min(1, popIn(frame, fps, Math.round((chunk.startMs / 1000) * fps)));

  return (
    <div
      style={{
        position: "absolute",
        left: SAFE.side,
        right: SAFE.side,
        top: CAPTION_LANE.top,
        height: CAPTION_LANE.bottom - CAPTION_LANE.top,
        display: "flex",
        flexWrap: "wrap",
        alignContent: "center",
        justifyContent: "center",
        gap: "6px 14px",
        opacity: pop,
        transform: `scale(${0.92 + 0.08 * pop})`,
      }}
    >
      {chunk.words.map((word, i) => {
        const isActive = i === active;
        return (
          <span
            key={`${word.startMs}-${i}`}
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: 62,
              lineHeight: 1.1,
              padding: "4px 14px",
              color: isActive ? PALETTE.ground : PALETTE.ink,
              background: isActive ? PALETTE.highlight : "transparent",
              opacity: i <= active ? 1 : 0.5,
              transform: isActive ? "rotate(-2deg)" : "none",
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
};
