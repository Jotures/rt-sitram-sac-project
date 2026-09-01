/// <reference types="node" />

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readStyle(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

function relativeLuminance(hex: string): number {
  const channels = hex
    .replace("#", "")
    .match(/.{2}/gu)
    ?.map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));

  if (channels === undefined || channels.length !== 3) {
    throw new Error(`Invalid RGB color: ${hex}`);
  }

  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

describe("R&T SITRAM design system", () => {
  const tokens = readStyle("./tokens.css");
  const global = readStyle("./global.css");
  const primitives = readStyle("../components/primitives/primitives.css");

  it("keeps the canonical mineral, petroleum and copper identity", () => {
    expect(tokens).toContain("--color-ink-950: #122b33");
    expect(tokens).toContain("--color-copper-700: #98472d");
    expect(tokens).toContain("--color-mineral-100: #f1f0ea");
    expect(tokens).toContain("--color-surface: #fffdf9");
    expect(tokens).toContain('"Archivo Variable"');
  });

  it("centralizes productive motion and accessible focus", () => {
    for (const duration of ["120ms", "180ms", "220ms", "280ms", "400ms"]) {
      expect(tokens).toContain(duration);
    }

    expect(global).toContain("outline: 3px solid var(--color-focus)");
    expect(global).toContain("@media (prefers-reduced-motion: reduce)");
    expect(global).not.toContain("rgb(40 103 169 / 35%)");
  });

  it("uses the contrast-safe copper for the primary action", () => {
    expect(primitives).toMatch(
      /\.button--primary\s*\{[^}]*background:\s*var\(--color-copper-700\)/su,
    );
    expect(primitives).toContain("transform: scale(0.97)");
    expect(contrastRatio("#ffffff", "#98472d")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#17262c", "#fffdf9")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#7f8988", "#fffdf9")).toBeGreaterThanOrEqual(3);
  });
});
