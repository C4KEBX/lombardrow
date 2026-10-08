import React from "react";
import { DISPLAY_FONT } from "../design/fonts";
import { PALETTE } from "../design/tokens";
import { BADGE, type PlacedBadge } from "./layout";

type Props = {
  badge: PlacedBadge;
  text: string;
  anchorX: number;
  anchorY: number;
  scale: number;
  color: string;
};

/** SVG callout: a stem from the data point to a tilted cream badge with a tone-colored hard shadow. */
export const CalloutBadge: React.FC<Props> = ({ badge, text, anchorX, anchorY, scale, color }) => (
  <g opacity={Math.min(1, scale)}>
    <line x1={anchorX} y1={anchorY} x2={badge.x} y2={badge.y} stroke={color} strokeWidth={6} strokeLinecap="round" />
    <g transform={`translate(${badge.x} ${badge.y}) rotate(-3) scale(${scale})`}>
      <rect
        x={-badge.width / 2 + 8} y={-BADGE.heightPx / 2 + 8}
        width={badge.width} height={BADGE.heightPx}
        fill={color}
      />
      <rect x={-badge.width / 2} y={-BADGE.heightPx / 2} width={badge.width} height={BADGE.heightPx} fill={PALETTE.ink} />
      <text
        textAnchor="middle" y={BADGE.fontPx * 0.35}
        fontFamily={DISPLAY_FONT} fontSize={BADGE.fontPx} fill={PALETTE.ground}
      >
        {text}
      </text>
    </g>
  </g>
);
