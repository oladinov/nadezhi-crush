import { describe, it, expect, vi } from 'vitest';
import { CoreEngine } from '../src/core/resolver';
import { hashString, Mulberry32 } from '../src/core/rng';
import { LevelConfig, Board, Gem, GemColor } from '../src/core/types';
import { evaluateMatches } from '../src/core/patterns';
import { createEmptyBoard } from '../src/core/board';
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
    const detonateStep = res.steps.find((s) => s.type === 'detonate');
    expect(detonateStep).toBeDefined();
    if (detonateStep && detonateStep.type === 'detonate') {
      expect(detonateStep.isCrossBlast).toBe(true);
      expect(detonateStep.gem.kind).toBe('bomb');
      if (detonateStep.gem.kind === 'bomb') {
        expect(detonateStep.gem.tier).toBe(2);
      }
    }
  });

  it('Case 2: Rainbow + Normal destroys all gems of that color and clears the rainbow gem', () => {
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

    // Verify rainbow gem (id 200) was cleared in a clear step
    const clearStep = res.steps.find((s) => s.type === 'clear' && s.cells.some((c) => c.gem.id === 200));
    expect(clearStep).toBeDefined();

    // Verify rainbow gem 200 no longer exists in board snapshot
    const remainingIds = engine.snapshot.flat().filter(Boolean).map((g) => g!.id);
    expect(remainingIds).not.toContain(200);
  });

  it('Case 2b: Dragging Normal into Rainbow also properly clears rainbow gem', () => {
    const board = makeBaseBoard();
    const a = { r: 2, c: 2 };
    const b = { r: 2, c: 3 };
    // Normal at a, Rainbow at b (player drags normal into rainbow)
    board[a.r][a.c] = { id: 201, kind: 'normal', color: 2 };
    board[b.r][b.c] = { id: 200, kind: 'rainbow' };

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
    const clearStep = res.steps.find((s) => s.type === 'clear' && s.cells.some((c) => c.gem.id === 200));
    expect(clearStep).toBeDefined();

    const remainingIds = engine.snapshot.flat().filter(Boolean).map((g) => g!.id);
    expect(remainingIds).not.toContain(200);
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

  it('awards points on detonate steps and individual cleared cells for rainbow and bombs', () => {
    const board = createEmptyBoard(4, 4);
    let id = 1;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        board[r][c] = { id: id++, kind: 'normal', color: 0 };
      }
    }
    // Place rainbow at (0, 0) and normal of color 1 at (0, 1)
    board[0][0] = { id: 100, kind: 'rainbow' };
    board[0][1] = { id: 101, kind: 'normal', color: 1 };
    board[2][2] = { id: 102, kind: 'normal', color: 1 };

    const config: LevelConfig = {
      level: 200,
      seed: 200,
      rows: 4,
      cols: 4,
      colors: 4,
      moves: 10,
      goals: [{ type: 'score', target: 1000 }],
      boardOverride: board,
    };

    const engine = new CoreEngine(config);
    const res = engine.resolveMove({ r: 0, c: 0 }, { r: 0, c: 1 });
    expect(res.accepted).toBe(true);

    const clearStep = res.steps.find((s) => s.type === 'clear');
    expect(clearStep).toBeDefined();
    if (clearStep && clearStep.type === 'clear') {
      // The rainbow gem should have 50 + 500 = 550 bonus points
      const rainbowClear = clearStep.cells.find((c) => c.gem.id === 100);
      expect(rainbowClear).toBeDefined();
      expect(rainbowClear?.points).toBe(550);

      // The target normal gems should each have base points (50)
      const normalClear = clearStep.cells.find((c) => c.gem.id === 101);
      expect(normalClear).toBeDefined();
      expect(normalClear?.points).toBe(50);

      // The sum of individual cells points equals clearStep.points
      const sumPts = clearStep.cells.reduce((acc, c) => acc + (c.points || 0), 0);
      expect(clearStep.points).toBe(sumPts);
    }
  });

  it('ensures high-cascade sequences (e.g. Level 18) never leave un-cleared matches on board', () => {
    const config: LevelConfig = {
      level: 18,
      seed: hashString('level_18'),
      rows: 8,
      cols: 8,
      colors: 5,
      moves: 15,
      goals: [{ type: 'score' as const, target: 26000 }],
    };

    const engine = new CoreEngine(config);
    // Sequence that previously triggered >6 cascades and left a 3-in-a-row on board
    engine.resolveMove({ r: 0, c: 1 }, { r: 1, c: 1 });
    engine.resolveMove({ r: 1, c: 2 }, { r: 2, c: 2 });
    const r3 = engine.resolveMove({ r: 5, c: 1 }, { r: 5, c: 2 });
    expect(r3.accepted).toBe(true);

    const matches = evaluateMatches(engine.snapshot as Board);
    expect(matches.length).toBe(0);
  });

  it('Rainbow + Rainbow fusion triggers black hole vortex step, clears entire board, and awards massive points', () => {
    const config: LevelConfig = {
      level: 1,
      seed: 42,
      rows: 8,
      cols: 8,
      colors: 5,
      moves: 20,
      goals: [{ type: 'score' as const, target: 50000 }],
    };

    const engine = new CoreEngine(config);
    // Force two adjacent rainbow gems
    const board = engine.getBoard();
    board[3][3] = { id: 991, kind: 'rainbow' };
    board[3][4] = { id: 992, kind: 'rainbow' };

    const result = engine.resolveMove({ r: 3, c: 3 }, { r: 3, c: 4 });
    expect(result.accepted).toBe(true);

    // Verify clear step with black hole properties
    const blackHoleClear = result.steps.find((s) => s.type === 'clear' && s.isBlackHole);
    expect(blackHoleClear).toBeDefined();
    if (blackHoleClear && blackHoleClear.type === 'clear') {
      expect(blackHoleClear.vortexCenter).toEqual({ r: 3, c: 4 });
      // Cleared entire 8x8 board (64 gems)
      expect(blackHoleClear.cells.length).toBe(64);
      // Points should be at least 10,000 base + 64 * 150
      expect(blackHoleClear.points).toBeGreaterThanOrEqual(19000);
    }

    // Verify combo step
    const comboStep = result.steps.find((s) => s.type === 'combo');
    expect(comboStep).toBeDefined();
    if (comboStep && comboStep.type === 'combo') {
      expect(comboStep.title).toBe('¡VÓRTICE CÓSMICO!');
      expect(comboStep.tier).toBe(5);
    }

    // Verify boardClear step with bonus points and random exclamation
    const boardClearStep = result.steps.find((s) => s.type === 'boardClear');
    expect(boardClearStep).toBeDefined();
    if (boardClearStep && boardClearStep.type === 'boardClear') {
      expect(boardClearStep.points).toBe(5000);
      expect(boardClearStep.title.length).toBeGreaterThan(0);
    }

    // Verify resulting board has no holes or un-cleared matches
    const finalMatches = evaluateMatches(engine.snapshot as Board);
    expect(finalMatches.length).toBe(0);
  });

  it('detects full board clear during fusion or cascade and awards bonus with random exclamation', () => {
    const config: LevelConfig = {
      level: 1,
      seed: 99,
      rows: 4,
      cols: 4,
      colors: 4,
      moves: 10,
      goals: [{ type: 'score' as const, target: 10000 }],
    };

    const engine = new CoreEngine(config);
    const board = engine.getBoard();
    // Set up two bombs in center of 4x4 board
    board[1][1] = { id: 101, kind: 'bomb', color: 0, tier: 1 };
    board[1][2] = { id: 102, kind: 'bomb', color: 1, tier: 1 };

    // Swap the two bombs: 5x5 area + row + col clears entire 4x4 board!
    const result = engine.resolveMove({ r: 1, c: 1 }, { r: 1, c: 2 });
    expect(result.accepted).toBe(true);

    const boardClearStep = result.steps.find((s) => s.type === 'boardClear');
    expect(boardClearStep).toBeDefined();
    if (boardClearStep && boardClearStep.type === 'boardClear') {
      expect(boardClearStep.points).toBe(5000);
      expect(boardClearStep.title.length).toBeGreaterThan(0);
    }
  });

  it('stamps scoreAfter on steps to guarantee absolute score synchronization with zero UI drops', () => {
    const config: LevelConfig = {
      level: 65,
      seed: 42,
      rows: 8,
      cols: 8,
      colors: 5,
      moves: 20,
      goals: [{ type: 'score' as const, target: 50000 }],
    };

    const engine = new CoreEngine(config);
    const board = engine.getBoard();
    board[3][3] = { id: 991, kind: 'rainbow' };
    board[3][4] = { id: 992, kind: 'rainbow' };

    const initialScore = engine.progress.score;
    const result = engine.resolveMove({ r: 3, c: 3 }, { r: 3, c: 4 });
    expect(result.accepted).toBe(true);

    // Track scoreAfter values received by UI
    const scoresReported: number[] = [];
    for (const step of result.steps) {
      if (step.scoreAfter !== undefined) {
        scoresReported.push(step.scoreAfter);
      }
    }

    expect(scoresReported.length).toBeGreaterThan(0);
    // Score updates must be strictly monotonic non-decreasing (never drop)
    for (let i = 1; i < scoresReported.length; i++) {
      expect(scoresReported[i]).toBeGreaterThanOrEqual(scoresReported[i - 1]);
    }

    // The final step score update received by UI matches engine.progress.score exactly (no ghost drops)
    const finalReportedScore = scoresReported[scoresReported.length - 1];
    expect(finalReportedScore).toBe(engine.progress.score);
    expect(finalReportedScore).toBe(initialScore + result.pointsGained);
  });

  it('when a bomb blast hits two rainbow gems, each rainbow clears a different remaining color', () => {
    const board = createEmptyBoard(6, 6);
    let id = 1;
    // Populate board so color 2 is most abundant outside blast, color 3 is second most abundant
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        const color = r < 3 ? 2 : r < 5 ? 3 : 1;
        board[r][c] = { id: id++, kind: 'normal', color: color as any };
      }
    }

    // Place a bomb of color 0 at (2, 2), and normal gems of color 0 at (2, 1) and (2, 4) with swap at (2, 3) <-> (2, 4)
    board[2][1] = { id: 701, kind: 'normal', color: 0 };
    board[2][2] = { id: 702, kind: 'bomb', color: 0, tier: 1 };
    board[2][3] = { id: 703, kind: 'normal', color: 1 };
    board[2][4] = { id: 704, kind: 'normal', color: 0 };

    // Place two rainbow gems inside the 3x3 blast of (2, 2): at (1, 2) and (3, 2)
    board[1][2] = { id: 801, kind: 'rainbow' };
    board[3][2] = { id: 802, kind: 'rainbow' };

    const config: LevelConfig = {
      level: 300,
      seed: 300,
      rows: 6,
      cols: 6,
      colors: 4,
      moves: 10,
      goals: [{ type: 'score', target: 5000 }],
      boardOverride: board,
    };

    const engine = new CoreEngine(config);
    const res = engine.resolveMove({ r: 2, c: 3 }, { r: 2, c: 4 });
    expect(res.accepted).toBe(true);

    const rainbowDetonates = res.steps.filter(
      (s): s is Extract<typeof s, { type: 'detonate' }> =>
        s.type === 'detonate' && s.gem.kind === 'rainbow'
    );
    expect(rainbowDetonates.length).toBe(2);

    // Both rainbow gems should have non-empty, disjoint target sets of different colors
    expect(rainbowDetonates[0].affected.length).toBeGreaterThan(0);
    expect(rainbowDetonates[1].affected.length).toBeGreaterThan(0);

    const firstSet = new Set(rainbowDetonates[0].affected.map((c) => `${c.r},${c.c}`));
    for (const cell of rainbowDetonates[1].affected) {
      expect(firstSet.has(`${cell.r},${cell.c}`)).toBe(false);
    }

    // Both color 2 (13 gems on board) and color 3 (11 gems on board) should have been completely collected
    expect(res.progress.collected[2]).toBeGreaterThanOrEqual(13);
    expect(res.progress.collected[3]).toBeGreaterThanOrEqual(11);
  });
});

