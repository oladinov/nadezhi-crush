import {
  Board,
  Cell,
  ClearCause,
  DetonateTrigger,
  Gem,
  GemColor,
  GoalProgress,
  GridCore,
  LevelConfig,
  Step,
  TurnResult,
} from './types';
import { BoardRngManager } from './rng';
import {
  areCellsAdjacent,
  cloneBoard,
  computeBoardHash,
  isInside,
  populateInitialBoard,
} from './board';
import { evaluateMatches, MatchGroup } from './patterns';
import {
  classifyFusion,
  FusionType,
  getBombArea,
  getBombBombArea,
  getMostAbundantColor,
  manhattanDistance,
} from './specials';
import { getGemClearPoints, SPECIAL_POINTS } from './scoring';
import {
  cloneGoalProgress,
  createInitialGoalProgress,
  evaluateOutcome,
} from './goals';
import { findValidMoves } from './moves';

interface Activation {
  cell: Cell;
  gem: Gem;
  wave: number;
  trigger?: DetonateTrigger;
}

export class CoreEngine implements GridCore {
  private board: Board;
  private nextGemId = 1;
  public movesLeft: number;
  public progress: GoalProgress;
  public config: LevelConfig;
  public rngManager: BoardRngManager;

  constructor(config: LevelConfig) {
    this.config = config;
    this.movesLeft = config.moves;
    this.progress = createInitialGoalProgress();
    this.rngManager = new BoardRngManager(config.level, config.cols);

    if (config.boardOverride) {
      this.board = cloneBoard(config.boardOverride);
      // Ensure IDs are valid and nextGemId exceeds any existing ID
      let maxId = 0;
      for (let r = 0; r < this.board.length; r++) {
        for (let c = 0; c < this.board[0].length; c++) {
          const gem = this.board[r][c];
          if (gem) {
            if (gem.id > maxId) maxId = gem.id;
          }
        }
      }
      this.nextGemId = maxId + 1;
    } else {
      this.board = this.generateValidInitialBoard();
    }
  }

  get snapshot(): Readonly<Board> {
    return cloneBoard(this.board);
  }

  public getBoard(): Board {
    return this.board;
  }

  private nextId = (): number => {
    return this.nextGemId++;
  };

  /**
   * Generates initial board without matches and with at least 1 valid move.
   * If no valid moves exist, retries with initRng (bounded).
   */
  private generateValidInitialBoard(): Board {
    const maxAttempts = 100;
    for (let i = 0; i < maxAttempts; i++) {
      const board = populateInitialBoard(
        this.config.rows,
        this.config.cols,
        this.config.colors,
        this.rngManager.initRng,
        this.nextId
      );
      if (findValidMoves(board).length > 0) {
        return board;
      }
    }
    // Fallback if needed
    return populateInitialBoard(
      this.config.rows,
      this.config.cols,
      this.config.colors,
      this.rngManager.initRng,
      this.nextId
    );
  }

  public findValidMoves(): { a: Cell; b: Cell }[] {
    return findValidMoves(this.board);
  }

