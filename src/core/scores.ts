/**
 * Scores, Records and Hall of Fame System for Nadezhi Match-3
 */

export interface LevelRecord {
  level: number;
  score: number;
  stars: 1 | 2 | 3;
  date: string;
  timestamp: number;
}

export interface HighScoreEntry {
  id: string;
  playerName: string;
  score: number;
  level: number;
  biomeName: string;
  biomeIcon: string;
  stars: 1 | 2 | 3;
  date: string;
  timestamp: number;
}

export interface PlayerStats {
  totalScore: number;
  levelsCompleted: number;
  threeStarCount: number;
  twoStarCount: number;
  oneStarCount: number;
  bestSingleScore: number;
  bestLevel: number;
}

export interface SaveScoreResult {
  isNewRecord: boolean;
  prevRecord: number;
  stars: 1 | 2 | 3;
  rankInHallOfFame: number | null;
  score: number;
}

/**
 * Feature Flags for Scores and Rankings
 */
export const FEATURE_FLAGS = {
  /**
   * Flag to toggle the global Hall of Fame ranking.
   * Set to false to hide/disable fictitious rankings, leaving pure authentic player progression with stars and level records.
   */
  ENABLE_HALL_OF_FAME: false,
};

export function isHallOfFameEnabled(): boolean {
  return FEATURE_FLAGS.ENABLE_HALL_OF_FAME;
}

export function setHallOfFameEnabled(enabled: boolean): void {
  FEATURE_FLAGS.ENABLE_HALL_OF_FAME = enabled;
}

const STORAGE_KEY_RECORDS = 'nadezhi_level_records';
const STORAGE_KEY_HOF = 'nadezhi_hall_of_fame';
const STORAGE_KEY_PLAYER_NAME = 'nadezhi_player_name';

// In-memory fallback if localStorage is disabled or running in test/SSR
const memoryStore: Record<string, string> = {};

function safeGetItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // Fallback to memory
  }
  return memoryStore[key] || null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Fallback to memory
  }
  memoryStore[key] = value;
}

function formatDate(date: Date): string {
  try {
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return date.toISOString().split('T')[0];
  }
}

export const DEFAULT_HALL_OF_FAME: HighScoreEntry[] = [
  {
    id: 'hof-1',
    playerName: 'Thorin Escudo de Roble',
    score: 52400,
    level: 24,
    biomeName: 'Erebor',
    biomeIcon: '⛏️',
    stars: 3,
    date: '12 may 2026',
    timestamp: 1778544000000,
  },
  {
    id: 'hof-2',
    playerName: 'Peter Pan',
    score: 48100,
    level: 36,
    biomeName: 'Nunca Jamás',
    biomeIcon: '🏴‍☠️',
    stars: 3,
    date: '18 jun 2026',
    timestamp: 1781740800000,
  },
  {
    id: 'hof-3',
    playerName: 'Magica De Spell',
    score: 43900,
    level: 40,
    biomeName: 'Monte Vesubio',
    biomeIcon: '🔮',
    stars: 3,
    date: '02 jul 2026',
    timestamp: 1782950400000,
  },
  {
    id: 'hof-4',
    playerName: 'Elrond de Rivendel',
    score: 39200,
    level: 28,
    biomeName: 'Númenórë',
    biomeIcon: '⚓',
    stars: 3,
    date: '15 jul 2026',
    timestamp: 1784073600000,
  },
  {
    id: 'hof-5',
    playerName: 'Campanita',
    score: 34600,
    level: 32,
    biomeName: 'Pixie Hollow',
    biomeIcon: '🧚',
    stars: 3,
    date: '28 jul 2026',
    timestamp: 1785196800000,
  },
  {
    id: 'hof-6',
    playerName: 'Gandalf el Gris',
    score: 29500,
    level: 20,
    biomeName: 'Monte del Destino',
    biomeIcon: '🌋',
    stars: 3,
    date: '05 ago 2026',
    timestamp: 1785888000000,
  },
  {
    id: 'hof-7',
    playerName: 'Frodo Bolsón',
    score: 24000,
    level: 4,
    biomeName: 'Praderas del Valle',
    biomeIcon: '🌿',
    stars: 3,
    date: '12 ago 2026',
    timestamp: 1786492800000,
  },
  {
    id: 'hof-8',
    playerName: 'Samwise Gamgee',
    score: 19800,
    level: 8,
    biomeName: 'Colinas del Atardecer',
    biomeIcon: '🌅',
    stars: 3,
    date: '22 ago 2026',
    timestamp: 1787356800000,
  },
  {
    id: 'hof-9',
    playerName: 'Merry & Pippin',
    score: 15200,
    level: 12,
    biomeName: 'Caverna de Cristales',
    biomeIcon: '🔮',
    stars: 3,
    date: '01 sep 2026',
    timestamp: 1788220800000,
  },
  {
    id: 'hof-10',
    playerName: 'Bégimo del Bosque',
    score: 11500,
    level: 16,
    biomeName: 'Bosque de las Luciérnagas',
    biomeIcon: '🌲',
    stars: 2,
    date: '10 sep 2026',
    timestamp: 1788998400000,
  },
];

