import React from "react";
import { AbsoluteFill } from "remotion";
import { BODY_FONT, DISPLAY_FONT, TABULAR } from "../design/fonts";
import { BRAND, mix } from "../design/theme";
import { doorLabelText } from "../devices/label";

export type ThumbnailProps = { doorNo: number; title: string; series: string; width: number; height: number };

/** Caslon size for the title: long titles step down so they stay within three lines. */
export const thumbnailTitleSize = (title: string): number => (title.length <= 22 ? 150 : title.length <= 40 ? 124 : 106);

/**
 * A still cover: the door plate's number, the title in Caslon and the wordmark, centered on Ledger Ink.
 * Everything sits in the middle 1080x1300, so a 4:5 or 3:4 grid crop of the 9:16 cover keeps it all.
 */
export const Thumbnail: React.FC<ThumbnailProps> = ({ doorNo, title, series }) => (
  <AbsoluteFill style={{ background: BRAND.ledgerInk, alignItems: "center", justifyContent: "center" }}>
    <div style={{ width: 960, display: "flex", flexDirection: "column", alignItems: "center", gap: 56 }}>
      <div
        style={{
          border: `4px solid ${BRAND.brass}`, borderRadius: 14, padding: 10,
        }}
      >
        <div
          style={{
            border: `1.5px solid ${mix(BRAND.brass, BRAND.ledgerInk, 0.6)}`, borderRadius: 8, padding: "18px 56px 22px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          }}
        >
          <div style={{ fontFamily: BODY_FONT, fontWeight: 500, fontSize: 34, letterSpacing: "0.3em", marginRight: "-0.3em", textTransform: "uppercase", color: mix(BRAND.parchment, BRAND.ledgerInk, 0.8) }}>
            No.
          </div>
          <div style={{ fontFamily: DISPLAY_FONT, fontSize: 176, lineHeight: 1, color: BRAND.parchment, ...TABULAR }}>{doorLabelText(doorNo)}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
        <div style={{ fontFamily: BODY_FONT, fontWeight: 600, fontSize: 36, letterSpacing: "0.24em", marginRight: "-0.24em", textTransform: "uppercase", color: BRAND.brass }}>
          {series}
        </div>
        <div
          style={{
            fontFamily: DISPLAY_FONT, fontSize: thumbnailTitleSize(title), lineHeight: 1.08, color: BRAND.parchment, textAlign: "center",
            textWrap: "balance",
          } as React.CSSProperties}
        >
          {/* Words never break at their hyphens ("500-year-old" stays whole). */}
          {title.split(/\s+/).map((word, i) => (
            <React.Fragment key={i}>
              {i ? " " : ""}
              <span style={{ whiteSpace: "nowrap" }}>{word}</span>
            </React.Fragment>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 12, marginTop: 24 }}>
        <div style={{ fontFamily: DISPLAY_FONT, fontSize: 46, lineHeight: 1, color: BRAND.parchment, letterSpacing: "0.16em", marginRight: "-0.16em" }}>LOMBARD ROW</div>
        <div style={{ height: 3, background: BRAND.brass }} />
      </div>
    </div>
  </AbsoluteFill>
);
