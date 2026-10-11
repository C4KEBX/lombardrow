import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { EXIT_FRAMES } from "../../charts/timing";
import { BODY_FONT, DISPLAY_FONT } from "../../design/fonts";
import { clamp01, popIn } from "../../design/motion";
import { BRAND, THEMES, mix, useTheme } from "../../design/theme";
import { CONTENT, SAFE } from "../../design/tokens";
import type { LedgerPageProps } from "../../schema/storyboard";
import type { SceneRenderProps } from "../types";
import { STEPS, WRITE_FRAMES, stepCueFrames, stepPlan } from "../steps/timing";
import { LEDGER_LAYOUT as L, ledgerRowY } from "./layout";

/** A ruled Parchment page: each entry is written in, left to right, as it is spoken; a double rule and the total close it. */
export const LedgerPage: React.FC<SceneRenderProps<LedgerPageProps>> = ({ props, cues, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const page = THEMES.parchment;
  const { rows, total } = props;
  const plan = stepPlan(stepCueFrames(rows.map((r) => r.entry), cues), durationFrames, "row");
  const write = (start: number) => clamp01((frame - start) / WRITE_FRAMES);
  const totalStart = Math.max(...plan.frames) + STEPS.settle;
  // The total takes the next ruled line; the double rule sits between the last entry's rule and the total.
  const totalY = ledgerRowY(rows.length);
  const pageIn = Math.min(1, popIn(frame, fps, 0));
  const exit = interpolate(frame, [durationFrames - EXIT_FRAMES, durationFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rules = Array.from({ length: Math.floor((L.pageBottom - L.pageTop - 60) / L.pitch) + 1 }, (_, i) => ledgerRowY(i) + 34);
  const onParchment = theme.name === "parchment";

  const Line: React.FC<{ y: number; start: number; entry: string; amount: string; date?: string; bold?: boolean }> = ({ y, start, entry, amount, date, bold }) => {
    const p = write(start);
    return (
      <div style={{ position: "absolute", left: 0, right: 0, top: y - 60, height: 90, clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` }}>
        {date ? (
          <div style={{ position: "absolute", left: L.entryX - L.pageLeft, top: -2, fontFamily: BODY_FONT, fontWeight: 500, fontSize: L.dateSize, color: page.muted }}>{date}</div>
        ) : null}
        <div style={{ position: "absolute", left: L.entryX - L.pageLeft, top: date ? 30 : 22, fontFamily: DISPLAY_FONT, fontSize: L.entrySize, color: page.ink, fontWeight: bold ? 700 : 400 }}>{entry}</div>
        <div
          style={{
            position: "absolute", right: L.pageRight - L.amountX, top: date ? 32 : 24, fontFamily: BODY_FONT, fontWeight: bold ? 700 : 500,
            fontSize: L.amountSize, color: page.ink, fontVariantNumeric: "tabular-nums",
          }}
        >
          {amount}
        </div>
      </div>
    );
  };

  return (
    <AbsoluteFill style={{ background: theme.ground, opacity: exit }}>
      <div style={{ position: "absolute", left: CONTENT.left, top: SAFE.top + 4, fontFamily: BODY_FONT, fontWeight: 600, fontSize: 44, color: theme.muted, opacity: pageIn }}>
        {props.title}
      </div>
      <div
        style={{
          position: "absolute", left: L.pageLeft, top: L.pageTop, width: L.pageRight - L.pageLeft, height: L.pageBottom - L.pageTop,
          background: onParchment ? mix(BRAND.parchment, BRAND.ledgerInk, 0.96) : BRAND.parchment,
          border: onParchment ? `2px solid ${mix(BRAND.ledgerInk, BRAND.parchment, 0.35)}` : "none",
          opacity: pageIn, transform: `translateY(${(1 - pageIn) * 30}px)`,
        }}
      >
        {rules.map((y) => (
          <div key={y} style={{ position: "absolute", left: 0, right: 0, top: y - L.pageTop, height: 2, background: page.muted, opacity: 0.25 }} />
        ))}
        <div style={{ position: "absolute", top: 0, bottom: 0, left: L.moneyRuleX - L.pageLeft, width: 2, background: page.muted, opacity: 0.35 }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: L.moneyRuleX - L.pageLeft + 8, width: 2, background: page.muted, opacity: 0.35 }} />
        {rows.map((row, i) => (
          <Line key={`${row.entry}-${i}`} y={ledgerRowY(i) - L.pageTop} start={plan.frames[i]} entry={row.entry} amount={row.amount} date={row.date} />
        ))}
        {total ? (
          <>
            <div style={{ position: "absolute", left: L.moneyRuleX - L.pageLeft + 24, right: L.pageRight - L.amountX, top: totalY - L.pageTop - 80, height: 10, borderTop: `3px solid ${theme.accent}`, borderBottom: `3px solid ${theme.accent}`, transform: `scaleX(${write(totalStart)})`, transformOrigin: "right center" }} />
            <Line y={totalY - L.pageTop} start={totalStart + 8} entry={total.entry} amount={total.amount} bold />
          </>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

