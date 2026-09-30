import { Board, Cell } from './types';
import { areCellsAdjacent, isInside } from './board';
import { classifyFusion } from './specials';
import { evaluateMatches } from './patterns';

/**
 * Checks whether swapping cells a and b produces a valid move.
 * Valid move means:
 * - Cells are adjacent and on the board.
 * - Is a fusion (rainbow + any, or bomb + bomb), OR
 * - Produces at least one match of 3 or more gems.
 */
export function isValidSwap(board: Board, a: Cell, b: Cell): boolean {
  if (!isInside(board, a) || !isInside(board, b)) {
    return false;
  }
  if (!areCellsAdjacent(a, b)) {
    return false;
  }

  const gemA = board[a.r][a.c];
  const gemB = board[b.r][b.c];
  if (!gemA || !gemB) {
    return false;
  }

  // Check fusion
  if (classifyFusion(gemA, gemB) !== null) {
    return true;
  }

  // Logical swap to evaluate matches
  board[a.r][a.c] = gemB;
  board[b.r][b.c] = gemA;

  const matches = evaluateMatches(board, [a, b]);

  // Restore
  board[a.r][a.c] = gemA;
  board[b.r][b.c] = gemB;

  return matches.length > 0;
}

/**
 * Returns all valid moves on the board in fixed row-major order.
 * Checks right and down neighbors from each cell.
 */
export function findValidMoves(board: Board): { a: Cell; b: Cell }[] {
  const validMoves: { a: Cell; b: Cell }[] = [];
  const rows = board.length;
  const cols = board[0].length;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a: Cell = { r, c };

      // Check right neighbor
      if (c + 1 < cols) {
        const b: Cell = { r, c: c + 1 };
        if (isValidSwap(board, a, b)) {
          validMoves.push({ a, b });
        }
      }

      // Check down neighbor
      if (r + 1 < rows) {
        const b: Cell = { r: r + 1, c };
        if (isValidSwap(board, a, b)) {
          validMoves.push({ a, b });
        }
      }
    }
  }

  return validMoves;
}