/**
 * Calculates star rating (1-3) based on score and target score.
 * - 1 Star: Complete level (score >= targetScore)
 * - 2 Stars: Reaching at least 135% of targetScore
 * - 3 Stars: Reaching at least 175% of targetScore
 */
export function calculateStars(score: number, targetScore: number): 1 | 2 | 3 {
  const safeTarget = Math.max(1, targetScore);
  if (score >= Math.round(safeTarget * 1.75)) {
    return 3;
  }
  if (score >= Math.round(safeTarget * 1.35)) {
    return 2;
  }
  return 1;
}

/**
 * Retrieves the current player's nickname.
 */
export function getPlayerName(): string {
  const stored = safeGetItem(STORAGE_KEY_PLAYER_NAME);
  if (stored && stored.trim().length > 0) {
    return stored.trim();
  }
  return 'Aventurero';
}

/**
 * Updates the current player's nickname.
 */
export function setPlayerName(name: string): string {
  const cleaned = name.trim().slice(0, 20) || 'Aventurero';
  safeSetItem(STORAGE_KEY_PLAYER_NAME, cleaned);
  return cleaned;
}

/**
 * Retrieves all level records with runtime sanitization against corrupted localStorage data.
 */
export function getAllLevelRecords(): Record<number, LevelRecord> {
  const raw = safeGetItem(STORAGE_KEY_RECORDS);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const sanitized: Record<number, LevelRecord> = {};
      for (const [key, val] of Object.entries(parsed)) {
        const lvl = Number(key);
        if (!Number.isInteger(lvl) || lvl < 1 || lvl > 10000) continue;
        if (!val || typeof val !== 'object') continue;
        const rec = val as Record<string, unknown>;
        const score = typeof rec.score === 'number' && Number.isFinite(rec.score) ? Math.max(0, Math.floor(rec.score)) : 0;
        const rawStars = typeof rec.stars === 'number' ? Math.floor(rec.stars) : 1;
        const stars = (rawStars >= 3 ? 3 : rawStars === 2 ? 2 : 1) as 1 | 2 | 3;
        const date = typeof rec.date === 'string' ? rec.date.slice(0, 32) : '';
        const timestamp = typeof rec.timestamp === 'number' && Number.isFinite(rec.timestamp) ? rec.timestamp : 0;
        sanitized[lvl] = {
          level: lvl,
          score,
          stars,
          date,
          timestamp,
        };
      }
      return sanitized;
    }
  } catch {
    // Ignore JSON error
  }
  return {};
}

/**
 * Retrieves the record for a specific level.
 */
export function getLevelRecord(level: number): LevelRecord | null {
  const all = getAllLevelRecords();
  return all[level] || null;
}

/**
 * Retrieves the Top 10 Hall of Fame list with runtime sanitization.
 */
export function getHallOfFame(): HighScoreEntry[] {
  const raw = safeGetItem(STORAGE_KEY_HOF);
  if (!raw) {
    return [...DEFAULT_HALL_OF_FAME];
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const sanitized: HighScoreEntry[] = [];
      for (const item of parsed.slice(0, 10)) {
        if (!item || typeof item !== 'object') continue;
        const entry = item as Record<string, unknown>;
        const rawStars = typeof entry.stars === 'number' ? Math.floor(entry.stars) : 1;
        sanitized.push({
          id: typeof entry.id === 'string' ? entry.id.slice(0, 64) : `hof-${sanitized.length}`,
          playerName: typeof entry.playerName === 'string' ? entry.playerName.trim().slice(0, 40) || 'Aventurero' : 'Aventurero',
          score: typeof entry.score === 'number' && Number.isFinite(entry.score) ? Math.max(0, Math.floor(entry.score)) : 0,
          level: typeof entry.level === 'number' && Number.isInteger(entry.level) ? Math.max(1, entry.level) : 1,
          biomeName: typeof entry.biomeName === 'string' ? entry.biomeName.slice(0, 40) : '',
          biomeIcon: typeof entry.biomeIcon === 'string' ? entry.biomeIcon.slice(0, 8) : '',
          stars: (rawStars >= 3 ? 3 : rawStars === 2 ? 2 : 1) as 1 | 2 | 3,
          date: typeof entry.date === 'string' ? entry.date.slice(0, 32) : '',
          timestamp: typeof entry.timestamp === 'number' && Number.isFinite(entry.timestamp) ? entry.timestamp : 0,
        });
      }
      if (sanitized.length > 0) {
        return sanitized;
      }
    }
  } catch {
    // Ignore JSON error
  }
  return [...DEFAULT_HALL_OF_FAME];
}

