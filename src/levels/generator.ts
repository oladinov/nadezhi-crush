import { Goal, LevelConfig, GemColor } from '../core/types';
import { hashString, Mulberry32 } from '../core/rng';
import { CURATED_LEVELS } from './curated';
import { simulateGreedy } from './bot';

export interface CalibrationData {
  perMove: number;
}

export const DEFAULT_CALIBRATION: CalibrationData = {
  perMove: 550, // Average points generated per move on 8x8 5-color board
};

export function pickGoals(rng: Mulberry32, targetScore: number): Goal[] {
  const goalType = rng.int(4);
  const safeTarget = Math.max(1500, targetScore);

  switch (goalType) {
    case 0:
      // Pure score
      return [{ type: 'score', target: safeTarget }];

    case 1: {
      // Score + Detonate
      const score = Math.max(1000, Math.round((safeTarget * 0.75) / 500) * 500);
      const detonateCount = 3 + rng.int(5);
      return [
        { type: 'score', target: score },
        { type: 'detonate', count: detonateCount },
      ];
    }

    case 2: {
      // Collect color + Score
      const color = rng.int(5) as GemColor;
      const count = 12 + rng.int(10);
      const score = Math.max(1000, Math.round((safeTarget * 0.6) / 500) * 500);
      return [
        { type: 'collect', color, count },
        { type: 'score', target: score },
      ];
    }

    case 3:
    default: {
      // Create bomb/rainbow + Score
      const isRainbow = rng.next() > 0.65;
      const score = Math.max(1000, Math.round((safeTarget * 0.7) / 500) * 500);
      if (isRainbow) {
        return [
          { type: 'create', kind: 'rainbow', count: 1 },
          { type: 'score', target: score },
        ];
      } else {
        const tier = rng.next() > 0.5 ? 2 : 1;
        return [
          { type: 'create', kind: 'bomb', tier, count: 1 + rng.int(2) },
          { type: 'score', target: score },
        ];
      }
    }
  }
}

export function generateLevel(level: number, calib: CalibrationData = DEFAULT_CALIBRATION): LevelConfig {
  const n = level - 21;
  const seed = hashString(`level_${level}`);
  const rng = new Mulberry32(hashString(`gen_${level}`));
  const moves = Math.max(14, 25 - Math.floor(n / 6)); // margen decreciente
  const k = Math.min(1.3, 0.8 + 0.012 * n) - (level % 10 === 0 ? 0.15 : 0); // meseta cada 10
  const bot = simulateGreedy({ seed, moves, colors: 5 }).score; // determinista por nivel
  const par = 0.5 * calib.perMove * moves + 0.5 * bot; // mezcla: estabiliza cascadas afortunadas
  const target = Math.round((par * k) / 500) * 500;

  return {
    level,
    seed,
    rows: 8,
    cols: 8,
    colors: 5,
    moves,
    goals: pickGoals(rng, target),
    title: `Nivel ${level}`,
    description: `Generado proceduralmente con dificultad equilibrada.`,
  };
}

export function getLevelConfig(level: number): LevelConfig {
  if (level >= 1 && level <= CURATED_LEVELS.length) {
    return CURATED_LEVELS[level - 1];
  }
  return generateLevel(level);
}
