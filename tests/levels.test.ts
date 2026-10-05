import { describe, it, expect } from 'vitest';
import { getLevelConfig, generateLevel } from '../src/levels/generator';
import { CURATED_LEVELS } from '../src/levels/curated';
import { simulateGreedy } from '../src/levels/bot';
import { CoreEngine } from '../src/core/resolver';
import { findValidMoves } from '../src/core/moves';
import { evaluateMatches } from '../src/core/patterns';
import { Cell } from '../src/core/types';
import { getLevelBiome, getEmoteSetForLevel } from '../src/game';

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
    const moves = findValidMoves(engine.getBoard());
    expect(moves.length).toBeGreaterThan(15);
    // Verify no 5-match on move 1
    moves.forEach((m: { a: Cell; b: Cell }) => {
      const copy = JSON.parse(JSON.stringify(engine.getBoard()));
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

  it('assigns fantasy biomes correctly up to Tierras Infinitas', () => {
    const biome20 = getLevelBiome(20);
    expect(biome20.name).toBe('Monte del Destino');
    expect(biome20.image).toBe('/fantasy_volcano.jpg');

    const biome21 = getLevelBiome(21);
    expect(biome21.name).toBe('Erebor');
    expect(biome21.icon).toBe('⛏️');
    expect(biome21.image).toBe('/fantasy_erebor.jpg');

    const biome25 = getLevelBiome(25);
    expect(biome25.name).toBe('Númenórë');
    expect(biome25.icon).toBe('⚓');
    expect(biome25.image).toBe('/fantasy_numenor.jpg');

    const biome29 = getLevelBiome(29);
    expect(biome29.name).toBe('Pixie Hollow');
    expect(biome29.icon).toBe('🧚');
    expect(biome29.image).toBe('/fantasy_pixie.jpg');

    const biome33 = getLevelBiome(33);
    expect(biome33.name).toBe('Nunca Jamás');
    expect(biome33.icon).toBe('🏴‍☠️');
    expect(biome33.image).toBe('/fantasy_neverland.jpg');

    const biome37 = getLevelBiome(37);
    expect(biome37.name).toBe('Monte Vesubio');
    expect(biome37.icon).toBe('🔮');
    expect(biome37.image).toBe('/fantasy_vesubio.jpg');

    const biome41 = getLevelBiome(41);
    expect(biome41.name).toBe('Tierras Infinitas');
    expect(biome41.icon).toBe('♾️');
    expect(biome41.image).toBe('/fantasy_infinite.jpg');
    expect(biome41.emoteSetName).toBe('Tierras Infinitas');
  });

  it('assigns unique and complete emote sets for each biome without twitch logo', () => {
    const allEmoteIcons = new Set<string>();

    for (let lvl = 1; lvl <= 45; lvl++) {
      const set = getEmoteSetForLevel(lvl);
      expect(set.colors.length).toBe(5);

      // Verify each slot corresponds to colors 0..4
      for (let c = 0; c < 5; c++) {
        expect(set.colors[c].color).toBe(c);
        expect(set.colors[c].emoteIcon.startsWith('/emotes/')).toBe(true);
        expect(set.colors[c].emoteIcon).not.toContain('875957811262152755'); // Twitch excluded
        allEmoteIcons.add(set.colors[c].emoteIcon);
      }
    }

    // All 35 emotes must be utilized across the game
    expect(allEmoteIcons.size).toBe(35);
  });
});

