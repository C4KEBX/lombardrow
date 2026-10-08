import React from "react";
import { useCurrentFrame } from "remotion";
import { BRAND, THEMES, type Ground } from "../design/theme";
import { VIDEO } from "../design/tokens";
import { WIPE, bandPoints, wipeBand } from "./wipe";

/**
 * A thin Brass band trailing a lead band in the incoming scene's ground: two overlapping flat
 * blocks, no gradients. `grounds[i]` is the ground of the scene that starts at `cuts[i]`.
 */
export const WipeOverlay: React.FC<{ cuts: readonly number[]; grounds?: readonly Ground[] }> = ({ cuts, grounds = [] }) => {
  const frame = useCurrentFrame();
  return (
    <svg width={VIDEO.width} height={VIDEO.height} style={{ position: "absolute", inset: 0 }}>
      {cuts.flatMap((cut, i) => {
        const layers = [
          { lag: WIPE.lag, color: BRAND.brass },
          { lag: 0, color: THEMES[grounds[i] ?? "ink"].ground },
        ];
        return layers.map(({ lag, color }) => {
          const band = wipeBand(frame, cut, lag);
          return band ? <polygon key={`${cut}-${lag}`} points={bandPoints(band)} fill={color} /> : null;
        });
      })}
    </svg>
  );
};
