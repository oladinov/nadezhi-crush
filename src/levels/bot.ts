import { CoreEngine } from '../core/resolver';
import { Board, Cell, LevelConfig } from '../core/types';

export interface BotSimulationOptions {
  seed: number;
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

  const config: LevelConfig = {
    level: 99999,
    seed: opts.seed,
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
        level: 99999,
        seed: opts.seed,
        rows,
        cols,
        colors,
        moves: engine.movesLeft,
        goals: [{ type: 'score', target: 10000000 }],
        boardOverride: engine.snapshot as unknown as Board,
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

  return {
    score: engine.progress.score,
    movesPlayed,
    movesLeft: engine.movesLeft,
  };
}
