import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateStars,
  getPlayerName,
  setPlayerName,
  getLevelRecord,
  saveLevelScore,
  getHallOfFame,
  getPlayerStats,
  resetScores,
  isHallOfFameEnabled,
  setHallOfFameEnabled,
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
});
