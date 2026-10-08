import React from "react";
import { useCurrentFrame } from "remotion";
import { PALETTE, VIDEO } from "../design/tokens";
import { WIPE, bandPoints, wipeBand } from "./wipe";

/** Lagging highlight band under a neutral lead band: two overlapping flat blocks, no gradients. */
const LAYERS = [
  { lag: WIPE.lag, color: PALETTE.highlight },
  { lag: 0, color: PALETTE.neutral },
] as const;

export const WipeOverlay: React.FC<{ cuts: readonly number[] }> = ({ cuts }) => {
  const frame = useCurrentFrame();
  return (
    <svg width={VIDEO.width} height={VIDEO.height} style={{ position: "absolute", inset: 0 }}>
      {cuts.flatMap((cut) =>
        LAYERS.map(({ lag, color }) => {
          const band = wipeBand(frame, cut, lag);
          return band ? <polygon key={`${cut}-${lag}`} points={bandPoints(band)} fill={color} /> : null;
        }),
      )}
    </svg>
  );
};
