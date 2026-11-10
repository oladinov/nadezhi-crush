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

  it('assigns fantasy biomes in 15-level chapters up to Tierras Infinitas', () => {
    const biome15 = getLevelBiome(15);
    expect(biome15.name).toBe('Praderas del Valle');

    const biome30 = getLevelBiome(30);
    expect(biome30.name).toBe('Colinas del Atardecer');

    const biome45 = getLevelBiome(45);
    expect(biome45.name).toBe('Caverna de Cristales');

    const biome60 = getLevelBiome(60);
    expect(biome60.name).toBe('Bosque de las Luciérnagas');

    const biome75 = getLevelBiome(75);
    expect(biome75.name).toBe('Monte del Destino');
    expect(biome75.image).toBe('/fantasy_volcano.jpg');

    const biome83 = getLevelBiome(83);
    expect(biome83.name).toBe('Erebor');
    expect(biome83.icon).toBe('⛏️');
    expect(biome83.image).toBe('/fantasy_erebor.jpg');

    const biome104 = getLevelBiome(104);
    expect(biome104.name).toBe('Númenórë');
    expect(biome104.icon).toBe('⚓');
    expect(biome104.image).toBe('/fantasy_numenor.jpg');

    const biome120 = getLevelBiome(120);
    expect(biome120.name).toBe('Pixie Hollow');
    expect(biome120.icon).toBe('🧚');
    expect(biome120.image).toBe('/fantasy_pixie.jpg');

    const biome135 = getLevelBiome(135);
    expect(biome135.name).toBe('Nunca Jamás');
    expect(biome135.icon).toBe('🏴‍☠️');
    expect(biome135.image).toBe('/fantasy_neverland.jpg');

    const biome150 = getLevelBiome(150);
    expect(biome150.name).toBe('Monte Vesubio');
    expect(biome150.icon).toBe('🔮');
    expect(biome150.image).toBe('/fantasy_vesubio.jpg');

    const biome151 = getLevelBiome(151);
    expect(biome151.name).toBe('Tierras Infinitas');
    expect(biome151.icon).toBe('♾️');
    expect(biome151.image).toBe('/fantasy_infinite.jpg');
    expect(biome151.emoteSetName).toBe('Tierras Infinitas');
  });

  it('assigns unique and complete emote sets for each biome without twitch logo', () => {
    const allEmoteIcons = new Set<string>();

    for (let lvl = 1; lvl <= 165; lvl++) {
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

  it('rotates all 7 emote sets every 15 levels in Tierras Infinitas (151+)', () => {
    expect(getEmoteSetForLevel(151).id).toBe('tierras_infinitas');
    expect(getEmoteSetForLevel(165).id).toBe('tierras_infinitas');
    expect(getEmoteSetForLevel(166).id).toBe('elenco_original');
    expect(getEmoteSetForLevel(180).id).toBe('elenco_original');
    expect(getEmoteSetForLevel(181).id).toBe('show_palomitas');
    expect(getEmoteSetForLevel(195).id).toBe('show_palomitas');
    expect(getEmoteSetForLevel(196).id).toBe('ciudadela_arcana');
    expect(getEmoteSetForLevel(210).id).toBe('ciudadela_arcana');
    expect(getEmoteSetForLevel(211).id).toBe('noche_magica');
    expect(getEmoteSetForLevel(225).id).toBe('noche_magica');
    expect(getEmoteSetForLevel(226).id).toBe('forja_volcan');
    expect(getEmoteSetForLevel(240).id).toBe('forja_volcan');
    expect(getEmoteSetForLevel(241).id).toBe('travesia_corsaria');
    expect(getEmoteSetForLevel(255).id).toBe('travesia_corsaria');
    // Cycle repeats at 256
    expect(getEmoteSetForLevel(256).id).toBe('tierras_infinitas');
  });

  it('calibrates Level 65, 83 and 89 with soft-cap and sawtooth curve without extreme outlier spikes', () => {
    const lvl65 = generateLevel(65);
    expect(lvl65.level).toBe(65);
    expect(lvl65.moves).toBe(18);
    const score65 = lvl65.goals.find((g) => g.type === 'score');
    expect(score65?.type === 'score' && score65.target).toBe(16500);

    const lvl83 = generateLevel(83);
    expect(lvl83.moves).toBe(15);
    const score83 = lvl83.goals.find((g) => g.type === 'score');
    expect(score83?.type === 'score' && score83.target).toBe(19500);

    const lvl89 = generateLevel(89);
    expect(lvl89.moves).toBe(15);
    const score89 = lvl89.goals.find((g) => g.type === 'score');
    expect(score89?.type === 'score' && score89.target).toBeLessThanOrEqual(23500);
  });
});

