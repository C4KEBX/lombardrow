import React from "react";
import { AbsoluteFill, Img } from "remotion";
import { BLEED_GRADE, BLEED_MOTION, shotTransform } from "../scenes/archival/BleedArchival";
import { VIDEO } from "../design/tokens";
import { BODY_FONT, DISPLAY_FONT, TABULAR } from "../design/fonts";
import { BRAND, mix } from "../design/theme";
import { doorLabelText } from "../devices/label";

/** The cover's image crop and line, with the image inlined (see `meta.cover`). */
export type CoverArt = { line: string; mark?: string; src: string; width: number; height: number; x: number; y: number; w: number };

export type ThumbnailProps = { doorNo: number; title: string; series: string; width: number; height: number; cover?: CoverArt };

/** Caslon size for the title: long titles step down so they stay within three lines. */
export const thumbnailTitleSize = (title: string): number => (title.length <= 22 ? 150 : title.length <= 40 ? 124 : 106);

/**
 * A still cover: the door plate's number, the title in Caslon and the wordmark, centered on Ledger Ink.
 * Everything sits in the middle 1080x1300, so a 4:5 or 3:4 grid crop of the 9:16 cover keeps it all.
 */
export const Thumbnail: React.FC<ThumbnailProps> = (props) => (props.cover ? <ImageCover {...props} cover={props.cover} /> : <DoorCover {...props} />);

/** Caslon size for the cover line: it fills two or three lines at most. */
export const coverLineSize = (line: string): number => (line.length <= 20 ? 150 : line.length <= 32 ? 128 : 112);

/**
 * The image cover: one bright, close crop filling the frame, the line big in the middle with one word in Brass, and
 * the door number and wordmark small. Laid out on the 9:16 frame and centred, so the 3:4 grid crop keeps the line.
 */
const ImageCover: React.FC<ThumbnailProps & { cover: CoverArt }> = ({ doorNo, height, cover }) => {
  const size = { width: cover.width, height: cover.height };
  const { scale, left, top } = shotTransform({ x: cover.x, y: cover.y, w: cover.w, occurrence: 1 }, size, BLEED_MOTION.settleFrames, 1e9);
  const fontSize = coverLineSize(cover.line);
  return (
    <AbsoluteFill style={{ background: BRAND.ledgerInk, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: (height - VIDEO.height) / 2, width: VIDEO.width, height: VIDEO.height }}>
        <div style={{ position: "absolute", left, top, width: size.width * scale, height: size.height * scale }}>
          <Img src={cover.src} style={{ width: "100%", height: "100%", display: "block", filter: BLEED_GRADE }} />
        </div>
        <AbsoluteFill
          style={{
            background: `linear-gradient(180deg, ${BRAND.ledgerInk}b3 0px, ${BRAND.ledgerInk}00 520px, ${BRAND.ledgerInk}00 900px, ${BRAND.ledgerInk}e6 1300px, ${BRAND.ledgerInk}f2 1920px)`,
          }}
        />
        <div
          style={{
            position: "absolute", left: 0, right: 0, top: 340, display: "flex", justifyContent: "center",
          }}
        >
          <div style={{ border: `3px solid ${BRAND.brass}`, borderRadius: 10, padding: "8px 26px", background: `${BRAND.ledgerInk}cc`, fontFamily: BODY_FONT, fontWeight: 600, fontSize: 34, letterSpacing: "0.2em", marginRight: "-0.2em", color: BRAND.parchment, ...TABULAR }}>
            NO. {doorLabelText(doorNo)}
          </div>
        </div>
        <div
          style={{
            position: "absolute", left: 60, right: 60, top: 1060, textAlign: "center",
            fontFamily: DISPLAY_FONT, fontSize, lineHeight: 1.04, color: BRAND.parchment, textWrap: "balance",
            textShadow: `0 4px 24px ${BRAND.ledgerInk}`,
          } as React.CSSProperties}
        >
          {cover.line.split(/\s+/).map((word, i) => {
            const marked = cover.mark !== undefined && word.replace(/[^\p{L}\p{N}'$-]/gu, "") === cover.mark;
            return (
              <React.Fragment key={i}>
                {i ? " " : ""}
                <span style={{ whiteSpace: "nowrap", color: marked ? BRAND.brass : undefined, fontStyle: marked ? "italic" : undefined }}>{word}</span>
              </React.Fragment>
            );
          })}
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 1560, display: "flex", justifyContent: "center" }}>
          <div style={{ fontFamily: DISPLAY_FONT, fontSize: 40, color: BRAND.parchment, letterSpacing: "0.16em", marginRight: "-0.16em", borderBottom: `3px solid ${BRAND.brass}`, paddingBottom: 8 }}>
            LOMBARD ROW
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** The door cover (No. 001 to 004): the door plate's number, the title in Caslon and the wordmark on Ledger Ink. */
const DoorCover: React.FC<ThumbnailProps> = ({ doorNo, title, series }) => (
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
