import { describe, expect, it } from "vitest";
import { BRAND, GROUNDS, THEMES, mix } from "../../src/design/theme";
import DEVICES from "../../src/brand/devices.json";

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("brand palette", () => {
  it("matches devices.json exactly", () => {
    expect(BRAND).toEqual({
      ledgerInk: DEVICES.colors.ledger_ink,
      parchment: DEVICES.colors.parchment,
      bankersGreen: DEVICES.colors.bankers_green,
      brass: DEVICES.colors.brass,
      tickerRed: DEVICES.colors.ticker_red,
      slate: DEVICES.colors.slate,
    });
  });
  it("flattens an alpha over a base", () => {
    expect(mix("#FFFFFF", "#000000", 0.5)).toBe("#808080");
    expect(mix(BRAND.parchment, BRAND.ledgerInk, 1)).toBe(BRAND.parchment);
  });
});

describe("ground themes", () => {
  it("defines every ground", () => {
    expect(Object.keys(THEMES).sort()).toEqual([...GROUNDS].sort());
  });

  it.each(GROUNDS)("keeps primary text on %s at 4.5:1 or better", (ground) => {
    const t = THEMES[ground];
    const { neutral: _secondary, ...primary } = t.toneText;
    for (const text of [t.ink, ...Object.values(primary)]) {
      expect(contrast(text, t.ground)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(GROUNDS)("keeps secondary text on %s at 3:1 or better (Slate on Parchment is the brand's choice, 4.1:1)", (ground) => {
    const t = THEMES[ground];
    for (const text of [t.muted, t.toneText.neutral]) expect(contrast(text, t.ground)).toBeGreaterThanOrEqual(3);
  });

  it("uses Brass as text only on Ledger Ink", () => {
    for (const ground of GROUNDS) {
      const usesBrassText = Object.values(THEMES[ground].toneText).includes(BRAND.brass);
      expect(usesBrassText).toBe(ground === "ink");
    }
  });

  it("keeps Banker's Green and Slate on Parchment only", () => {
    for (const ground of GROUNDS) {
      if (ground === "parchment") continue;
      const t = THEMES[ground];
      const colors = [t.ink, t.muted, t.axis, ...Object.values(t.tone), ...Object.values(t.toneText)];
      expect(colors).not.toContain(BRAND.bankersGreen);
      expect(colors).not.toContain(BRAND.slate);
    }
  });

  it("never uses Brass for axes, so the ledger line leaves the accent free", () => {
    for (const ground of GROUNDS) expect(THEMES[ground].axis).not.toBe(BRAND.brass);
  });

  it("keeps gain and loss marks distinct wherever both are readable", () => {
    expect(THEMES.parchment.tone.positive).not.toBe(THEMES.parchment.tone.negative);
    expect(THEMES.ink.tone.positive).not.toBe(THEMES.ink.tone.negative);
  });
});
