import { Board, Cell, GemColor } from './types';
import { cellsEqual } from './board';

export interface Run {
  dir: 'H' | 'V';
  color: GemColor;
  cells: Cell[];
}

export interface SpawnSpec {
  cell: Cell;
  kind: 'bomb' | 'rainbow';
  tier?: 1 | 2;
}

export interface MatchGroup {
  color: GemColor;
  cells: Cell[];
  runs: Run[];
  spawn: SpawnSpec | null;
}

export function classifyMatch(runs: Run[]): 'rainbow' | 'bomb2' | 'bomb1' | 'plain' {
  const maxLen = Math.max(...runs.map((r) => r.cells.length));
  if (maxLen >= 5) return 'rainbow';
  const hasH = runs.some((r) => r.dir === 'H');
  const hasV = runs.some((r) => r.dir === 'V');
  if (hasH && hasV) return 'bomb2'; // L o T (3+3 cruzadas = 5 gemas mínimo)
  if (maxLen === 4) return 'bomb1';
  return 'plain';
}

/**
 * Finds all horizontal and vertical runs of >= 3 gems of the same color.
 * Normal gems and bombs count towards matches; rainbow gems are excluded.
 */
export function findRuns(board: Board): Run[] {
  const runs: Run[] = [];
  const rows = board.length;
  const cols = board[0].length;

  // Horizontal runs
  for (let r = 0; r < rows; r++) {
    let currentCells: Cell[] = [];
    let currentColor: GemColor | null = null;

    for (let c = 0; c < cols; c++) {
      const gem = board[r][c];
      const gemColor = gem && gem.kind !== 'rainbow' ? gem.color : null;

      if (gemColor !== null) {
        if (currentColor === gemColor) {
          currentCells.push({ r, c });
        } else {
          if (currentCells.length >= 3 && currentColor !== null) {
            runs.push({ dir: 'H', color: currentColor, cells: [...currentCells] });
          }
          currentCells = [{ r, c }];
          currentColor = gemColor;
        }
      } else {
        if (currentCells.length >= 3 && currentColor !== null) {
          runs.push({ dir: 'H', color: currentColor, cells: [...currentCells] });
        }
        currentCells = [];
        currentColor = null;
      }
    }
    if (currentCells.length >= 3 && currentColor !== null) {
      runs.push({ dir: 'H', color: currentColor, cells: [...currentCells] });
    }
  }

  // Vertical runs
  for (let c = 0; c < cols; c++) {
    let currentCells: Cell[] = [];
    let currentColor: GemColor | null = null;

    for (let r = 0; r < rows; r++) {
      const gem = board[r][c];
      const gemColor = gem && gem.kind !== 'rainbow' ? gem.color : null;

      if (gemColor !== null) {
        if (currentColor === gemColor) {
          currentCells.push({ r, c });
        } else {
          if (currentCells.length >= 3 && currentColor !== null) {
            runs.push({ dir: 'V', color: currentColor, cells: [...currentCells] });
          }
          currentCells = [{ r, c }];
          currentColor = gemColor;
        }
      } else {
        if (currentCells.length >= 3 && currentColor !== null) {
          runs.push({ dir: 'V', color: currentColor, cells: [...currentCells] });
        }
        currentCells = [];
        currentColor = null;
      }
    }
    if (currentCells.length >= 3 && currentColor !== null) {
      runs.push({ dir: 'V', color: currentColor, cells: [...currentCells] });
    }
  }

  return runs;
}

/**
 * Union-Find implementation to group intersecting runs of the same color into MatchGroups.
 */
export function evaluateMatches(
  board: Board,
  swapCells?: [Cell, Cell]
): MatchGroup[] {
  const runs = findRuns(board);
  if (runs.length === 0) return [];

  const parent: number[] = runs.map((_, i) => i);
  const find = (i: number): number => {
    if (parent[i] === i) return i;
    parent[i] = find(parent[i]);
    return parent[i];
  };
  const union = (i: number, j: number) => {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) {
      parent[rootJ] = rootI;
    }
  };

  // Runs share a cell if they intersect
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      if (runs[i].color === runs[j].color) {
        const sharesCell = runs[i].cells.some((c1) =>
          runs[j].cells.some((c2) => cellsEqual(c1, c2))
        );
        if (sharesCell) {
          union(i, j);
        }
      }
    }
  }

  const groupsByRoot = new Map<number, Run[]>();
  for (let i = 0; i < runs.length; i++) {
    const root = find(i);
    if (!groupsByRoot.has(root)) {
      groupsByRoot.set(root, []);
    }
    groupsByRoot.get(root)!.push(runs[i]);
  }

  const matchGroups: MatchGroup[] = [];

  for (const groupRuns of groupsByRoot.values()) {
    const color = groupRuns[0].color;
    // Collect unique cells
    const cellMap = new Map<string, Cell>();
    for (const r of groupRuns) {
      for (const cell of r.cells) {
        cellMap.set(`${cell.r},${cell.c}`, cell);
      }
    }
    const cells = Array.from(cellMap.values()).sort((a, b) =>
      a.r !== b.r ? a.r - b.r : a.c - b.c
    );

    const classification = classifyMatch(groupRuns);
    let spawn: SpawnSpec | null = null;

    if (classification !== 'plain') {
      let spawnCell: Cell;

      // Rule 4: Posición de aparición (spawn.cell)
      // Si alguna celda del grupo es una de las dos celdas del swap, ahí aparece.
      // Si están ambas, gana `b` (donde aterrizó la gema arrastrada).
      let swapMatch: Cell | null = null;
      if (swapCells) {
        const [a, b] = swapCells;
        const bInGroup = cells.some((c) => cellsEqual(c, b));
        const aInGroup = cells.some((c) => cellsEqual(c, a));
        if (bInGroup) {
          swapMatch = b;
        } else if (aInGroup) {
          swapMatch = a;
        }
      }

      if (swapMatch) {
        spawnCell = swapMatch;
      } else {
        // Cascada o sin swap:
        if (classification === 'bomb2') {
          // Primera intersección H ∩ V en orden fila-mayor
          const hRuns = groupRuns.filter((r) => r.dir === 'H');
          const vRuns = groupRuns.filter((r) => r.dir === 'V');
          const intersections: Cell[] = [];
          for (const hr of hRuns) {
            for (const vr of vRuns) {
              for (const hc of hr.cells) {
                for (const vc of vr.cells) {
                  if (cellsEqual(hc, vc)) {
                    intersections.push(hc);
                  }
                }
              }
            }
          }
          intersections.sort((a, b) => (a.r !== b.r ? a.r - b.r : a.c - b.c));
          spawnCell = intersections[0] || cells[0];
        } else {
          // Línea: celda central (floor((len - 1) / 2)) del run maximal
          const maxRun = [...groupRuns].sort((a, b) => b.cells.length - a.cells.length)[0];
          const midIdx = Math.floor((maxRun.cells.length - 1) / 2);
          spawnCell = maxRun.cells[midIdx];
        }
      }

      if (classification === 'rainbow') {
        spawn = { cell: spawnCell, kind: 'rainbow' };
      } else if (classification === 'bomb2') {
        spawn = { cell: spawnCell, kind: 'bomb', tier: 2 };
      } else if (classification === 'bomb1') {
        spawn = { cell: spawnCell, kind: 'bomb', tier: 1 };
      }
    }

    matchGroups.push({
      color,
      cells,
      runs: groupRuns,
      spawn,
    });
  }

  return matchGroups;
}