  public resolveMove(a: Cell, b: Cell): TurnResult {
    // Check adjacency and board bounds
    if (!isInside(this.board, a) || !isInside(this.board, b) || !areCellsAdjacent(a, b)) {
      return {
        accepted: false,
        steps: [{ type: 'swap', a, b, valid: false }],
        pointsGained: 0,
        movesLeft: this.movesLeft,
        progress: cloneGoalProgress(this.progress),
        outcome: evaluateOutcome(this.config.goals, this.progress, this.movesLeft),
        boardHash: computeBoardHash(this.board),
      };
    }

    const gemA = this.board[a.r][a.c];
    const gemB = this.board[b.r][b.c];
    if (!gemA || !gemB) {
      return {
        accepted: false,
        steps: [{ type: 'swap', a, b, valid: false }],
        pointsGained: 0,
        movesLeft: this.movesLeft,
        progress: cloneGoalProgress(this.progress),
        outcome: evaluateOutcome(this.config.goals, this.progress, this.movesLeft),
        boardHash: computeBoardHash(this.board),
      };
    }

    // Logical swap
    this.board[a.r][a.c] = gemB;
    this.board[b.r][b.c] = gemA;

    const fusion = classifyFusion(gemA, gemB);
    const initialMatches = fusion ? [] : evaluateMatches(this.board, [a, b]);

    if (!fusion && initialMatches.length === 0) {
      // Invalid move: swap back, no move consumed
      this.board[a.r][a.c] = gemA;
      this.board[b.r][b.c] = gemB;
      return {
        accepted: false,
        steps: [{ type: 'swap', a, b, valid: false }],
        pointsGained: 0,
        movesLeft: this.movesLeft,
        progress: cloneGoalProgress(this.progress),
        outcome: evaluateOutcome(this.config.goals, this.progress, this.movesLeft),
        boardHash: computeBoardHash(this.board),
      };
    }

    // Valid move accepted!
    this.movesLeft--;
    const steps: Step[] = [{ type: 'swap', a, b, valid: true }];
    const initialScore = this.progress.score;

    if (fusion) {
      this.resolveFusion(fusion, a, b, gemA, gemB, steps);
    } else {
      let cascade = 1;
      let matches = initialMatches;
      const MAX_CASCADES = 6;
      while (matches.length > 0 && cascade <= MAX_CASCADES) {
        this.resolveWave(matches, cascade, steps);
        this.applyGravity(steps);
        this.applyRefill(steps, cascade);
        cascade++;
        if (cascade > MAX_CASCADES) break;
        matches = evaluateMatches(this.board);
      }
    }

    // After resolution, check if any valid moves remain. If none, shuffle.
    this.ensureValidMovesRemain(steps);

    const outcome = evaluateOutcome(this.config.goals, this.progress, this.movesLeft);

    // If won, reward leftover moves as bonus score: 1000 pts per remaining move (preserves movesLeft)
    if (outcome === 'won' && this.movesLeft > 0) {
      const movesBonus = this.movesLeft * 1000;
      this.progress.score += movesBonus;
    }

    const pointsGained = this.progress.score - initialScore;

    return {
      accepted: true,
      steps,
      pointsGained,
      movesLeft: this.movesLeft,
      progress: cloneGoalProgress(this.progress),
      outcome,
      boardHash: computeBoardHash(this.board),
    };
  }

