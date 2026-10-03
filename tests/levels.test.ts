import { describe, it, expect } from 'vitest';
import { getLevelConfig, generateLevel } from '../src/levels/generator';
import { CURATED_LEVELS } from '../src/levels/curated';
import { simulateGreedy } from '../src/levels/bot';
import { CoreEngine } from '../src/core/resolver';
import { findValidMoves } from '../src/core/moves';
import { evaluateMatches } from '../src/core/patterns';
import { hashString } from '../src/core/rng';
import { getLevelBiome } from '../src/game';

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
      if (i <= 8) {
        expect(cfg.colors).toBe(4);
      } else {
        expect(cfg.colors).toBe(5);
      }
    }
  });

  it('ensures level 9 has balanced initial board without instant 5-in-a-row', () => {
    const cfg = getLevelConfig(9);
    const engine = new CoreEngine(cfg);
    const moves = findValidMoves(engine.board);
    expect(moves.length).toBeGreaterThan(15);
    // Verify no 5-match on move 1
    moves.forEach((m: any) => {
      const copy = JSON.parse(JSON.stringify(engine.board));
      const gemA = copy[m.a.r][m.a.c];
      const gemB = copy[m.b.r][m.b.c];
      copy[m.a.r][m.a.c] = gemB;
      copy[m.b.r][m.b.c] = gemA;
      const matches = evaluateMatches(copy);
      for (const match of matches) {
        expect(match.spawn?.kind !== 'rainbow').toBe(true);
      }
    });
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

  it('assigns Tierras Infinitas biome to levels >= 21', () => {
    const biome20 = getLevelBiome(20);
    expect(biome20.name).toBe('Monte del Destino');
    expect(biome20.image).toBe('/fantasy_volcano.jpg');

    const biome21 = getLevelBiome(21);
    expect(biome21.name).toBe('Tierras Infinitas');
    expect(biome21.icon).toBe('♾️');
    expect(biome21.image).toBe('/fantasy_infinite.jpg');
  });
});
