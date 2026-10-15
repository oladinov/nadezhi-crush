import { CoreEngine } from '../core/resolver';
import { Board, Cell, LevelConfig } from '../core/types';
import { cloneBoard } from '../core/board';
import { hashString } from '../core/rng';

export interface BotSimulationOptions {
  seed?: number;
  level?: number;
  moves: number;
  colors?: 4 | 5;
  rows?: number;
  cols?: number;
}

export interface BotSimulationResult {
  score: number;
  movesPlayed: number;
  movesLeft: number;
}

const botCache = new Map<string, BotSimulationResult>();

/**
 * Deterministic greedy bot.
 * At each turn, evaluates all valid moves and executes the one with the highest immediate points gained.
 * Tiebreaker: fixed row-major move order.
 */
export function simulateGreedy(opts: BotSimulationOptions): BotSimulationResult {
  const rows = opts.rows ?? 8;
  const cols = opts.cols ?? 8;
  const colors = opts.colors ?? 5;
  const totalMoves = opts.moves;

  const cacheKey =
    opts.level !== undefined
      ? `lvl:${opts.level}:${totalMoves}:${colors}:${rows}:${cols}`
      : `${opts.seed}:${totalMoves}:${colors}:${rows}:${cols}`;
  const cached = botCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const levelNum = opts.level ?? 99999;
  const seedNum = opts.seed ?? hashString(`level_${levelNum}`);
  // If opts.level is provided, leave seedKey undefined so BoardRngManager uses `level_${level}` matching player
  const seedKeyVal = opts.level !== undefined ? undefined : seedNum;

  const config: LevelConfig = {
    level: levelNum,
    seed: seedNum,
    seedKey: seedKeyVal,
    rows,
    cols,
    colors,
    moves: totalMoves,
    goals: [{ type: 'score', target: 10000000 }],
  };

  const engine = new CoreEngine(config);
  let movesPlayed = 0;

  while (engine.movesLeft > 0) {
    const validMoves = engine.findValidMoves();
    if (validMoves.length === 0) break;

    let bestMove: { a: Cell; b: Cell } | null = null;
    let bestPoints = -1;

    for (const move of validMoves) {
      // Simulate move by creating a test engine matching current state
      const simConfig: LevelConfig = {
        level: levelNum,
        seed: seedNum,
        seedKey: seedKeyVal,
        rows,
        cols,
        colors,
        moves: engine.movesLeft,
        goals: [{ type: 'score', target: 10000000 }],
        boardOverride: cloneBoard(engine.snapshot as Board),
      };
      const simEngine = new CoreEngine(simConfig);
      // Copy exact RNG state for accurate lookahead
      simEngine.rngManager.initRng.state = engine.rngManager.initRng.state;
      simEngine.rngManager.shuffleRng.state = engine.rngManager.shuffleRng.state;
      for (let c = 0; c < cols; c++) {
        simEngine.rngManager.spawnRngs[c].state = engine.rngManager.spawnRngs[c].state;
      }

      const res = simEngine.resolveMove(move.a, move.b);
      if (res.accepted && res.pointsGained > bestPoints) {
        bestPoints = res.pointsGained;
        bestMove = move;
      }
    }

    if (!bestMove) {
      bestMove = validMoves[0];
    }

    const res = engine.resolveMove(bestMove.a, bestMove.b);
    if (!res.accepted) {
      break;
    }
    movesPlayed++;
  }

  const result: BotSimulationResult = {
    score: engine.progress.score,
    movesPlayed,
    movesLeft: engine.movesLeft,
  };
  botCache.set(cacheKey, result);
  return result;
}
