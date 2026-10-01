import { describe, it, expect } from 'vitest';
import { CoreEngine } from '../src/core/resolver';
import { hashString, Mulberry32 } from '../src/core/rng';
import { LevelConfig, Board, Gem } from '../src/core/types';
import { evaluateMatches } from '../src/core/patterns';
import { computeBoardHash, createEmptyBoard } from '../src/core/board';
import { findValidMoves } from '../src/core/moves';

describe('Deterministic PRNG', () => {
  it('hashString produces expected 32-bit FNV-1a hashes', () => {
    const h1 = hashString('level_1');
    const h2 = hashString('level_1');
    const h3 = hashString('level_2');
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
    expect(typeof h1).toBe('number');
  });

  it('Mulberry32 produces reproducible sequences', () => {
    const rng1 = new Mulberry32(123456);
    const rng2 = new Mulberry32(123456);
    for (let i = 0; i < 50; i++) {
      expect(rng1.next()).toBe(rng2.next());
    }
  });
});

describe('Pattern Evaluator', () => {
  it('identifies 3 in line as plain match', () => {
    const board = createEmptyBoard(3, 3);
    board[0][0] = { id: 1, kind: 'normal', color: 0 };
    board[0][1] = { id: 2, kind: 'normal', color: 0 };
    board[0][2] = { id: 3, kind: 'normal', color: 0 };
    const matches = evaluateMatches(board);
    expect(matches.length).toBe(1);
    expect(matches[0].spawn).toBeNull();
  });

  it('identifies 4 in line as bomb tier 1', () => {
    const board = createEmptyBoard(4, 4);
    board[1][0] = { id: 1, kind: 'normal', color: 1 };
    board[1][1] = { id: 2, kind: 'normal', color: 1 };
    board[1][2] = { id: 3, kind: 'normal', color: 1 };
    board[1][3] = { id: 4, kind: 'normal', color: 1 };
    const matches = evaluateMatches(board, [{ r: 1, c: 0 }, { r: 1, c: 1 }]);
    expect(matches.length).toBe(1);
    expect(matches[0].spawn).not.toBeNull();
    expect(matches[0].spawn?.kind).toBe('bomb');
    expect(matches[0].spawn?.tier).toBe(1);
    expect(matches[0].spawn?.cell).toEqual({ r: 1, c: 1 });
  });

  it('identifies T/L intersection as bomb tier 2', () => {
    const board = createEmptyBoard(5, 5);
    // T shape of color 2 centered at (2, 2)
    board[2][1] = { id: 1, kind: 'normal', color: 2 };
    board[2][2] = { id: 2, kind: 'normal', color: 2 };
    board[2][3] = { id: 3, kind: 'normal', color: 2 };
    board[1][2] = { id: 4, kind: 'normal', color: 2 };
    board[3][2] = { id: 5, kind: 'normal', color: 2 };

    const matches = evaluateMatches(board);
    expect(matches.length).toBe(1);
    expect(matches[0].spawn).not.toBeNull();
    expect(matches[0].spawn?.kind).toBe('bomb');
    expect(matches[0].spawn?.tier).toBe(2);
    expect(matches[0].spawn?.cell).toEqual({ r: 2, c: 2 });
  });

  it('identifies 5 in line as rainbow', () => {
    const board = createEmptyBoard(6, 6);
    for (let c = 0; c < 5; c++) {
      board[3][c] = { id: c + 1, kind: 'normal', color: 3 };
    }
    const matches = evaluateMatches(board, [{ r: 3, c: 0 }, { r: 3, c: 4 }]);
    expect(matches.length).toBe(1);
    expect(matches[0].spawn).not.toBeNull();
    expect(matches[0].spawn?.kind).toBe('rainbow');
    expect(matches[0].spawn?.cell).toEqual({ r: 3, c: 4 });
  });
});

describe('Core Invariants across 1000 Seeds', () => {
  it('generates match-free boards with >=1 valid move and no nulls for 1000 seeds', () => {
    for (let s = 1; s <= 1000; s++) {
      const config: LevelConfig = {
        level: s,
        seed: hashString(`level_${s}`),
        rows: 8,
        cols: 8,
        colors: 5,
        moves: 20,
        goals: [{ type: 'score', target: 5000 }],
      };

      const engine = new CoreEngine(config);
      const snapshot = engine.snapshot;

      // 1. Check no nulls
      let totalGems = 0;
      const seenIds = new Set<number>();
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const gem = snapshot[r][c];
          expect(gem).not.toBeNull();
          if (gem) {
            totalGems++;
            expect(seenIds.has(gem.id)).toBe(false);
            seenIds.add(gem.id);
          }
        }
      }
      expect(totalGems).toBe(64);

      // 2. Check no matches initially
      const matches = evaluateMatches(snapshot as Board);
      expect(matches.length).toBe(0);

      // 3. Check >= 1 valid move
      const validMoves = engine.findValidMoves();
      expect(validMoves.length).toBeGreaterThan(0);
    }
  });
});

