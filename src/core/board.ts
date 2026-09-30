import { Board, Cell, Gem, GemColor } from './types';
import { Mulberry32 } from './rng';

export function createEmptyBoard(rows: number, cols: number): Board {
  const board: Board = [];
  for (let r = 0; r < rows; r++) {
    const row: (Gem | null)[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(null);
    }
    board.push(row);
  }
  return board;
}

export function cloneBoard(board: Board): Board {
  return board.map((row) =>
    row.map((gem) => {
      if (!gem) return null;
      if (gem.kind === 'normal') {
        return { id: gem.id, kind: 'normal', color: gem.color };
      }
      if (gem.kind === 'bomb') {
        return { id: gem.id, kind: 'bomb', color: gem.color, tier: gem.tier };
      }
      return { id: gem.id, kind: 'rainbow' };
    })
  );
}

export function isInside(board: Board, cell: Cell): boolean {
  return cell.r >= 0 && cell.r < board.length && cell.c >= 0 && cell.c < board[0].length;
}

export function areCellsAdjacent(a: Cell, b: Cell): boolean {
  const dr = Math.abs(a.r - b.r);
  const dc = Math.abs(a.c - b.c);
  return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
}

export function cellsEqual(a: Cell, b: Cell): boolean {
  return a.r === b.r && a.c === b.c;
}

/**
 * Computes a 32-bit FNV-1a hash of the board state.
 * Encodes position, gem kind, color, tier, and gem id.
 */
export function computeBoardHash(board: Board): number {
  let h = 0x811c9dc5;
  const mix = (val: number) => {
    h ^= val & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (val >>> 8) & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (val >>> 16) & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (val >>> 24) & 0xff;
    h = Math.imul(h, 0x01000193);
  };

  const rows = board.length;
  const cols = board[0].length;
  mix(rows);
  mix(cols);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const gem = board[r][c];
      if (!gem) {
        mix(0);
      } else {
        const kindCode = gem.kind === 'normal' ? 1 : gem.kind === 'bomb' ? 2 : 3;
        const colorCode = gem.kind === 'rainbow' ? 99 : gem.color;
        const tierCode = gem.kind === 'bomb' ? gem.tier : 0;
        mix(kindCode);
        mix(colorCode);
        mix(tierCode);
        mix(gem.id);
      }
    }
  }

  return h >>> 0;
}

/**
 * Creates an initial board with no initial matches.
 * Uses row-major order with initRng.
 * Excludes colors that would create 3-in-a-row with already placed gems.
 */
export function populateInitialBoard(
  rows: number,
  cols: number,
  colorsCount: 4 | 5,
  initRng: Mulberry32,
  nextId: () => number
): Board {
  const board = createEmptyBoard(rows, cols);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const excluded = new Set<GemColor>();

      // Check left 2
      if (c >= 2) {
        const g1 = board[r][c - 1];
        const g2 = board[r][c - 2];
        if (g1 && g2 && g1.kind !== 'rainbow' && g2.kind !== 'rainbow' && g1.color === g2.color) {
          excluded.add(g1.color);
        }
      }

      // Check top 2
      if (r >= 2) {
        const g1 = board[r - 1][c];
        const g2 = board[r - 2][c];
        if (g1 && g2 && g1.kind !== 'rainbow' && g2.kind !== 'rainbow' && g1.color === g2.color) {
          excluded.add(g1.color);
        }
      }

      const availableColors: GemColor[] = [];
      for (let i = 0; i < colorsCount; i++) {
        const color = i as GemColor;
        if (!excluded.has(color)) {
          availableColors.push(color);
        }
      }

      const chosenColor = availableColors[initRng.int(availableColors.length)];
      board[r][c] = {
        id: nextId(),
        kind: 'normal',
        color: chosenColor,
      };
    }
  }

  return board;
}
