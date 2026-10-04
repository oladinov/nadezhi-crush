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
  rainbowRainbowFusion: 10000,
  boardClear: 5000,
} as const;

export const BOARD_CLEAR_EXCLAMATIONS = [
  '¡IMPRESIONANTE!',
  '¡EXCELSIOR!',
  '¡WOOOOOOOW!',
  '¡APOTEÓSICO!',
  '¡SUBLIME!',
  '¡MAGISTRAL!',
  '¡LIMPIEZA TOTAL!',
  '¡PERFECCIÓN ABSOLUTA!',
  '¡ASOMBROSO!',
  '¡ÉPICO!',
  '¡LEGENDARIO!',
  '¡SENSACIONAL!',
];

export function getRandomBoardClearExclamation(rng?: { next: () => number }): string {
  const rand = rng ? rng.next() : Math.random();
  const idx = Math.floor(rand * BOARD_CLEAR_EXCLAMATIONS.length);
  return BOARD_CLEAR_EXCLAMATIONS[Math.min(idx, BOARD_CLEAR_EXCLAMATIONS.length - 1)];
}

export interface ComboRating {
  tier: number;
  title: string;
  subtitle: string;
  points: number;
  color: string;
}

export function getComboRating(cascade: number): ComboRating | null {
  if (cascade < 3) return null;
  switch (cascade) {
    case 3:
      return {
        tier: 1,
        title: '¡BUEN COMBO!',
        subtitle: 'GOOD COMBO!',
        points: 300,
        color: '#22c55e',
      };
    case 4:
      return {
        tier: 2,
        title: '¡SÚPER COMBO!',
        subtitle: 'SUPER COMBO!',
        points: 600,
        color: '#06b6d4',
      };
    case 5:
      return {
        tier: 3,
        title: '¡MEGA COMBO!',
        subtitle: 'MEGA COMBO!',
        points: 1200,
        color: '#d946ef',
      };
    case 6:
      return {
        tier: 4,
        title: '¡INCREÍBLE!',
        subtitle: 'INCREDIBLE!',
        points: 2500,
        color: '#f97316',
      };
    default:
      return {
        tier: 5,
        title: '¡MONSTRUOSO!',
        subtitle: 'MONSTER COMBO!',
        points: 5000,
        color: '#facc15',
      };
  }
}