  /**
   * Resolves a fusion swap between two special gems.
   */
  private resolveFusion(
    fusion: FusionType,
    a: Cell,
    b: Cell,
    gemA: Gem,
    gemB: Gem,
    steps: Step[]
  ): void {
    const rows = this.board.length;
    const cols = this.board[0].length;
    let cascade = 1;

    if (fusion.type === 'bomb_bomb') {
      // Bomb + Bomb: Row + Col + 5x5 centered at b
      const center = b;
      const affected = getBombBombArea(this.board, center);
      const queue: Activation[] = [];
      const activatedIds = new Set<number>([gemA.id, gemB.id]);
      this.progress.detonated += 2;
      this.progress.score += SPECIAL_POINTS.bombBombFusion;

      steps.push({
        type: 'detonate',
        origin: center,
        gem: gemB,
        affected,
        wave: 1,
        trigger: { type: 'fusion' },
      });

      const toClearMap = new Map<string, { cell: Cell; gem: Gem; wave: number }>();
      toClearMap.set(`${a.r},${a.c}`, { cell: a, gem: gemA, wave: 1 });
      toClearMap.set(`${b.r},${b.c}`, { cell: b, gem: gemB, wave: 1 });

      for (const cell of affected) {
        const gem = this.board[cell.r][cell.c];
        if (gem) {
          toClearMap.set(`${cell.r},${cell.c}`, { cell, gem, wave: 1 });
          if (gem.kind === 'bomb' && !activatedIds.has(gem.id)) {
            activatedIds.add(gem.id);
            this.progress.detonated++;
            queue.push({
              cell,
              gem,
              wave: 2,
              trigger: { type: 'blast', sourceCell: center },
            });
          } else if (gem.kind === 'rainbow' && !activatedIds.has(gem.id)) {
            activatedIds.add(gem.id);
            queue.push({
              cell,
              gem,
              wave: 2,
              trigger: { type: 'blast', sourceCell: center },
            });
          }
        }
      }

      this.processActivationQueue(queue, activatedIds, toClearMap, steps);
      this.commitClears(toClearMap, 'fusion', cascade, steps);
    } else if (fusion.type === 'rainbow_normal') {
      // Rainbow + Normal: destroy all of color k
      const rainbowCell = gemA.kind === 'rainbow' ? a : b;
      const color = fusion.color;
      this.progress.score += SPECIAL_POINTS.rainbowSimple;

      const queue: Activation[] = [];
      const activatedIds = new Set<number>();
      const rainbowGem = this.board[rainbowCell.r][rainbowCell.c]!;
      activatedIds.add(rainbowGem.id);

      const targetCells: { cell: Cell; gem: Gem; dist: number }[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const gem = this.board[r][c];
          if (gem && gem.kind !== 'rainbow' && gem.color === color) {
            targetCells.push({
              cell: { r, c },
              gem,
              dist: manhattanDistance(rainbowCell, { r, c }),
            });
          }
        }
      }

      // Sort by Manhattan distance, then row-major
      targetCells.sort((x, y) =>
        x.dist !== y.dist
          ? x.dist - y.dist
          : x.cell.r !== y.cell.r
          ? x.cell.r - y.cell.r
          : x.cell.c - y.cell.c
      );

      const toClearMap = new Map<string, { cell: Cell; gem: Gem; wave: number }>();
      toClearMap.set(`${rainbowCell.r},${rainbowCell.c}`, {
        cell: rainbowCell,
        gem: rainbowGem,
        wave: 1,
      });

      for (const t of targetCells) {
        const wave = Math.max(1, Math.min(5, Math.floor(t.dist / 2) + 1));
        toClearMap.set(`${t.cell.r},${t.cell.c}`, { cell: t.cell, gem: t.gem, wave });
        if (t.gem.kind === 'bomb' && !activatedIds.has(t.gem.id)) {
          activatedIds.add(t.gem.id);
          this.progress.detonated++;
          queue.push({
            cell: t.cell,
            gem: t.gem,
            wave: wave + 1,
            trigger: { type: 'blast', sourceCell: rainbowCell },
          });
        }
      }

      this.processActivationQueue(queue, activatedIds, toClearMap, steps);
      this.commitClears(toClearMap, 'rainbowTarget', cascade, steps);
    } else if (fusion.type === 'rainbow_bomb') {
      // Rainbow + Bomb: Transform all color k to bombs, then detonate in sequence
      const rainbowCell = gemA.kind === 'rainbow' ? a : b;
      const bombSwapCell = gemA.kind === 'rainbow' ? b : a;
      const color = fusion.color;
      this.progress.score += SPECIAL_POINTS.rainbowBombFusion;

      const rainbowGem = this.board[rainbowCell.r][rainbowCell.c]!;
      const activatedIds = new Set<number>([rainbowGem.id]);

      const toTransformCells: Cell[] = [];
      const transformedGems: Gem[] = [];
      const bombsToDetonate: { cell: Cell; gem: Gem; dist: number }[] = [];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const gem = this.board[r][c];
          if (gem && gem.kind !== 'rainbow' && gem.color === color) {
            const cell = { r, c };
            const dist = manhattanDistance(bombSwapCell, cell);
            if (gem.kind === 'normal') {
              const newBomb: Gem = {
                id: gem.id,
                kind: 'bomb',
                color: gem.color,
                tier: 1,
              };
              this.board[r][c] = newBomb;
              toTransformCells.push(cell);
              transformedGems.push(newBomb);
              bombsToDetonate.push({ cell, gem: newBomb, dist });
            } else {
              // Existing bomb retains tier
              bombsToDetonate.push({ cell, gem, dist });
            }
          }
        }
      }

      if (toTransformCells.length > 0) {
        steps.push({
          type: 'transform',
          cells: toTransformCells,
          to: transformedGems,
        });
      }

      // Order detonation: Manhattan distance to swap, then row-major
      bombsToDetonate.sort((x, y) =>
        x.dist !== y.dist
          ? x.dist - y.dist
          : x.cell.r !== y.cell.r
          ? x.cell.r - y.cell.r
          : x.cell.c - y.cell.c
      );

      const toClearMap = new Map<string, { cell: Cell; gem: Gem; wave: number }>();
      toClearMap.set(`${rainbowCell.r},${rainbowCell.c}`, {
        cell: rainbowCell,
        gem: rainbowGem,
        wave: 1,
      });

      const queue: Activation[] = [];
      let seqWave = 1;
      for (const bItem of bombsToDetonate) {
        if (!activatedIds.has(bItem.gem.id)) {
          activatedIds.add(bItem.gem.id);
          this.progress.detonated++;
          queue.push({
            cell: bItem.cell,
            gem: bItem.gem,
            wave: seqWave,
            trigger: { type: 'fusion' },
          });
          seqWave++;
        }
      }

      this.processActivationQueue(queue, activatedIds, toClearMap, steps);
      this.commitClears(toClearMap, 'fusion', cascade, steps);
    } else if (fusion.type === 'rainbow_rainbow') {
      // Rainbow + Rainbow: Full board wipe in concentric waves from b
      const center = b;
      this.progress.score += SPECIAL_POINTS.rainbowRainbowFusion;
      const toClearMap = new Map<string, { cell: Cell; gem: Gem; wave: number }>();

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const gem = this.board[r][c];
          if (gem) {
            const wave = manhattanDistance(center, { r, c }) + 1;
            toClearMap.set(`${r},${c}`, { cell: { r, c }, gem, wave });
            if (gem.kind === 'bomb') {
              this.progress.detonated++;
            }
          }
        }
      }

      this.commitClears(toClearMap, 'fusion', cascade, steps);
    }

    // Now gravity and refill after fusion
    this.applyGravity(steps);
    this.applyRefill(steps);

    // Check subsequent cascades
    cascade++;
    let matches = evaluateMatches(this.board);
    const MAX_FUSION_CASCADES = 6;
    while (matches.length > 0 && cascade <= MAX_FUSION_CASCADES) {
      this.resolveWave(matches, cascade, steps);
      this.applyGravity(steps);
      this.applyRefill(steps, cascade);
      cascade++;
      if (cascade > MAX_FUSION_CASCADES) break;
      matches = evaluateMatches(this.board);
    }
  }

  /**
   * Resolves a single wave of matches and resulting special activations.
   */
  private resolveWave(
    matches: MatchGroup[],
    cascade: number,
    steps: Step[]
  ): void {
    const toClearMap = new Map<string, { cell: Cell; gem: Gem; wave: number }>();
    const queue: Activation[] = [];
    const activatedIds = new Set<number>();
    const spawnsToPlace: { cell: Cell; gem: Gem; from: Cell[] }[] = [];

    // 1. Process matches and plan special spawns
    for (const group of matches) {
      if (group.spawn) {
        const spec = group.spawn;
        let newGem: Gem;
        if (spec.kind === 'rainbow') {
          newGem = { id: this.nextId(), kind: 'rainbow' };
          this.progress.created.rainbow++;
        } else {
          newGem = {
            id: this.nextId(),
            kind: 'bomb',
            color: group.color,
            tier: spec.tier || 1,
          };
          if (spec.tier === 2) {
            this.progress.created.bomb2++;
          } else {
            this.progress.created.bomb1++;
          }
        }
        spawnsToPlace.push({ cell: spec.cell, gem: newGem, from: group.cells });
      }

      // Mark matched cells to clear and enqueue any existing specials inside the match
      for (const cell of group.cells) {
        const gem = this.board[cell.r][cell.c];
        if (gem) {
          toClearMap.set(`${cell.r},${cell.c}`, { cell, gem, wave: 1 });
          if ((gem.kind === 'bomb' || gem.kind === 'rainbow') && !activatedIds.has(gem.id)) {
            activatedIds.add(gem.id);
            if (gem.kind === 'bomb') {
              this.progress.detonated++;
            }
            queue.push({
              cell,
              gem,
              wave: 1,
              trigger: {
                type: 'match',
                matchCells: [...group.cells],
              },
            });
          }
        }
      }
    }

    // 2. Process activation queue (chain explosions)
    this.processActivationQueue(queue, activatedIds, toClearMap, steps);

    // 3. Commit clears and remove gems from board
    this.commitClears(toClearMap, 'match', cascade, steps);

    // 4. Place spawned specials onto the board (IMMUNE to this wave and turn's passive cascade matches)
    for (const sp of spawnsToPlace) {
      this.board[sp.cell.r][sp.cell.c] = sp.gem;
      steps.push({
        type: 'spawnSpecial',
        cell: sp.cell,
        gem: sp.gem,
        from: sp.from,
      });
    }
  }

  /**
   * Processes the FIFO activation queue of special gems (bombs and rainbows hit by blasts).
   */
  private processActivationQueue(
    queue: Activation[],
    activatedIds: Set<number>,
    toClearMap: Map<string, { cell: Cell; gem: Gem; wave: number }>,
    steps: Step[]
  ): void {
    const rows = this.board.length;
    const cols = this.board[0].length;

    while (queue.length > 0) {
      const act = queue.shift()!;
      if (act.gem.kind === 'bomb') {
        const area = getBombArea(this.board, act.cell, act.gem.tier);
        const pts = act.gem.tier === 1 ? SPECIAL_POINTS.bombTier1 : SPECIAL_POINTS.bombTier2;
        this.progress.score += pts;

        steps.push({
          type: 'detonate',
          origin: act.cell,
          gem: act.gem,
          affected: area,
          wave: act.wave,
          trigger: act.trigger,
        });

        toClearMap.set(`${act.cell.r},${act.cell.c}`, {
          cell: act.cell,
          gem: act.gem,
          wave: act.wave,
        });

        for (const cell of area) {
          const gem = this.board[cell.r][cell.c];
          if (gem) {
            toClearMap.set(`${cell.r},${cell.c}`, {
              cell,
              gem,
              wave: act.wave + 1,
            });
            if (!activatedIds.has(gem.id)) {
              if (gem.kind === 'bomb') {
                activatedIds.add(gem.id);
                this.progress.detonated++;
                queue.push({
                  cell,
                  gem,
                  wave: act.wave + 1,
                  trigger: {
                    type: 'blast',
                    sourceCell: act.cell,
                  },
                });
              } else if (gem.kind === 'rainbow') {
                activatedIds.add(gem.id);
                queue.push({
                  cell,
                  gem,
                  wave: act.wave + 1,
                  trigger: {
                    type: 'blast',
                    sourceCell: act.cell,
                  },
                });
              }
            }
          }
        }
      } else if (act.gem.kind === 'rainbow') {
        // Rainbow triggered by explosion: activates against most abundant color
        this.progress.score += SPECIAL_POINTS.rainbowSimple;
        const targetColor = getMostAbundantColor(this.board);

        toClearMap.set(`${act.cell.r},${act.cell.c}`, {
          cell: act.cell,
          gem: act.gem,
          wave: act.wave,
        });

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const gem = this.board[r][c];
            if (gem && gem.kind !== 'rainbow' && gem.color === targetColor) {
              const cell = { r, c };
              toClearMap.set(`${r},${c}`, { cell, gem, wave: act.wave + 1 });
              if (gem.kind === 'bomb' && !activatedIds.has(gem.id)) {
                activatedIds.add(gem.id);
                this.progress.detonated++;
                queue.push({
                  cell,
                  gem,
                  wave: act.wave + 2,
                  trigger: {
                    type: 'blast',
                    sourceCell: act.cell,
                  },
                });
              }
            }
          }
        }
      }
    }
  }

  /**
   * Commits cleared cells, records points, updates progress and sets board cells to null.
   */
  private commitClears(
    toClearMap: Map<string, { cell: Cell; gem: Gem; wave: number }>,
    cause: ClearCause,
    cascade: number,
    steps: Step[]
  ): void {
    if (toClearMap.size === 0) return;

    const clearList = Array.from(toClearMap.values()).sort((a, b) =>
      a.wave !== b.wave
        ? a.wave - b.wave
        : a.cell.r !== b.cell.r
        ? a.cell.r - b.cell.r
        : a.cell.c - b.cell.c
    );

    let wavePoints = 0;
    for (const item of clearList) {
      const pts = getGemClearPoints(cascade);
      wavePoints += pts;
      this.progress.score += pts;

      if (item.gem.kind !== 'rainbow') {
        this.progress.collected[item.gem.color] =
          (this.progress.collected[item.gem.color] || 0) + 1;
      }
      this.board[item.cell.r][item.cell.c] = null;
    }

    steps.push({
      type: 'clear',
      cells: clearList,
      cause,
      cascade,
      points: wavePoints,
    });
  }

  /**
   * Applies gravity: pulls gems down in each column.
   */
  private applyGravity(steps: Step[]): void {
    const rows = this.board.length;
    const cols = this.board[0].length;
    const gravityMoves: { id: number; from: Cell; to: Cell }[] = [];

    for (let c = 0; c < cols; c++) {
      for (let r = rows - 1; r >= 0; r--) {
        if (this.board[r][c] === null) {
          // Look above for the next non-null gem
          for (let rScan = r - 1; rScan >= 0; rScan--) {
            const gem = this.board[rScan][c];
            if (gem !== null) {
              this.board[r][c] = gem;
              this.board[rScan][c] = null;
              gravityMoves.push({
                id: gem.id,
                from: { r: rScan, c },
                to: { r, c },
              });
              break;
            }
          }
        }
      }
    }

    if (gravityMoves.length > 0) {
      steps.push({
        type: 'gravity',
        moves: gravityMoves,
      });
    }
  }

  /**
   * Checks whether placing a gem of color at (r, c) would immediately complete a 3-in-a-row.
   */
  private wouldCreateMatch(r: number, c: number, color: GemColor): boolean {
    const rows = this.board.length;
    const cols = this.board[0].length;

    // Check down 2
    if (r + 2 < rows) {
      const g1 = this.board[r + 1][c];
      const g2 = this.board[r + 2][c];
      if (g1 && g2 && g1.kind !== 'rainbow' && g2.kind !== 'rainbow' && g1.color === color && g2.color === color) {
        return true;
      }
    }

    // Check left 2
    if (c >= 2) {
      const g1 = this.board[r][c - 1];
      const g2 = this.board[r][c - 2];
      if (g1 && g2 && g1.kind !== 'rainbow' && g2.kind !== 'rainbow' && g1.color === color && g2.color === color) {
        return true;
      }
    }

    // Check right 2
    if (c + 2 < cols) {
      const g1 = this.board[r][c + 1];
      const g2 = this.board[r][c + 2];
      if (g1 && g2 && g1.kind !== 'rainbow' && g2.kind !== 'rainbow' && g1.color === color && g2.color === color) {
        return true;
      }
    }

    // Check horizontal sandwich (left and right)
    if (c >= 1 && c + 1 < cols) {
      const g1 = this.board[r][c - 1];
      const g2 = this.board[r][c + 1];
      if (g1 && g2 && g1.kind !== 'rainbow' && g2.kind !== 'rainbow' && g1.color === color && g2.color === color) {
        return true;
      }
    }

    return false;
  }

  /**
   * Refills empty cells at the top of each column using the column's PRNG stream.
   * On cascade >= 2, dampens refills by avoiding immediate automatic 3-in-a-rows.
   */
  private applyRefill(steps: Step[], _cascade: number = 1): void {
    const rows = this.board.length;
    const cols = this.board[0].length;
    const spawns: { gem: Gem; col: number; toRow: number; dropFrom: number }[] = [];

    for (let c = 0; c < cols; c++) {
      let emptyCount = 0;
      for (let r = 0; r < rows; r++) {
        if (this.board[r][c] === null) {
          emptyCount++;
        }
      }

      if (emptyCount > 0) {
        const colRng = this.rngManager.getSpawnRng(c);
        let dropIndex = emptyCount;
        for (let r = emptyCount - 1; r >= 0; r--) {
          const allowedColors: GemColor[] = [];
          for (let clr = 0; clr < this.config.colors; clr++) {
            const gClr = clr as GemColor;
            // Exclude colors that immediately create runaway automatic 3-in-a-rows
            if (!this.wouldCreateMatch(r, c, gClr)) {
              allowedColors.push(gClr);
            }
          }

          const color: GemColor =
            allowedColors.length > 0
              ? allowedColors[colRng.int(allowedColors.length)]
              : (colRng.int(this.config.colors) as GemColor);

          const newGem: Gem = {
            id: this.nextId(),
            kind: 'normal',
            color,
          };
          this.board[r][c] = newGem;
          spawns.push({
            gem: newGem,
            col: c,
            toRow: r,
            dropFrom: -dropIndex,
          });
          dropIndex--;
        }
      }
    }

    if (spawns.length > 0) {
      // Sort spawns for deterministic step ordering
      spawns.sort((a, b) =>
        a.col !== b.col ? a.col - b.col : a.toRow - b.toRow
      );
      steps.push({
        type: 'refill',
        spawns,
      });
    }
  }

  /**
   * Ensures at least one valid move exists. If none, shuffles using shuffleRng.
   */
  private ensureValidMovesRemain(steps: Step[]): void {
    const rows = this.board.length;
    const cols = this.board[0].length;
    const maxShuffleAttempts = 50;

    let attempts = 0;
    while (this.findValidMoves().length === 0 && attempts < maxShuffleAttempts) {
      attempts++;
      const allCells: Cell[] = [];
      const gems: Gem[] = [];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const gem = this.board[r][c];
          if (gem) {
            allCells.push({ r, c });
            gems.push(gem);
          }
        }
      }

      // Fisher-Yates shuffle using shuffleRng
      for (let i = gems.length - 1; i > 0; i--) {
        const j = this.rngManager.shuffleRng.int(i + 1);
        const temp = gems[i];
        gems[i] = gems[j];
        gems[j] = temp;
      }

      const shuffleMoves: { id: number; from: Cell; to: Cell }[] = [];
      let idx = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const newGem = gems[idx];
          const oldGem = this.board[r][c]!;
          if (newGem.id !== oldGem.id) {
            shuffleMoves.push({
              id: newGem.id,
              from: allCells[idx],
              to: { r, c },
            });
          }
          this.board[r][c] = newGem;
          idx++;
        }
      }

      // Check that the shuffle doesn't accidentally have matches
      const accidentalMatches = evaluateMatches(this.board);
      if (accidentalMatches.length === 0 && this.findValidMoves().length > 0) {
        steps.push({
          type: 'shuffle',
          moves: shuffleMoves,
        });
        break;
      }
    }
  }
}
