import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BODY_FONT, DISPLAY_FONT } from "../design/fonts";
import { easeOutCubic } from "../design/motion";
import { BRAND } from "../design/theme";
import { CONTENT } from "../design/tokens";

/**
 * The reveal ending's comment question as its own full-screen card: it cuts in on the question's first spoken word
 * and holds to the last frame, so the video stops on the question and loops. The narration asks it aloud; there is
 * no spoken sign-off after it (Justin, 2026-10-11: "make the ending questions its own full screen graphic. Add the
 * question to the VO").
 */
export const COMMENT_PROMPT = { popFrames: 6, size: 112, kickerSize: 34 } as const;

export const CommentPrompt: React.FC<{ prompt: string }> = ({ prompt }) => {
  const frame = useCurrentFrame();
  const pop = easeOutCubic(frame / COMMENT_PROMPT.popFrames);
  return (
    <AbsoluteFill style={{ background: BRAND.ledgerInk, justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          width: CONTENT.width,
          // Sit a little above centre, clear of the platform caption and buttons at the bottom.
          marginBottom: 220,
          opacity: pop,
          transform: `scale(${0.94 + 0.06 * pop})`,
        }}
      >
        <div style={{ fontFamily: BODY_FONT, fontWeight: 700, fontSize: COMMENT_PROMPT.kickerSize, letterSpacing: "0.2em", color: BRAND.brass }}>
          COMMENT
        </div>
        <div style={{ height: 4, width: 120, background: BRAND.brass, margin: "18px 0 30px" }} />
        <div style={{ fontFamily: DISPLAY_FONT, fontSize: COMMENT_PROMPT.size, lineHeight: 1.06, color: BRAND.parchment, textWrap: "balance" }}>
          {prompt}
        </div>
      </div>
    </AbsoluteFill>
  );
};
