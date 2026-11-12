import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateStars,
  getPlayerName,
  setPlayerName,
  getLevelRecord,
  getAllLevelRecords,
  saveLevelScore,
  getHallOfFame,
  getPlayerStats,
  resetScores,
  isHallOfFameEnabled,
  setHallOfFameEnabled,
  getSavedLevelProgress,
  saveLevelProgress,
  verifyStorageIntegrity,
  computeStorageHash,
  STORAGE_KEY_CURRENT_LEVEL,
  STORAGE_KEY_MAX_LEVEL,
  STORAGE_KEY_RECORDS,
  STORAGE_KEY_INTEGRITY_HASH,
} from '../src/core/scores';

describe('Scores and Hall of Fame System', () => {
  beforeEach(() => {
    resetScores();
    setHallOfFameEnabled(false);
  });

  describe('Feature Flag ENABLE_HALL_OF_FAME', () => {
    it('is disabled by default to avoid fictitious scores', () => {
      expect(isHallOfFameEnabled()).toBe(false);
    });

    it('does not insert into Hall of Fame when feature flag is disabled', () => {
      setPlayerName('Aventurero');
      const res = saveLevelScore(24, 99999, 25000, 'Erebor', '⛏️');
      expect(res.rankInHallOfFame).toBeNull();
      expect(res.stars).toBe(3);
      expect(res.isNewRecord).toBe(true);
    });

    it('can be dynamically enabled and disabled', () => {
      setHallOfFameEnabled(true);
      expect(isHallOfFameEnabled()).toBe(true);
      setHallOfFameEnabled(false);
      expect(isHallOfFameEnabled()).toBe(false);
    });
  });

  describe('calculateStars (1-3 stars rating per level)', () => {
    it('awards 1 star for meeting the target score', () => {
      expect(calculateStars(2000, 2000)).toBe(1);
      expect(calculateStars(2500, 2000)).toBe(1); // 1.25x
    });

    it('awards 2 stars for reaching at least 135% of target score', () => {
      expect(calculateStars(2700, 2000)).toBe(2); // 1.35x
      expect(calculateStars(3400, 2000)).toBe(2); // 1.70x
    });

    it('awards 3 stars for reaching at least 175% of target score', () => {
      expect(calculateStars(3500, 2000)).toBe(3); // 1.75x
      expect(calculateStars(5000, 2000)).toBe(3); // 2.5x
    });

    it('handles edge cases gracefully', () => {
      expect(calculateStars(0, 0)).toBe(1); // 0 score gives 1 base star
      expect(calculateStars(100, 1000)).toBe(1);
    });
  });

  describe('Player Name', () => {
    it('defaults to Aventurero', () => {
      expect(getPlayerName()).toBe('Aventurero');
    });

    it('updates player name and trims whitespace', () => {
      const saved = setPlayerName('  Rey Aragorn  ');
      expect(saved).toBe('Rey Aragorn');
      expect(getPlayerName()).toBe('Rey Aragorn');
    });

    it('truncates names longer than 20 characters', () => {
      const longName = 'LegolasHojaVerdeDelBosqueNegro';
      const saved = setPlayerName(longName);
      expect(saved.length).toBeLessThanOrEqual(20);
      expect(saved).toBe(longName.slice(0, 20));
    });

    it('falls back to Aventurero when given empty string', () => {
      setPlayerName('   ');
      expect(getPlayerName()).toBe('Aventurero');
    });
  });

  describe('saveLevelScore and Records (Personal Best & Stars)', () => {
    it('saves a new level score as personal record with accurate stars', () => {
      const res = saveLevelScore(1, 4000, 2000, 'Praderas del Valle', '🌿');
      expect(res.isNewRecord).toBe(true);
      expect(res.prevRecord).toBe(0);
      expect(res.stars).toBe(3);
      expect(res.score).toBe(4000);

      const rec = getLevelRecord(1);
      expect(rec).not.toBeNull();
      expect(rec?.score).toBe(4000);
      expect(rec?.stars).toBe(3);
      expect(rec?.level).toBe(1);
    });

    it('does not overwrite higher score with a lower score', () => {
      saveLevelScore(1, 4500, 2000, 'Praderas del Valle', '🌿');
      const res2 = saveLevelScore(1, 3000, 2000, 'Praderas del Valle', '🌿');

      expect(res2.isNewRecord).toBe(false);
      expect(res2.prevRecord).toBe(4500);

      const rec = getLevelRecord(1);
      expect(rec?.score).toBe(4500);
    });

    it('upgrades record if subsequent run beats previous score', () => {
      saveLevelScore(2, 2200, 2000, 'Praderas del Valle', '🌿');
      const res = saveLevelScore(2, 5000, 2000, 'Praderas del Valle', '🌿');

      expect(res.isNewRecord).toBe(true);
      expect(res.prevRecord).toBe(2200);
      expect(res.stars).toBe(3);

      const rec = getLevelRecord(2);
      expect(rec?.score).toBe(5000);
    });
  });

  describe('Hall of Fame (when enabled via feature flag)', () => {
    beforeEach(() => {
      setHallOfFameEnabled(true);
    });

    it('returns default 10 fantasy entries initially', () => {
      const hof = getHallOfFame();
      expect(hof.length).toBe(10);
      expect(hof[0].playerName).toBe('Thorin Escudo de Roble');
      expect(hof[0].score).toBe(52400);
      expect(hof[9].playerName).toBe('Bégimo del Bosque');
    });

    it('places player at Rank #1 when beating the all-time high score', () => {
      setPlayerName('Gimli');
      const res = saveLevelScore(24, 60000, 25000, 'Erebor', '⛏️');

      expect(res.rankInHallOfFame).toBe(1);

      const hof = getHallOfFame();
      expect(hof.length).toBe(10);
      expect(hof[0].playerName).toBe('Gimli');
      expect(hof[0].score).toBe(60000);
      expect(hof[1].playerName).toBe('Thorin Escudo de Roble');
    });

    it('places player at intermediate rank when qualifying into Top 10', () => {
      setPlayerName('Legolas');
      // Score of 30,000 beats Gandalf (29,500) and places at Rank #6
      const res = saveLevelScore(20, 30000, 15000, 'Monte del Destino', '🌋');

      expect(res.rankInHallOfFame).toBe(6);

      const hof = getHallOfFame();
      expect(hof.length).toBe(10);
      expect(hof[5].playerName).toBe('Legolas');
      expect(hof[5].score).toBe(30000);
    });

    it('does not rank player in Hall of Fame if score is lower than 10th place', () => {
      setPlayerName('Novato');
      // 5,000 is lower than 10th place (11,500)
      const res = saveLevelScore(1, 5000, 2000, 'Praderas del Valle', '🌿');

      expect(res.rankInHallOfFame).toBeNull();
      const hof = getHallOfFame();
      expect(hof.find((e) => e.playerName === 'Novato')).toBeUndefined();
    });
  });

  describe('Player Stats Aggregation', () => {
    it('computes accurate career statistics across levels', () => {
      saveLevelScore(1, 4000, 2000, 'Praderas del Valle', '🌿'); // 3 stars
      saveLevelScore(2, 2800, 2000, 'Praderas del Valle', '🌿'); // 2 stars
      saveLevelScore(3, 2100, 2000, 'Praderas del Valle', '🌿'); // 1 star

      const stats = getPlayerStats();
      expect(stats.levelsCompleted).toBe(3);
      expect(stats.totalScore).toBe(4000 + 2800 + 2100);
      expect(stats.threeStarCount).toBe(1);
      expect(stats.twoStarCount).toBe(1);
      expect(stats.oneStarCount).toBe(1);
      expect(stats.bestSingleScore).toBe(4000);
      expect(stats.bestLevel).toBe(1);
    });

    it('returns zeroes when no levels are recorded', () => {
      const stats = getPlayerStats();
      expect(stats.levelsCompleted).toBe(0);
      expect(stats.totalScore).toBe(0);
      expect(stats.threeStarCount).toBe(0);
      expect(stats.bestSingleScore).toBe(0);
    });
  });

  describe('Unlimited Level Progression & Storage Integrity Hash', () => {
    let mockStore: Record<string, string> = {};

    beforeEach(() => {
      mockStore = {};
      (globalThis as any).localStorage = {
        getItem: (k: string) => (k in mockStore ? mockStore[k] : null),
        setItem: (k: string, v: string) => {
          mockStore[k] = String(v);
        },
        removeItem: (k: string) => {
          delete mockStore[k];
        },
      };
      resetScores();
    });

    it('allows progressing and saving records well beyond level 10,000 without any artificial cap', () => {
      const progress = saveLevelProgress(15420, 15420);
      expect(progress.currentLevel).toBe(15420);
      expect(progress.maxLevel).toBe(15420);

      const loaded = getSavedLevelProgress();
      expect(loaded.currentLevel).toBe(15420);
      expect(loaded.maxLevel).toBe(15420);

      saveLevelScore(15420, 45000, 20000, 'Tierras Infinitas', '♾️');
      const rec = getLevelRecord(15420);
      expect(rec).not.toBeNull();
      expect(rec?.level).toBe(15420);
      expect(rec?.score).toBe(45000);
      expect(rec?.stars).toBe(3);
    });

    it('migrates legacy unhashed progress on first load without losing data and seals it with a hash', () => {
      // Simulate existing pre-hash device data in localStorage
      mockStore[STORAGE_KEY_CURRENT_LEVEL] = '10000';
      mockStore[STORAGE_KEY_MAX_LEVEL] = '10000';
      mockStore[STORAGE_KEY_RECORDS] = JSON.stringify({
        10000: {
          level: 10000,
          score: 38000,
          stars: 3,
          date: '11 nov 2026',
          timestamp: 1794355200000,
        },
      });
      expect(mockStore[STORAGE_KEY_INTEGRITY_HASH]).toBeUndefined();

      // First load should preserve progress and generate the integrity hash
      const loaded = getSavedLevelProgress();
      expect(loaded.currentLevel).toBe(10000);
      expect(loaded.maxLevel).toBe(10000);
      expect(mockStore[STORAGE_KEY_INTEGRITY_HASH]).toBeDefined();
      expect(mockStore[STORAGE_KEY_INTEGRITY_HASH]).toBe(computeStorageHash());

      const rec = getLevelRecord(10000);
      expect(rec?.score).toBe(38000);
    });

    it('resets all progress to default values if maxLevel or currentLevel is manually altered in localStorage', () => {
      saveLevelProgress(250, 250);
      saveLevelScore(250, 30000, 15000, 'Tierras Infinitas', '♾️');
      setPlayerName('Oscar');

      // Simulate manual tampering in DevTools localStorage
      mockStore[STORAGE_KEY_MAX_LEVEL] = '99999';

      const afterTamper = getSavedLevelProgress();
      expect(afterTamper.currentLevel).toBe(1);
      expect(afterTamper.maxLevel).toBe(1);
      expect(getAllLevelRecords()).toEqual({});
      expect(getPlayerName()).toBe('Aventurero');
    });

    it('resets all progress to default values if level records are manually altered in localStorage', () => {
      saveLevelProgress(42, 42);
      saveLevelScore(42, 12000, 10000, 'Caverna de Cristales', '🔮');

      // Tamper with the score in localStorage without updating hash
      const tamperedRecords = JSON.parse(mockStore[STORAGE_KEY_RECORDS]);
      tamperedRecords['42'].score = 999999;
      mockStore[STORAGE_KEY_RECORDS] = JSON.stringify(tamperedRecords);

      expect(getAllLevelRecords()).toEqual({});
      const progress = getSavedLevelProgress();
      expect(progress.currentLevel).toBe(1);
      expect(progress.maxLevel).toBe(1);
    });

    it('resets all progress to default values if integrity hash is deleted or modified after sealing', () => {
      saveLevelProgress(120, 120);
      saveLevelScore(120, 25000, 12000, 'Pixie Hollow', '🧚');

      // Delete the hash during the session and try to read
      delete mockStore[STORAGE_KEY_INTEGRITY_HASH];
      expect(verifyStorageIntegrity()).toBe(false);
      expect(getSavedLevelProgress()).toEqual({ currentLevel: 1, maxLevel: 1 });
      expect(getAllLevelRecords()).toEqual({});
    });
  });
});