describe('Directed Fusion Matrix Tests', () => {
  function makeBaseBoard(): Board {
    const board = createEmptyBoard(8, 8);
    let id = 1;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        board[r][c] = { id: id++, kind: 'normal', color: ((r + c) % 4) as any };
      }
    }
    return board;
  }

  it('Case 1: Bomb + Bomb fusion clears row + col + 5x5 centered at b', () => {
    const board = makeBaseBoard();
    const a = { r: 3, c: 3 };
    const b = { r: 3, c: 4 };
    board[a.r][a.c] = { id: 100, kind: 'bomb', color: 0, tier: 1 };
    board[b.r][b.c] = { id: 101, kind: 'bomb', color: 1, tier: 1 };

    const config: LevelConfig = {
      level: 999,
      seed: 999,
      rows: 8,
      cols: 8,
      colors: 4,
      moves: 10,
      goals: [{ type: 'detonate', count: 2 }],
      boardOverride: board,
    };

    const engine = new CoreEngine(config);
    const res = engine.resolveMove(a, b);
    expect(res.accepted).toBe(true);
    expect(res.progress.detonated).toBeGreaterThanOrEqual(2);
    expect(res.steps.some((s) => s.type === 'detonate')).toBe(true);
  });

  it('Case 2: Rainbow + Normal destroys all gems of that color', () => {
    const board = makeBaseBoard();
    const a = { r: 2, c: 2 };
    const b = { r: 2, c: 3 };
    board[a.r][a.c] = { id: 200, kind: 'rainbow' };
    board[b.r][b.c] = { id: 201, kind: 'normal', color: 2 };

    const config: LevelConfig = {
      level: 998,
      seed: 998,
      rows: 8,
      cols: 8,
      colors: 4,
      moves: 10,
      goals: [{ type: 'collect', color: 2, count: 5 }],
      boardOverride: board,
    };

    const engine = new CoreEngine(config);
    const res = engine.resolveMove(a, b);
    expect(res.accepted).toBe(true);
    expect(res.progress.collected[2]).toBeGreaterThan(5);
  });

  it('Case 3: Rainbow + Bomb transforms all gems of that color into bombs and detonates them', () => {
    const board = makeBaseBoard();
    const a = { r: 4, c: 4 };
    const b = { r: 4, c: 5 };
    board[a.r][a.c] = { id: 300, kind: 'rainbow' };
    board[b.r][b.c] = { id: 301, kind: 'bomb', color: 1, tier: 1 };

    const config: LevelConfig = {
      level: 997,
      seed: 997,
      rows: 8,
      cols: 8,
      colors: 4,
      moves: 10,
      goals: [{ type: 'detonate', count: 5 }],
      boardOverride: board,
    };

    const engine = new CoreEngine(config);
    const res = engine.resolveMove(a, b);
    expect(res.accepted).toBe(true);
    expect(res.steps.some((s) => s.type === 'transform')).toBe(true);
    expect(res.progress.detonated).toBeGreaterThan(5);
  });

  it('Case 4: Rainbow + Rainbow triggers full board wipe in concentric waves', () => {
    const board = makeBaseBoard();
    const a = { r: 3, c: 3 };
    const b = { r: 3, c: 4 };
    board[a.r][a.c] = { id: 400, kind: 'rainbow' };
    board[b.r][b.c] = { id: 401, kind: 'rainbow' };

    const config: LevelConfig = {
      level: 996,
      seed: 996,
      rows: 8,
      cols: 8,
      colors: 4,
      moves: 10,
      goals: [{ type: 'score', target: 2500 }],
      boardOverride: board,
    };

    const engine = new CoreEngine(config);
    const res = engine.resolveMove(a, b);
    expect(res.accepted).toBe(true);
    expect(res.pointsGained).toBeGreaterThanOrEqual(2500);
    const clearStep = res.steps.find((s) => s.type === 'clear' && s.cause === 'fusion');
    expect(clearStep).toBeDefined();
    // Verify that waves spread outwards (multiple distinct wave indices)
    if (clearStep && clearStep.type === 'clear') {
      const waves = new Set(clearStep.cells.map((c) => c.wave));
      expect(waves.size).toBeGreaterThan(3);
    }
  });
});

