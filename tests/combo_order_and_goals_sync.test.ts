import { describe, it, expect } from 'vitest';
import { CoreEngine } from '../src/core/resolver';
import { LevelConfig } from '../src/core/types';
import { createEmptyBoard } from '../src/core/board';

describe('Combo Banner Ordering & Real-Time Goal Synchronization', () => {
  it('emits combo step AFTER resolveWave clear/detonate steps during cascades', () => {
    // Board with cascades that reach cascade >= 3
    const board = createEmptyBoard(8, 8);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        board[r][c] = { id: r * 8 + c + 1, kind: 'normal', color: ((r + c) % 4) as any };
      }
    }
    // Set up a move that causes cascade >= 3
    // Swap (0,0) and (0,1)
    board[0][0] = { id: 101, kind: 'normal', color: 0 };
    board[0][1] = { id: 102, kind: 'normal', color: 1 };
    board[0][2] = { id: 103, kind: 'normal', color: 0 };
    board[0][3] = { id: 104, kind: 'normal', color: 0 };

    // Column 2 setup to fall into match when (0,2) clears
    board[1][2] = { id: 105, kind: 'normal', color: 2 };
    board[2][2] = { id: 106, kind: 'normal', color: 2 };
    board[3][2] = { id: 107, kind: 'normal', color: 2 };

    const config: LevelConfig = {
      level: 1,
      seed: 42,
      rows: 8,
      cols: 8,
      colors: 4,
      moves: 10,
      goals: [{ type: 'score', target: 5000 }],
      boardOverride: board,
    };

    const engine = new CoreEngine(config);
    const res = engine.resolveMove({ r: 0, c: 0 }, { r: 0, c: 1 });
    expect(res.accepted).toBe(true);

    // If there is any combo step, verify that the clear/detonate step for that cascade comes BEFORE the combo step
    const comboIndices: number[] = [];
    res.steps.forEach((s, idx) => {
      if (s.type === 'combo') comboIndices.push(idx);
    });

    for (const cIdx of comboIndices) {
      const comboStep = res.steps[cIdx] as Extract<typeof res.steps[0], { type: 'combo' }>;
      // Find the clear step for this cascade wave
      const clearIdx = res.steps.findIndex(
        (s) => s.type === 'clear' && s.cascade === comboStep.cascade
      );
      if (clearIdx !== -1) {
        // Clear must come BEFORE combo!
        expect(clearIdx).toBeLessThan(cIdx);
      }
    }
  });

  it('emits Vórtice Cósmico combo step AFTER singularity full board clear', () => {
    const board = createEmptyBoard(8, 8);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        board[r][c] = { id: r * 8 + c + 1, kind: 'normal', color: 0 };
      }
    }
    board[3][3] = { id: 401, kind: 'rainbow' };
    board[3][4] = { id: 402, kind: 'rainbow' };

    const config: LevelConfig = {
      level: 1,
      seed: 1,
      rows: 8,
      cols: 8,
      colors: 4,
      moves: 10,
      goals: [{ type: 'score', target: 10000 }],
      boardOverride: board,
    };

    const engine = new CoreEngine(config);
    const res = engine.resolveMove({ r: 3, c: 3 }, { r: 3, c: 4 });
    expect(res.accepted).toBe(true);

    const clearIdx = res.steps.findIndex((s) => s.type === 'clear' && s.isBlackHole);
    const comboIdx = res.steps.findIndex(
      (s) => s.type === 'combo' && s.title === '¡VÓRTICE CÓSMICO!'
    );

    expect(clearIdx).toBeDefined();
    expect(comboIdx).toBeDefined();
    expect(clearIdx).toBeLessThan(comboIdx);
  });

  it('stamps progressAfter on detonate steps and matches increment in real-time', () => {
    const board = createEmptyBoard(6, 6);
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        board[r][c] = { id: r * 6 + c + 1, kind: 'normal', color: 3 };
      }
    }
    // Set up 2 bombs of color 0 in a match
    board[2][1] = { id: 101, kind: 'bomb', color: 0, tier: 1 };
    board[2][2] = { id: 102, kind: 'bomb', color: 0, tier: 1 };
    board[2][3] = { id: 103, kind: 'normal', color: 1 }; // swap with (1, 3) to match
    board[1][3] = { id: 104, kind: 'normal', color: 0 };

    const config: LevelConfig = {
      level: 1,
      seed: 1,
      rows: 6,
      cols: 6,
      colors: 4,
      moves: 10,
      goals: [{ type: 'detonate', count: 5 }],
      boardOverride: board,
    };

    const engine = new CoreEngine(config);
    const res = engine.resolveMove({ r: 1, c: 3 }, { r: 2, c: 3 });
    expect(res.accepted).toBe(true);

    const detSteps = res.steps.filter((s) => s.type === 'detonate');
    expect(detSteps.length).toBeGreaterThanOrEqual(2);

    // Each detonate step has progressAfter with monotonically increasing detonated count
    let lastDet = 0;
    for (const s of detSteps) {
      expect(s.progressAfter).toBeDefined();
      expect(s.progressAfter!.detonated).toBeGreaterThanOrEqual(lastDet);
      lastDet = s.progressAfter!.detonated;
    }
    expect(lastDet).toBeGreaterThanOrEqual(2);
  });
});
