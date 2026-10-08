import React, { createContext, useContext } from "react";

/** The Lombard Row palette (brand guidelines, Oct 2026). Hex values are the source of truth. */
export const BRAND = {
  ledgerInk: "#1B2A41",
  parchment: "#F3EBDD",
  bankersGreen: "#2F5D50",
  brass: "#B8893B",
  tickerRed: "#B23A3A",
  slate: "#6B7280",
} as const;

/** Scene grounds. A video's palette lead sets the default; open, close and year-counter scenes stay on ink. */
export const GROUNDS = ["ink", "parchment", "green"] as const;
export type Ground = (typeof GROUNDS)[number];

export type Tone = "positive" | "negative" | "neutral" | "highlight";

export type Theme = {
  name: Ground;
  /** Background fill. */
  ground: string;
  /** Primary text and marks. */
  ink: string;
  /** Secondary text: Parchment at 72% on dark grounds, Slate on Parchment. */
  muted: string;
  /** Axis and rule color: never Brass, so Brass stays free for the accent. */
  axis: string;
  /** Brass as a shape (rules, brackets, bars). Allowed on every ground. */
  accent: string;
  /** Data marks (lines, bars, dots) for each semantic tone. */
  tone: Record<Tone, string>;
  /** Text for each semantic tone, kept readable on this ground. */
  toneText: Record<Tone, string>;
  /** Bar race fills: everything monochrome, the leader in the accent. */
  series: { rest: string; leader: string };
};

/** Flattens `color` at `alpha` over `base`, so muted text stays a solid hex. */
export function mix(color: string, base: string, alpha: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
  const out = [0, 1, 2].map((i) => Math.round(channel(color, i) * alpha + channel(base, i) * (1 - alpha)));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

const { ledgerInk, parchment, bankersGreen, brass, tickerRed, slate } = BRAND;

/**
 * Contrast rules from the guidelines: Banker's Green and Slate only on Parchment; Brass as text
 * only on Ledger Ink (shapes elsewhere); Ticker Red never decorative. Where a tone's color is too
 * dark for a ground, its marks and text fall back to Parchment.
 */
export const THEMES: Record<Ground, Theme> = {
  ink: {
    name: "ink",
    ground: ledgerInk,
    ink: parchment,
    muted: mix(parchment, ledgerInk, 0.72),
    axis: parchment,
    accent: brass,
    tone: { positive: parchment, negative: tickerRed, neutral: mix(parchment, ledgerInk, 0.72), highlight: brass },
    toneText: { positive: parchment, negative: parchment, neutral: mix(parchment, ledgerInk, 0.72), highlight: brass },
    series: { rest: mix(parchment, ledgerInk, 0.72), leader: brass },
  },
  parchment: {
    name: "parchment",
    ground: parchment,
    ink: ledgerInk,
    muted: slate,
    axis: ledgerInk,
    accent: brass,
    tone: { positive: bankersGreen, negative: tickerRed, neutral: slate, highlight: brass },
    toneText: { positive: bankersGreen, negative: tickerRed, neutral: slate, highlight: ledgerInk },
    series: { rest: ledgerInk, leader: brass },
  },
  green: {
    name: "green",
    ground: bankersGreen,
    ink: parchment,
    muted: mix(parchment, bankersGreen, 0.78),
    axis: parchment,
    accent: brass,
    tone: { positive: parchment, negative: parchment, neutral: mix(parchment, bankersGreen, 0.78), highlight: brass },
    toneText: { positive: parchment, negative: parchment, neutral: mix(parchment, bankersGreen, 0.78), highlight: parchment },
    series: { rest: mix(parchment, bankersGreen, 0.78), leader: brass },
  },
};

const ThemeContext = createContext<Theme>(THEMES.ink);

export const ThemeProvider: React.FC<{ ground: Ground; children: React.ReactNode }> = ({ ground, children }) =>
  React.createElement(ThemeContext.Provider, { value: THEMES[ground] }, children);

export const useTheme = (): Theme => useContext(ThemeContext);
