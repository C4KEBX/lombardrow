import React from "react";
import { BODY_FONT } from "../design/fonts";
import { useTheme } from "../design/theme";
import { BADGE, type PlacedBadge } from "./layout";

type Props = {
  badge: PlacedBadge;
  text: string;
  anchorX: number;
  anchorY: number;
  scale: number;
  /** The tone's mark color: drawn as the stem and the tag's border, never as text. */
  color: string;
};

/** SVG callout: a thin stem from the data point to a flat, ruled tag in the ground color. */
export const CalloutBadge: React.FC<Props> = ({ badge, text, anchorX, anchorY, scale, color }) => {
  const theme = useTheme();
  return (
    <g opacity={Math.min(1, scale)}>
      <line x1={anchorX} y1={anchorY} x2={badge.x} y2={badge.y} stroke={color} strokeWidth={4} />
      <g transform={`translate(${badge.x} ${badge.y}) scale(${scale})`}>
        <rect
          x={-badge.width / 2} y={-BADGE.heightPx / 2} width={badge.width} height={BADGE.heightPx}
          fill={theme.ground} stroke={color} strokeWidth={4}
        />
        <text
          textAnchor="middle" y={BADGE.fontPx * 0.36}
          fontFamily={BODY_FONT} fontWeight={600} fontSize={BADGE.fontPx} fill={theme.ink}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {text}
        </text>
      </g>
    </g>
  );
};
