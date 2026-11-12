/**
 * Scores, Records and Hall of Fame System for Nadezhi Match-3
 */

import { hashString } from './rng';

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

export const STORAGE_KEY_CURRENT_LEVEL = 'nadezhi_current_level';
export const STORAGE_KEY_MAX_LEVEL = 'nadezhi_max_level';
export const STORAGE_KEY_RECORDS = 'nadezhi_level_records';
export const STORAGE_KEY_HOF = 'nadezhi_hall_of_fame';
export const STORAGE_KEY_PLAYER_NAME = 'nadezhi_player_name';
export const STORAGE_KEY_INTEGRITY_HASH = 'nadezhi_integrity_hash';

const INTEGRITY_SALT_A = 'nadezhi_v1_salt_alpha_9f8e7d6c';
const INTEGRITY_SALT_B = 'nadezhi_v1_salt_omega_3b2a1c0d';

// Tracks whether the storage hash has already been sealed during the current runtime session
let hasSealedInSession = false;

// In-memory fallback if localStorage is disabled or running in test/SSR
const memoryStore: Record<string, string> = {};

function getBrowserStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined' && localStorage) {
      return localStorage;
    }
  } catch {
    // Ignore security/SSR errors
  }
  return null;
}

function safeGetItem(key: string): string | null {
  try {
    const store = getBrowserStorage();
    if (store) {
      return store.getItem(key);
    }
  } catch {
    // Fallback to memory
  }
  return memoryStore[key] ?? null;
}

function safeSetItem(key: string, value: string): void {
  try {
    const store = getBrowserStorage();
    if (store) {
      store.setItem(key, value);
    }
  } catch {
    // Fallback to memory
  }
  memoryStore[key] = value;
}

function safeRemoveItem(key: string): void {
  try {
    const store = getBrowserStorage();
    if (store) {
      store.removeItem(key);
    }
  } catch {
    // Ignore
  }
  delete memoryStore[key];
}

/**
 * Computes a deterministic 64-bit hexadecimal integrity hash across all protected storage keys.
 */
export function computeStorageHash(
  currentLevelRaw: string | null = safeGetItem(STORAGE_KEY_CURRENT_LEVEL),
  maxLevelRaw: string | null = safeGetItem(STORAGE_KEY_MAX_LEVEL),
  recordsRaw: string | null = safeGetItem(STORAGE_KEY_RECORDS),
  hofRaw: string | null = safeGetItem(STORAGE_KEY_HOF),
  playerNameRaw: string | null = safeGetItem(STORAGE_KEY_PLAYER_NAME)
): string {
  const payload = [
    currentLevelRaw ?? '',
    maxLevelRaw ?? '',
    recordsRaw ?? '',
    hofRaw ?? '',
    playerNameRaw ?? '',
  ].join('|§|');
  const h1 = hashString(`${INTEGRITY_SALT_A}:${payload}`).toString(16).padStart(8, '0');
  const h2 = hashString(`${payload}:${INTEGRITY_SALT_B}`).toString(16).padStart(8, '0');
  return `${h1}${h2}`;
}

function updateIntegrityHash(): void {
  const hash = computeStorageHash();
  safeSetItem(STORAGE_KEY_INTEGRITY_HASH, hash);
  hasSealedInSession = true;
}

