import React from "react";
import { useCurrentFrame } from "remotion";
import { BODY_FONT } from "../design/fonts";
import { easeOutCubic } from "../design/motion";
import { BRAND } from "../design/theme";
import { CONTENT, SAFE } from "../design/tokens";

/**
 * The reveal ending's comment question: it pops in at the top of the frame on its spoken word and stays to the last
 * frame, so the video stops on a question and loops (Justin, 2026-10-11, taking the viral review's ending).
 */
export const COMMENT_PROMPT = { popFrames: 6, size: 58, kickerSize: 30 } as const;

export const CommentPrompt: React.FC<{ prompt: string }> = ({ prompt }) => {
  const frame = useCurrentFrame();
  const pop = easeOutCubic(frame / COMMENT_PROMPT.popFrames);
  return (
    <div
      style={{
        position: "absolute",
        top: SAFE.top,
        left: CONTENT.left,
        width: CONTENT.width,
        boxSizing: "border-box",
        padding: "22px 30px 28px",
        background: `${BRAND.ledgerInk}eb`,
        borderLeft: `6px solid ${BRAND.brass}`,
        borderRadius: 8,
        opacity: pop,
        transform: `scale(${0.9 + 0.1 * pop})`,
        transformOrigin: "top left",
      }}
    >
      <div style={{ fontFamily: BODY_FONT, fontWeight: 700, fontSize: COMMENT_PROMPT.kickerSize, letterSpacing: "0.08em", color: BRAND.brass }}>
        COMMENT
      </div>
      <div style={{ fontFamily: BODY_FONT, fontWeight: 800, fontSize: COMMENT_PROMPT.size, lineHeight: 1.12, color: BRAND.parchment, marginTop: 6 }}>{prompt}</div>
    </div>
  );
};
