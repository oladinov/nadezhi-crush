import { describe, it, expect } from 'vitest';
import { getLevelConfig, generateLevel } from '../src/levels/generator';
import { CURATED_LEVELS } from '../src/levels/curated';
import { simulateGreedy } from '../src/levels/bot';

describe('Curated Levels', () => {
  it('has 20 curated levels with valid properties', () => {
    expect(CURATED_LEVELS.length).toBe(20);
    for (let i = 1; i <= 20; i++) {
      const cfg = getLevelConfig(i);
      expect(cfg.level).toBe(i);
      expect(cfg.rows).toBe(8);
      expect(cfg.cols).toBe(8);
      expect(cfg.moves).toBeGreaterThan(10);
      expect(cfg.goals.length).toBeGreaterThan(0);
    }
  });
});

describe('Bot Simulation and Infinite Generator', () => {
  it('greedy bot produces reproducible positive score', () => {
    const res = simulateGreedy({ seed: 12345, moves: 10, colors: 5 });
    expect(res.score).toBeGreaterThan(0);
    expect(res.movesPlayed).toBe(10);
  });

  it('generateLevel generates valid configs for levels >= 21', () => {
    const lvl21 = generateLevel(21);
    expect(lvl21.level).toBe(21);
    expect(lvl21.moves).toBe(25);
    expect(lvl21.goals.length).toBeGreaterThan(0);

    const lvl50 = generateLevel(50);
    expect(lvl50.level).toBe(50);
    expect(lvl50.moves).toBeLessThanOrEqual(21);
  });
});
