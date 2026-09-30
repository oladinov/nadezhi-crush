export function getCascadeMultiplier(cascade: number): number {
  return Math.min(4, 1 + 0.5 * Math.max(0, cascade - 1));
}

export function getGemClearPoints(cascade: number): number {
  return Math.round(50 * getCascadeMultiplier(cascade));
}

export const SPECIAL_POINTS = {
  bombTier1: 150,
  bombTier2: 300,
  rainbowSimple: 500,
  bombBombFusion: 600,
  rainbowBombFusion: 1000,
  rainbowRainbowFusion: 2500,
} as const;