describe('Replay and Determinism', () => {
  it('identical move sequence on same seed yields identical boardHash and points', () => {
    const config: LevelConfig = {
      level: 42,
      seed: hashString('level_42'),
      rows: 8,
      cols: 8,
      colors: 5,
      moves: 20,
      goals: [{ type: 'score', target: 10000 }],
    };

    const runSimulation = () => {
      const engine = new CoreEngine(config);
      const hashes: number[] = [];
      const scores: number[] = [];

      for (let i = 0; i < 5; i++) {
        const moves = engine.findValidMoves();
        if (moves.length === 0) break;
        const move = moves[0];
        const res = engine.resolveMove(move.a, move.b);
        hashes.push(res.boardHash);
        scores.push(res.progress.score);
      }
      return { hashes, scores };
    };

    const run1 = runSimulation();
    const run2 = runSimulation();

    expect(run1.hashes).toEqual(run2.hashes);
    expect(run1.scores).toEqual(run2.scores);
  });
});

describe('Bomb Matching and Detonate Triggers', () => {
  it('detonates a bomb when it is in a 3-in-a-line match (e.g. middle of 3)', () => {
    const board = createEmptyBoard(6, 6);
    let id = 1;
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        board[r][c] = { id: id++, kind: 'normal', color: 2 };
      }
    }
    // Row 5 has 3 in a line of color 0, with a bomb in the middle at (5, 2)
    board[5][1] = { id: 601, kind: 'normal', color: 0 };
    board[5][2] = { id: 602, kind: 'bomb', color: 0, tier: 1 };
    board[5][3] = { id: 603, kind: 'normal', color: 1 };
    board[4][3] = { id: 604, kind: 'normal', color: 0 }; // Swapping (4,3) and (5,3) completes the 3-line

    const config: LevelConfig = {
      level: 101,
      seed: 101,
      rows: 6,
      cols: 6,
      colors: 4,
      moves: 10,
      goals: [{ type: 'detonate', count: 1 }],
      boardOverride: board,
    };

    const engine = new CoreEngine(config);
    const res = engine.resolveMove({ r: 4, c: 3 }, { r: 5, c: 3 });
    expect(res.accepted).toBe(true);

    // Verify bomb detonated with trigger 'match'
    const detonateStep = res.steps.find((s) => s.type === 'detonate' && s.gem.id === 602);
    expect(detonateStep).toBeDefined();
    if (detonateStep && detonateStep.type === 'detonate') {
      expect(detonateStep.trigger?.type).toBe('match');
      expect(detonateStep.affected.length).toBeGreaterThan(0);
    }
    expect(res.progress.detonated).toBeGreaterThanOrEqual(1);
  });

  it('records correct triggers for bomb detonation: match vs blast', () => {
    const board = createEmptyBoard(6, 6);
    let id = 1;
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        board[r][c] = { id: id++, kind: 'normal', color: ((r + c) % 3) as any };
      }
    }
    // Place a bomb at (2, 2) of color 0
    board[2][2] = { id: 501, kind: 'bomb', color: 0, tier: 1 };
    // Place normal gems of color 0 at (2, 1) and (2, 4)
    board[2][1] = { id: 502, kind: 'normal', color: 0 };
    board[2][4] = { id: 503, kind: 'normal', color: 0 };
    // Place normal gem at (2, 3) with color 1, so swapping (2,3) with (2,4) creates a 3-match of color 0 at (2,1), (2,2), (2,3)
    board[2][3] = { id: 504, kind: 'normal', color: 1 };

    // Also place another bomb at (2, 0) within the 3x3 blast radius of (2, 2)
    board[2][0] = { id: 505, kind: 'bomb', color: 2, tier: 1 };

    const config: LevelConfig = {
      level: 102,
      seed: 102,
      rows: 6,
      cols: 6,
      colors: 4,
      moves: 10,
      goals: [{ type: 'detonate', count: 2 }],
      boardOverride: board,
    };

    const engine = new CoreEngine(config);
    const res = engine.resolveMove({ r: 2, c: 3 }, { r: 2, c: 4 });
    expect(res.accepted).toBe(true);

    const detonateSteps = res.steps.filter((s) => s.type === 'detonate');
    expect(detonateSteps.length).toBeGreaterThanOrEqual(1);

    // Primary bomb (501) was triggered by match
    const primary = detonateSteps.find((s) => s.type === 'detonate' && s.gem.id === 501);
    expect(primary).toBeDefined();
    if (primary && primary.type === 'detonate') {
      expect(primary.trigger).toBeDefined();
      expect(primary.trigger?.type).toBe('match');
    }

    // Chained bomb (505) was triggered by blast
    const chained = detonateSteps.find((s) => s.type === 'detonate' && s.gem.id === 505);
    if (chained && chained.type === 'detonate') {
      expect(chained.trigger).toBeDefined();
      expect(chained.trigger?.type).toBe('blast');
    }
  });
});