function isLegacyDataValid(
  curRaw: string | null,
  maxRaw: string | null,
  recordsRaw: string | null,
  hofRaw: string | null
): boolean {
  if (curRaw !== null) {
    const cur = Number(curRaw);
    if (!Number.isSafeInteger(cur) || cur < 1) return false;
  }
  if (maxRaw !== null) {
    const max = Number(maxRaw);
    if (!Number.isSafeInteger(max) || max < 1) return false;
  }
  if (recordsRaw !== null) {
    try {
      const parsed = JSON.parse(recordsRaw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
      for (const [k, v] of Object.entries(parsed)) {
        const lvl = Number(k);
        if (!Number.isSafeInteger(lvl) || lvl < 1) return false;
        if (!v || typeof v !== 'object') return false;
      }
    } catch {
      return false;
    }
  }
  if (hofRaw !== null) {
    try {
      const parsed = JSON.parse(hofRaw);
      if (!Array.isArray(parsed)) return false;
    } catch {
      return false;
    }
  }
  return true;
}

function resetToDefaultsOnTamper(): void {
  safeRemoveItem(STORAGE_KEY_CURRENT_LEVEL);
  safeRemoveItem(STORAGE_KEY_MAX_LEVEL);
  safeRemoveItem(STORAGE_KEY_RECORDS);
  safeRemoveItem(STORAGE_KEY_HOF);
  safeRemoveItem(STORAGE_KEY_PLAYER_NAME);
  updateIntegrityHash();
}

/**
 * Verifies that localStorage data matches its stored integrity hash.
 * - On first load with legacy data (no hash yet), validates and seals the existing progress.
 * - If any data was altered or the hash does not match, resets all progress to default values.
 */
export function verifyStorageIntegrity(): boolean {
  const curRaw = safeGetItem(STORAGE_KEY_CURRENT_LEVEL);
  const maxRaw = safeGetItem(STORAGE_KEY_MAX_LEVEL);
  const recordsRaw = safeGetItem(STORAGE_KEY_RECORDS);
  const hofRaw = safeGetItem(STORAGE_KEY_HOF);
  const nameRaw = safeGetItem(STORAGE_KEY_PLAYER_NAME);
  const storedHash = safeGetItem(STORAGE_KEY_INTEGRITY_HASH);

  const isEmpty =
    curRaw === null &&
    maxRaw === null &&
    recordsRaw === null &&
    hofRaw === null &&
    nameRaw === null;

  if (storedHash === null) {
    if (isEmpty) {
      return true;
    }
    // First-time migration from pre-hash version (only allowed before session is sealed)
    if (!hasSealedInSession && isLegacyDataValid(curRaw, maxRaw, recordsRaw, hofRaw)) {
      updateIntegrityHash();
      return true;
    }
    // Hash was deleted after sealing or legacy data was corrupted/tampered
    resetToDefaultsOnTamper();
    return false;
  }

  const expectedHash = computeStorageHash(curRaw, maxRaw, recordsRaw, hofRaw, nameRaw);
  if (storedHash !== expectedHash) {
    resetToDefaultsOnTamper();
    return false;
  }

  hasSealedInSession = true;
  return true;
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
 * Retrieves saved currentLevel and maxLevel with integrity check and no upper level cap.
 */
export function getSavedLevelProgress(): { currentLevel: number; maxLevel: number } {
  verifyStorageIntegrity();
  let currentLevel = 1;
  let maxLevel = 1;

  const savedCur = safeGetItem(STORAGE_KEY_CURRENT_LEVEL);
  const savedMax = safeGetItem(STORAGE_KEY_MAX_LEVEL);

  if (savedCur) {
    const curNum = Number(savedCur);
    if (Number.isSafeInteger(curNum) && curNum >= 1) {
      currentLevel = curNum;
    }
  }
  if (savedMax) {
    const maxNum = Number(savedMax);
    if (Number.isSafeInteger(maxNum) && maxNum >= 1) {
      maxLevel = maxNum;
    }
  }
  maxLevel = Math.max(maxLevel, currentLevel);
  return { currentLevel, maxLevel };
}

/**
 * Saves currentLevel and maxLevel and updates the storage integrity hash.
 * If tampering was detected in storage prior to saving, resets progress to level 1.
 */
export function saveLevelProgress(
  currentLevel: number,
  maxLevel: number
): { currentLevel: number; maxLevel: number } {
  const intact = verifyStorageIntegrity();
  if (!intact) {
    safeSetItem(STORAGE_KEY_CURRENT_LEVEL, '1');
    safeSetItem(STORAGE_KEY_MAX_LEVEL, '1');
    updateIntegrityHash();
    return { currentLevel: 1, maxLevel: 1 };
  }
  const safeCur = Number.isSafeInteger(currentLevel) && currentLevel >= 1 ? currentLevel : 1;
  const safeMax = Math.max(
    safeCur,
    Number.isSafeInteger(maxLevel) && maxLevel >= 1 ? maxLevel : 1
  );
  safeSetItem(STORAGE_KEY_CURRENT_LEVEL, safeCur.toString());
  safeSetItem(STORAGE_KEY_MAX_LEVEL, safeMax.toString());
  updateIntegrityHash();
  return { currentLevel: safeCur, maxLevel: safeMax };
}

/**
 * Retrieves the current player's nickname.
 */
export function getPlayerName(): string {
  verifyStorageIntegrity();
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
  verifyStorageIntegrity();
  const cleaned = name.trim().slice(0, 20) || 'Aventurero';
  safeSetItem(STORAGE_KEY_PLAYER_NAME, cleaned);
  updateIntegrityHash();
  return cleaned;
}

/**
 * Retrieves all level records with integrity verification and runtime sanitization.
 */
export function getAllLevelRecords(): Record<number, LevelRecord> {
  verifyStorageIntegrity();
  const raw = safeGetItem(STORAGE_KEY_RECORDS);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const sanitized: Record<number, LevelRecord> = {};
      for (const [key, val] of Object.entries(parsed)) {
        const lvl = Number(key);
        if (!Number.isSafeInteger(lvl) || lvl < 1) continue;
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
  verifyStorageIntegrity();
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
          level: typeof entry.level === 'number' && Number.isSafeInteger(entry.level) ? Math.max(1, entry.level) : 1,
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

  // 1. Level personal best record (getAllLevelRecords also verifies storage integrity)
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
  updateIntegrityHash();

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
      updateIntegrityHash();
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
 * Resets all stored progress, scores, records, and integrity state.
 */
export function resetScores(): void {
  safeRemoveItem(STORAGE_KEY_CURRENT_LEVEL);
  safeRemoveItem(STORAGE_KEY_MAX_LEVEL);
  safeRemoveItem(STORAGE_KEY_RECORDS);
  safeRemoveItem(STORAGE_KEY_HOF);
  safeRemoveItem(STORAGE_KEY_PLAYER_NAME);
  safeRemoveItem(STORAGE_KEY_INTEGRITY_HASH);
  hasSealedInSession = false;
}
