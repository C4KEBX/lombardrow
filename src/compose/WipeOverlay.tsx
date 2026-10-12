import React from "react";
import { useCurrentFrame } from "remotion";
import { BRAND, THEMES, type Ground } from "../design/theme";
import { VIDEO } from "../design/tokens";
import { WIPE, bandPoints, sweepLength, wipeBand, type WipeDirection } from "./wipe";

/**
 * A thin Brass band trailing a lead band in the incoming scene's ground: two overlapping flat
 * blocks, no gradients. `grounds[i]` is the ground of the scene that starts at `cuts[i]`, and
 * `directions[i]` the way that wipe sweeps (left to right when not given).
 */
export const WipeOverlay: React.FC<{ cuts: readonly number[]; grounds?: readonly Ground[]; directions?: readonly WipeDirection[] }> = ({
  cuts, grounds = [], directions = [],
}) => {
  const frame = useCurrentFrame();
  return (
    <svg width={VIDEO.width} height={VIDEO.height} style={{ position: "absolute", inset: 0 }}>
      {cuts.flatMap((cut, i) => {
        const layers = [
          { lag: WIPE.lag, color: BRAND.brass },
          { lag: 0, color: THEMES[grounds[i] ?? "ink"].ground },
        ];
        return layers.map(({ lag, color }) => {
          const direction = directions[i] ?? "left-to-right";
          const band = wipeBand(frame, cut, lag, sweepLength(direction));
          return band ? <polygon key={`${cut}-${lag}`} points={bandPoints(band, direction)} fill={color} /> : null;
        });
      })}
    </svg>
  );
};
