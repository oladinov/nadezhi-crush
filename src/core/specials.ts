import { Board, Cell, Gem, GemColor } from './types';
import { isInside } from './board';

export type FusionType =
  | { type: 'rainbow_rainbow' }
  | { type: 'rainbow_bomb'; color: GemColor; bombTier: 1 | 2 }
  | { type: 'rainbow_normal'; color: GemColor }
  | { type: 'bomb_bomb' };

export function classifyFusion(gemA: Gem, gemB: Gem): FusionType | null {
  if (gemA.kind === 'rainbow' && gemB.kind === 'rainbow') {
    return { type: 'rainbow_rainbow' };
  }

  if (gemA.kind === 'rainbow' && gemB.kind === 'bomb') {
    return { type: 'rainbow_bomb', color: gemB.color, bombTier: gemB.tier };
  }
  if (gemB.kind === 'rainbow' && gemA.kind === 'bomb') {
    return { type: 'rainbow_bomb', color: gemA.color, bombTier: gemA.tier };
  }

  if (gemA.kind === 'rainbow' && gemB.kind === 'normal') {
    return { type: 'rainbow_normal', color: gemB.color };
  }
  if (gemB.kind === 'rainbow' && gemA.kind === 'normal') {
    return { type: 'rainbow_normal', color: gemA.color };
  }

  if (gemA.kind === 'bomb' && gemB.kind === 'bomb') {
    return { type: 'bomb_bomb' };
  }

  return null;
}

export function manhattanDistance(a: Cell, b: Cell): number {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
}

/**
 * Returns cells in the explosion area of a bomb.
 * Tier 1: 3x3
 * Tier 2: 5x5
 */
export function getBombArea(board: Board, center: Cell, tier: 1 | 2): Cell[] {
  const radius = tier === 1 ? 1 : 2;
  const cells: Cell[] = [];
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      const cell: Cell = { r: center.r + dr, c: center.c + dc };
      if (isInside(board, cell)) {
        cells.push(cell);
      }
    }
  }
  return cells;
}

/**
 * Returns cells affected by a Bomb + Bomb fusion:
 * Entire row ∪ entire column ∪ 5x5 area centered at target cell.
 */
export function getBombBombArea(board: Board, center: Cell): Cell[] {
  const rows = board.length;
  const cols = board[0].length;
  const cellMap = new Map<string, Cell>();

  // Full row
  for (let c = 0; c < cols; c++) {
    cellMap.set(`${center.r},${c}`, { r: center.r, c });
  }

  // Full column
  for (let r = 0; r < rows; r++) {
    cellMap.set(`${r},${center.c}`, { r, c: center.c });
  }

  // 5x5 box
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const cell: Cell = { r: center.r + dr, c: center.c + dc };
      if (isInside(board, cell)) {
        cellMap.set(`${cell.r},${cell.c}`, cell);
      }
    }
  }

  return Array.from(cellMap.values()).sort((a, b) => (a.r !== b.r ? a.r - b.r : a.c - b.c));
}

/**
 * Finds the most abundant color on the board among non-rainbow gems.
 * Tiebreaker: lower color index (0 < 1 < 2 < 3 < 4).
 */
export function getMostAbundantColor(board: Board): GemColor {
  const counts: number[] = [0, 0, 0, 0, 0];
  const rows = board.length;
  const cols = board[0].length;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const gem = board[r][c];
      if (gem && gem.kind !== 'rainbow') {
        counts[gem.color]++;
      }
    }
  }

  let maxCount = -1;
  let bestColor: GemColor = 0;
  for (let color = 0; color < counts.length; color++) {
    if (counts[color] > maxCount) {
      maxCount = counts[color];
      bestColor = color as GemColor;
    }
  }

  return bestColor;
}