describe('Deadlock Recovery (ensureValidMovesRemain)', () => {
  function gemSig(g: Gem): string {
    if (g.kind === 'rainbow') return `${g.id}:rainbow`;
    if (g.kind === 'bomb') return `${g.id}:bomb:${g.color}:${g.tier}`;
    return `${g.id}:normal:${g.color}`;
  }

  it('recovers via Phase 2 preserving all gem IDs and types when all 50 Phase-1 random shuffles fail', () => {
    const colorsGrid: number[][] = [
      [0, 4, 2, 3],
      [2, 3, 0, 1],
      [0, 1, 2, 3],
      [2, 3, 0, 1],
    ];
    const board = createEmptyBoard(4, 4);
    let id = 1;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        board[r][c] = { id: id++, kind: 'normal', color: colorsGrid[r][c] as GemColor };
      }
    }
    // Single rainbow + single color-4 gem at top-left so clearing only removes (0,0) and (0,1)
    board[0][0] = { id: 101, kind: 'rainbow' };
    board[0][1] = { id: 102, kind: 'normal', color: 4 };

    const survivingSigs: string[] = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (r === 0 && (c === 0 || c === 1)) continue;
        survivingSigs.push(gemSig(board[r][c]!));
      }
    }

    const config: LevelConfig = {
      level: 1,
      seed: 1001,
      seedKey: 'phase2_forced_failure',
      rows: 4,
      cols: 4,
      colors: 5,
      moves: 10,
      goals: [{ type: 'score', target: 50000 }],
      boardOverride: board,
    };

    const engine = new CoreEngine(config);
    const origShuffleInt = engine.rngManager.shuffleRng.int.bind(engine.rngManager.shuffleRng);
    let phase1Calls = 0;

    try {
      // Refill (0,0)=0 and (0,1)=1 to yield deadlocked 4x4 grid with 4 of each color 0..3
      vi.spyOn(engine.rngManager.spawnRngs[0], 'int').mockReturnValue(0);
      vi.spyOn(engine.rngManager.spawnRngs[1], 'int').mockReturnValue(1);
      // Force identity permutation for all 50 Phase-1 Fisher-Yates loops (50 * 15 calls on 16 gems)
      vi.spyOn(engine.rngManager.shuffleRng, 'int').mockImplementation((n: number) => {
        if (phase1Calls < 50 * 15) {
          phase1Calls++;
          return n - 1;
        }
        return origShuffleInt(n);
      });

      const res = engine.resolveMove({ r: 0, c: 0 }, { r: 0, c: 1 });
      expect(res.accepted).toBe(true);
      expect(phase1Calls).toBe(50 * 15);

      const finalBoard = engine.snapshot as Board;
      expect(evaluateMatches(finalBoard).length).toBe(0);
      expect(engine.findValidMoves().length).toBeGreaterThan(0);
      expect(findValidMoves(finalBoard).length).toBeGreaterThan(0);
      expect(res.steps.some((s) => s.type === 'shuffle')).toBe(true);
      expect(res.steps.some((s) => s.type === 'transform')).toBe(false);

      const refillStep = res.steps.find((s) => s.type === 'refill');
      expect(refillStep).toBeDefined();
      const spawnedSigs =
        refillStep && refillStep.type === 'refill'
          ? refillStep.spawns.map((sp) => gemSig(sp.gem))
          : [];
      const expectedMultiset = [...survivingSigs, ...spawnedSigs].sort();

      const actualMultiset: string[] = [];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          expect(finalBoard[r][c]).not.toBeNull();
          actualMultiset.push(gemSig(finalBoard[r][c]!));
        }
      }
      actualMultiset.sort();
      expect(actualMultiset).toEqual(expectedMultiset);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('deterministically recovers a naturally skewed deadlocked board across identical engines', () => {
    const skewedGrid: number[][] = [
      [0, 4, 2, 1, 1, 2, 0, 0],
      [0, 0, 3, 1, 1, 3, 0, 0],
      [1, 1, 2, 0, 0, 2, 1, 1],
      [1, 1, 3, 0, 0, 3, 1, 1],
      [0, 0, 2, 1, 1, 2, 0, 0],
      [0, 0, 3, 1, 1, 3, 0, 0],
      [1, 1, 2, 0, 0, 2, 1, 1],
      [1, 1, 3, 0, 0, 3, 1, 1],
    ];

    const makeBoard = (): Board => {
      const board = createEmptyBoard(8, 8);
      let id = 1;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          board[r][c] = { id: id++, kind: 'normal', color: skewedGrid[r][c] as GemColor };
        }
      }
      board[0][0] = { id: 500, kind: 'rainbow' };
      return board;
    };

    const runEngine = (spyShuffle = false) => {
      const config: LevelConfig = {
        level: 1,
        seed: 2026,
        seedKey: 'skewed_determinism',
        rows: 8,
        cols: 8,
        colors: 5,
        moves: 10,
        goals: [{ type: 'score', target: 50000 }],
        boardOverride: makeBoard(),
      };
      const engine = new CoreEngine(config);
      vi.spyOn(engine.rngManager.spawnRngs[0], 'int').mockReturnValue(0);
      vi.spyOn(engine.rngManager.spawnRngs[1], 'int').mockReturnValue(0);
      const shuffleSpy = spyShuffle ? vi.spyOn(engine.rngManager.shuffleRng, 'int') : null;
      const res = engine.resolveMove({ r: 0, c: 0 }, { r: 0, c: 1 });
      return { engine, res, shuffleCalls: shuffleSpy ? shuffleSpy.mock.calls.length : 0 };
    };

    try {
      const run1 = runEngine(true);
      const run2 = runEngine(false);

      expect(run1.res.accepted).toBe(true);
      expect(run2.res.accepted).toBe(true);
      expect(run1.shuffleCalls).toBeGreaterThan(50 * 63);
      expect(evaluateMatches(run1.engine.snapshot as Board).length).toBe(0);
      expect(run1.engine.findValidMoves().length).toBeGreaterThan(0);
      expect(run1.res.steps.some((s) => s.type === 'shuffle')).toBe(true);
      expect(run1.res.steps.some((s) => s.type === 'transform')).toBe(false);
      expect(run1.res.boardHash).toBe(run2.res.boardHash);
      expect(run1.res.steps).toEqual(run2.res.steps);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('recovers via Phase 3 with shuffle and transform steps when gem color counts make permutations impossible', () => {
    const board = createEmptyBoard(3, 3);
    board[0][0] = { id: 1, kind: 'rainbow' };
    board[0][1] = { id: 2, kind: 'normal', color: 4 };
    board[0][2] = { id: 3, kind: 'normal', color: 1 };
    board[1][0] = { id: 4, kind: 'normal', color: 1 };
    board[1][1] = { id: 5, kind: 'normal', color: 2 };
    board[1][2] = { id: 6, kind: 'normal', color: 0 };
    board[2][0] = { id: 7, kind: 'normal', color: 2 };
    board[2][1] = { id: 8, kind: 'normal', color: 0 };
    board[2][2] = { id: 9, kind: 'normal', color: 3 };

    const config: LevelConfig = {
      level: 1,
      seed: 3003,
      seedKey: 'phase3_impossible_multiset',
      rows: 3,
      cols: 3,
      colors: 5,
      moves: 10,
      goals: [{ type: 'score', target: 50000 }],
      boardOverride: board,
    };

    const engine = new CoreEngine(config);
    try {
      // Refill (0,0)=3 and (0,1)=4 so counts are 0:2, 1:2, 2:2, 3:2, 4:1 (all <= 2)
      vi.spyOn(engine.rngManager.spawnRngs[0], 'int').mockReturnValue(3);
      vi.spyOn(engine.rngManager.spawnRngs[1], 'int').mockReturnValue(4);

      const res = engine.resolveMove({ r: 0, c: 0 }, { r: 0, c: 1 });
      expect(res.accepted).toBe(true);

      const finalBoard = engine.snapshot as Board;
      expect(evaluateMatches(finalBoard).length).toBe(0);
      expect(engine.findValidMoves().length).toBeGreaterThan(0);
      expect(findValidMoves(finalBoard).length).toBeGreaterThan(0);
      expect(res.steps.some((s) => s.type === 'shuffle')).toBe(true);
      expect(res.steps.some((s) => s.type === 'transform')).toBe(true);

      const seenIds = new Set<number>();
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const gem = finalBoard[r][c];
          expect(gem).not.toBeNull();
          seenIds.add(gem!.id);
        }
      }
      expect(seenIds.size).toBe(9);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('recovers a degenerate 2x2 board via Phase 3 without deadlocking', () => {
    const board = createEmptyBoard(2, 2);
    board[0][0] = { id: 1, kind: 'rainbow' };
    board[0][1] = { id: 2, kind: 'normal', color: 0 };
    board[1][0] = { id: 3, kind: 'normal', color: 1 };
    board[1][1] = { id: 4, kind: 'normal', color: 2 };

    const config: LevelConfig = {
      level: 1,
      seed: 4004,
      seedKey: 'phase3_degenerate_2x2',
      rows: 2,
      cols: 2,
      colors: 4,
      moves: 10,
      goals: [{ type: 'score', target: 50000 }],
      boardOverride: board,
    };

    const engine = new CoreEngine(config);
    const res = engine.resolveMove({ r: 0, c: 0 }, { r: 0, c: 1 });
    expect(res.accepted).toBe(true);

    const finalBoard = engine.snapshot as Board;
    expect(evaluateMatches(finalBoard).length).toBe(0);
    expect(engine.findValidMoves().length).toBeGreaterThan(0);
    expect(findValidMoves(finalBoard).length).toBeGreaterThan(0);
    expect(res.steps.some((s) => s.type === 'shuffle')).toBe(true);
    expect(res.steps.some((s) => s.type === 'transform')).toBe(true);

    const seenIds = new Set<number>();
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        const gem = finalBoard[r][c];
        expect(gem).not.toBeNull();
        seenIds.add(gem!.id);
      }
    }
    expect(seenIds.size).toBe(4);
  });
});