/**
 * Saves a completed level score, checking for level personal records and Top 10 Hall of Fame ranking.
 */
export function saveLevelScore(
  level: number,
  score: number,
  targetScore: number,
  biomeName: string,
  biomeIcon: string
): SaveScoreResult {
  const stars = calculateStars(score, targetScore);
  const now = new Date();
  const dateStr = formatDate(now);
  const timestamp = now.getTime();

  // 1. Level personal best record
  const allRecords = getAllLevelRecords();
  const existing = allRecords[level];
  let isNewRecord = false;
  let prevRecord = 0;

  if (!existing) {
    isNewRecord = true;
    prevRecord = 0;
    allRecords[level] = {
      level,
      score,
      stars,
      date: dateStr,
      timestamp,
    };
  } else {
    prevRecord = existing.score;
    if (score > existing.score) {
      isNewRecord = true;
      allRecords[level] = {
        level,
        score,
        stars: Math.max(stars, existing.stars) as 1 | 2 | 3,
        date: dateStr,
        timestamp,
      };
    } else {
      // Keep best score, but upgrade stars if somehow higher
      if (stars > existing.stars) {
        allRecords[level].stars = stars;
      }
    }
  }

  safeSetItem(STORAGE_KEY_RECORDS, JSON.stringify(allRecords));

  // 2. Hall of Fame Top 10 (Guarded by feature flag)
  let rankInHallOfFame: number | null = null;
  if (FEATURE_FLAGS.ENABLE_HALL_OF_FAME) {
    const hof = getHallOfFame();
    const playerName = getPlayerName();

    const newEntry: HighScoreEntry = {
      id: `entry-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      playerName,
      score,
      level,
      biomeName,
      biomeIcon,
      stars,
      date: dateStr,
      timestamp,
    };

    // Add entry, sort descending by score, take top 10
    const combined = [...hof, newEntry];
    combined.sort((a, b) => b.score - a.score);
    const top10 = combined.slice(0, 10);

    const foundIndex = top10.findIndex((e) => e.id === newEntry.id);
    if (foundIndex !== -1) {
      rankInHallOfFame = foundIndex + 1;
      safeSetItem(STORAGE_KEY_HOF, JSON.stringify(top10));
    }
  }

  return {
    isNewRecord,
    prevRecord,
    stars,
    rankInHallOfFame,
    score,
  };
}

/**
 * Calculates aggregated player stats across all recorded levels.
 */
export function getPlayerStats(): PlayerStats {
  const records = getAllLevelRecords();
  const list = Object.values(records);

  let totalScore = 0;
  let threeStarCount = 0;
  let twoStarCount = 0;
  let oneStarCount = 0;
  let bestSingleScore = 0;
  let bestLevel = 1;

  for (const r of list) {
    totalScore += r.score;
    if (r.stars === 3) threeStarCount++;
    else if (r.stars === 2) twoStarCount++;
    else if (r.stars === 1) oneStarCount++;

    if (r.score > bestSingleScore) {
      bestSingleScore = r.score;
      bestLevel = r.level;
    }
  }

  return {
    totalScore,
    levelsCompleted: list.length,
    threeStarCount,
    twoStarCount,
    oneStarCount,
    bestSingleScore,
    bestLevel,
  };
}

/**
 * Resets all stored scores and records (useful for testing or profile reset).
 */
export function resetScores(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY_RECORDS);
      window.localStorage.removeItem(STORAGE_KEY_HOF);
      window.localStorage.removeItem(STORAGE_KEY_PLAYER_NAME);
    }
  } catch {
    // Ignore
  }
  delete memoryStore[STORAGE_KEY_RECORDS];
  delete memoryStore[STORAGE_KEY_HOF];
  delete memoryStore[STORAGE_KEY_PLAYER_NAME];
}
