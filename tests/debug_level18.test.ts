import { describe, it, expect } from 'vitest';
import { CoreEngine } from '../src/core/resolver';
import { getLevelConfig } from '../src/levels/generator';
import { evaluateMatches } from '../src/core/patterns';
import { Board } from '../src/core/types';

describe('Level 18 Search', () => {
  it('ensures the problematic sequence resolves cleanly', () => {
    const config = getLevelConfig(18);
    const engine = new CoreEngine(config);
    engine.resolveMove({ r: 0, c: 1 }, { r: 1, c: 1 });
    engine.resolveMove({ r: 1, c: 2 }, { r: 2, c: 2 });
    const r3 = engine.resolveMove({ r: 5, c: 1 }, { r: 5, c: 2 });
    expect(r3.accepted).toBe(true);

    const matches = evaluateMatches(engine.snapshot as Board);
    expect(matches.length).toBe(0);
  });
});