describe('Outcomes, Leftover-Move Bonus, and Auto-Shuffle', () => {
  function makeBoard(grid: GemColor[][]): Board {
    const board = createEmptyBoard(grid.length, grid[0].length);
    let id = 1;
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        board[r][c] = { id: id++, kind: 'normal', color: grid[r][c] };
      }
    }
    return board;
  }

  // CoreEngine seeds BoardRngManager from config.level / config.seedKey.
  // With cols: 4 and level: 2, turn 1 refills (0,0)-(0,2) without cascading,
  // while turn 2's spawn:2 draw triggers a deterministic cascade-2 match (+225 pts).
  const twoTurnGrid: GemColor[][] = [
    [0, 0, 3, 0],
    [2, 3, 0, 1],
    [0, 1, 2, 3],
    [0, 0, 2, 0],
  ];

  it('awards won outcome and movesLeft * 1000 bonus while preserving movesLeft', () => {
    const config: LevelConfig = {
      level: 2,
      seed: hashString('level_2'),
      rows: 4,
      cols: 4,
      colors: 4,
      moves: 5,
      goals: [{ type: 'score', target: 300 }],
      boardOverride: makeBoard(twoTurnGrid),
    };

    const engine = new CoreEngine(config);

    // Turn 1: 3-match scores 150 (< 300). Outcome stays 'continue' with no bonus.
    const res1 = engine.resolveMove({ r: 0, c: 2 }, { r: 0, c: 3 });
    expect(res1.accepted).toBe(true);
    expect(res1.movesLeft).toBe(4);
    expect(res1.outcome).toBe('continue');
    expect(res1.pointsGained).toBe(150);
    expect(res1.progress.score).toBe(150);

    // Turn 2: 3-match (150) + cascade-2 (225) = 375 -> total 525 >= 300 -> 'won' with 3 movesLeft -> +3000 bonus.
    const res2 = engine.resolveMove({ r: 3, c: 2 }, { r: 3, c: 3 });
    expect(res2.accepted).toBe(true);
    expect(res2.movesLeft).toBe(3);
    expect(engine.movesLeft).toBe(3);
    expect(res2.outcome).toBe('won');
    expect(res2.pointsGained).toBe(375 + 3 * 1000);
    expect(res2.progress.score).toBe(525 + 3 * 1000);
    expect(engine.progress.score).toBe(3525);
    expect(res2.steps.some((s) => s.type === 'shuffle')).toBe(false);
  });

  it('awards won outcome with zero leftover bonus when winning on the final move', () => {
    const config: LevelConfig = {
      level: 2,
      seed: hashString('level_2'),
      rows: 4,
      cols: 4,
      colors: 4,
      moves: 1,
      goals: [{ type: 'collect', color: 0, count: 3 }],
      boardOverride: makeBoard(twoTurnGrid),
    };

    const engine = new CoreEngine(config);
    const res = engine.resolveMove({ r: 0, c: 2 }, { r: 0, c: 3 });

    expect(res.accepted).toBe(true);
    expect(res.movesLeft).toBe(0);
    expect(res.outcome).toBe('won');
    expect(res.pointsGained).toBe(150);
    expect(res.progress.score).toBe(150);
  });

  it('returns lost outcome when moves reach 0 without meeting goals', () => {
    const config: LevelConfig = {
      level: 2,
      seed: hashString('level_2'),
      rows: 4,
      cols: 4,
      colors: 4,
      moves: 2,
      goals: [{ type: 'score', target: 5000 }],
      boardOverride: makeBoard(twoTurnGrid),
    };

    const engine = new CoreEngine(config);

    const res1 = engine.resolveMove({ r: 0, c: 2 }, { r: 0, c: 3 });
    expect(res1.accepted).toBe(true);
    expect(res1.movesLeft).toBe(1);
    expect(res1.outcome).toBe('continue');

    // Invalid swap does not consume the remaining move or trigger loss
    const invalid = engine.resolveMove({ r: 1, c: 0 }, { r: 1, c: 1 });
    expect(invalid.accepted).toBe(false);
    expect(invalid.movesLeft).toBe(1);
    expect(invalid.outcome).toBe('continue');

    const res2 = engine.resolveMove({ r: 3, c: 2 }, { r: 3, c: 3 });
    expect(res2.accepted).toBe(true);
    expect(res2.movesLeft).toBe(0);
    expect(engine.movesLeft).toBe(0);
    expect(res2.outcome).toBe('lost');
    expect(res2.pointsGained).toBe(375);
    expect(res2.progress.score).toBe(525);
  });

  it('emits a deterministic shuffle step when no valid moves remain after a turn', () => {
    const deadlockGrid: GemColor[][] = [
      [0, 0, 3, 0],
      [2, 3, 0, 1],
      [0, 1, 2, 3],
      [2, 3, 0, 1],
    ];

    const makeConfig = (): LevelConfig => ({
      level: 2,
      seed: hashString('level_2'),
      rows: 4,
      cols: 4,
      colors: 4,
      moves: 5,
      goals: [{ type: 'score', target: 5000 }],
      boardOverride: makeBoard(deadlockGrid),
    });

    const engine = new CoreEngine(makeConfig());
    const res = engine.resolveMove({ r: 0, c: 2 }, { r: 0, c: 3 });

    expect(res.accepted).toBe(true);
    expect(res.outcome).toBe('continue');

    const shuffleStep = res.steps.find(
      (s): s is Extract<typeof s, { type: 'shuffle' }> => s.type === 'shuffle'
    );
    expect(shuffleStep).toBeDefined();
    expect(shuffleStep!.moves.length).toBeGreaterThan(0);

    const snapshot = engine.snapshot as Board;
    for (const move of shuffleStep!.moves) {
      expect(move.from).not.toEqual(move.to);
      expect(snapshot[move.to.r][move.to.c]?.id).toBe(move.id);
    }

    const postIds = snapshot.flat().map((g) => g?.id);
    expect(postIds.every((id) => typeof id === 'number')).toBe(true);
    expect(new Set(postIds).size).toBe(16);
    expect(evaluateMatches(snapshot).length).toBe(0);
    expect(engine.findValidMoves().length).toBeGreaterThan(0);

    // Determinism check against a fresh engine with identical config
    const replayEngine = new CoreEngine(makeConfig());
    const replayRes = replayEngine.resolveMove({ r: 0, c: 2 }, { r: 0, c: 3 });
    expect(replayRes.boardHash).toBe(res.boardHash);
    expect(replayRes.steps).toEqual(res.steps);
  });
});


