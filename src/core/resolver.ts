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
  createEmptyBoard,
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
import { getComboRating, getGemClearPoints, getRandomBoardClearExclamation, SPECIAL_POINTS } from './scoring';
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
    this.rngManager = new BoardRngManager(config.level, config.cols, config.seedKey);

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
    const steps: Step[] = [{
      type: 'swap',
      a,
      b,
      valid: true,
      scoreAfter: this.progress.score,
      progressAfter: cloneGoalProgress(this.progress),
    }];
    const initialScore = this.progress.score;

    if (fusion) {
      this.resolveFusion(fusion, a, b, gemA, gemB, steps);
    } else {
      this.resolveCascades(initialMatches, 1, steps);
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
    const cascade = 1;

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
        gem: gemB.kind === 'bomb' ? { ...gemB, tier: 2 } : gemB,
        affected,
        wave: 1,
        trigger: { type: 'fusion' },
        points: SPECIAL_POINTS.bombBombFusion,
        isCrossBlast: true,
        scoreAfter: this.progress.score,
        progressAfter: cloneGoalProgress(this.progress),
      });

      const toClearMap = new Map<string, { cell: Cell; gem: Gem; wave: number; bonusPoints?: number }>();
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
      // Note: gemA is now at cell b, gemB is now at cell a
      const rainbowCell = gemA.kind === 'rainbow' ? b : a;
      const color = fusion.color;

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

      const toClearMap = new Map<string, { cell: Cell; gem: Gem; wave: number; bonusPoints?: number }>();
      toClearMap.set(`${rainbowCell.r},${rainbowCell.c}`, {
        cell: rainbowCell,
        gem: rainbowGem,
        wave: 1,
        bonusPoints: SPECIAL_POINTS.rainbowSimple,
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
      // Note: gemA is now at cell b, gemB is now at cell a
      const rainbowCell = gemA.kind === 'rainbow' ? b : a;
      const bombSwapCell = gemA.kind === 'rainbow' ? a : b;
      const color = fusion.color;

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
                tier: fusion.bombTier,
              };
              this.board[r][c] = newBomb;
              toTransformCells.push(cell);
              transformedGems.push(newBomb);
              bombsToDetonate.push({ cell, gem: newBomb, dist });

              if (fusion.bombTier === 2) {
                this.progress.created.bomb2++;
              } else {
                this.progress.created.bomb1++;
              }
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
          scoreAfter: this.progress.score,
          progressAfter: cloneGoalProgress(this.progress),
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

      const toClearMap = new Map<string, { cell: Cell; gem: Gem; wave: number; bonusPoints?: number }>();
      toClearMap.set(`${rainbowCell.r},${rainbowCell.c}`, {
        cell: rainbowCell,
        gem: rainbowGem,
        wave: 1,
        bonusPoints: SPECIAL_POINTS.rainbowBombFusion,
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
      // Rainbow + Rainbow: Cosmic Black Hole Singularity! Full board wipe
      const center = b;
      const toClearMap = new Map<string, { cell: Cell; gem: Gem; wave: number; bonusPoints?: number }>();

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const gem = this.board[r][c];
          if (gem) {
            const isCenter = r === center.r && c === center.c;
            const wave = manhattanDistance(center, { r, c }) + 1;
            toClearMap.set(`${r},${c}`, {
              cell: { r, c },
              gem,
              wave,
              bonusPoints: isCenter ? SPECIAL_POINTS.rainbowRainbowFusion : 150,
            });
            if (gem.kind === 'bomb') {
              this.progress.detonated++;
            }
          }
        }
      }

      this.commitClears(toClearMap, 'fusion', cascade, steps, true, center);

      // Singularity Combo Announcement Banner
      steps.push({
        type: 'combo',
        cascade: 8,
        title: '¡VÓRTICE CÓSMICO!',
        tier: 5,
        points: SPECIAL_POINTS.rainbowRainbowFusion,
        scoreAfter: this.progress.score,
        progressAfter: cloneGoalProgress(this.progress),
      });
    }

    // Now gravity and refill after fusion
    this.applyGravity(steps);
    this.applyRefill(steps, cascade);

    // Check subsequent cascades
    this.resolveCascades(evaluateMatches(this.board), cascade + 1, steps);
  }

  /**
   * Resolves match waves and resulting cascades up to the safety cascade limit.
   */
  private resolveCascades(
    initialMatches: MatchGroup[],
    startCascade: number,
    steps: Step[]
  ): void {
    let cascade = startCascade;
    let matches = initialMatches;
    const MAX_SAFETY_CASCADES = 50;

    while (matches.length > 0 && cascade <= MAX_SAFETY_CASCADES) {
      this.resolveWave(matches, cascade, steps);

      const combo = getComboRating(cascade);
      if (combo) {
        this.progress.score += combo.points;
        steps.push({
          type: 'combo',
          cascade,
          title: combo.title,
          tier: combo.tier,
          points: combo.points,
          scoreAfter: this.progress.score,
          progressAfter: cloneGoalProgress(this.progress),
        });
      }

      this.applyGravity(steps);
      this.applyRefill(steps, cascade);
      cascade++;
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
    const toClearMap = new Map<string, { cell: Cell; gem: Gem; wave: number; bonusPoints?: number }>();
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
    this.commitClears(toClearMap, 'match', cascade, steps, false, undefined, spawnsToPlace.length > 0);

    // 4. Place spawned specials onto the board (IMMUNE to this wave and turn's passive cascade matches)
    for (const sp of spawnsToPlace) {
      this.board[sp.cell.r][sp.cell.c] = sp.gem;
      steps.push({
        type: 'spawnSpecial',
        cell: sp.cell,
        gem: sp.gem,
        from: sp.from,
        scoreAfter: this.progress.score,
        progressAfter: cloneGoalProgress(this.progress),
      });
    }
  }

  /**
   * Processes the FIFO activation queue of special gems (bombs and rainbows hit by blasts).
   */
  private processActivationQueue(
    queue: Activation[],
    activatedIds: Set<number>,
    toClearMap: Map<string, { cell: Cell; gem: Gem; wave: number; bonusPoints?: number }>,
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
          points: pts,
          scoreAfter: this.progress.score,
          progressAfter: cloneGoalProgress(this.progress),
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
        // Rainbow triggered by explosion: activates against most abundant remaining color
        const targetColor = getMostAbundantColor(this.board, toClearMap);
        const affected: Cell[] = [];

        toClearMap.set(`${act.cell.r},${act.cell.c}`, {
          cell: act.cell,
          gem: act.gem,
          wave: act.wave,
          bonusPoints: SPECIAL_POINTS.rainbowSimple,
        });

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (toClearMap.has(`${r},${c}`)) continue;
            const gem = this.board[r][c];
            if (gem && gem.kind !== 'rainbow' && gem.color === targetColor) {
              const cell = { r, c };
              affected.push(cell);
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

        steps.push({
          type: 'detonate',
          origin: act.cell,
          gem: act.gem,
          affected,
          wave: act.wave,
          trigger: act.trigger,
          scoreAfter: this.progress.score,
          progressAfter: cloneGoalProgress(this.progress),
        });
      }
    }
  }

  /**
   * Commits cleared cells, records points, updates progress and sets board cells to null.
   */
  private commitClears(
    toClearMap: Map<string, { cell: Cell; gem: Gem; wave: number; bonusPoints?: number }>,
    cause: ClearCause,
    cascade: number,
    steps: Step[],
    isBlackHole?: boolean,
    vortexCenter?: Cell,
    hasPendingSpawns?: boolean
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
    const finalClearCells: { cell: Cell; gem: Gem; wave: number; points: number }[] = [];
    for (const item of clearList) {
      const basePts = getGemClearPoints(cascade);
      const bonus = item.bonusPoints || 0;
      const pts = basePts + bonus;
      wavePoints += pts;
      this.progress.score += pts;

      if (item.gem.kind !== 'rainbow') {
        this.progress.collected[item.gem.color] =
          (this.progress.collected[item.gem.color] || 0) + 1;
      }
      this.board[item.cell.r][item.cell.c] = null;
      finalClearCells.push({
        cell: item.cell,
        gem: item.gem,
        wave: item.wave,
        points: pts,
      });
    }

    steps.push({
      type: 'clear',
      cells: finalClearCells,
      cause,
      cascade,
      points: wavePoints,
      isBlackHole,
      vortexCenter,
      scoreAfter: this.progress.score,
      progressAfter: cloneGoalProgress(this.progress),
    });

    // Check if the board has been completely cleared (Full Board Clear / Tablero Limpio)
    if (!hasPendingSpawns && this.isBoardCompletelyEmpty()) {
      const phrase = getRandomBoardClearExclamation(this.rngManager?.eventRng);
      const bonusPoints = SPECIAL_POINTS.boardClear;
      this.progress.score += bonusPoints;
      steps.push({
        type: 'boardClear',
        title: phrase,
        points: bonusPoints,
        scoreAfter: this.progress.score,
        progressAfter: cloneGoalProgress(this.progress),
      });
    }
  }

  public isBoardCompletelyEmpty(): boolean {
    const rows = this.board.length;
    const cols = this.board[0].length;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (this.board[r][c] !== null) {
          return false;
        }
      }
    }
    return true;
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
   * Returns the cascade wave count at which refill dampening begins.
   * - Levels 1–5 (Beginner): Lax. Waves 1, 2, 3 refill naturally; dampens only at wave 4+.
   * - Levels 6–12 (Intermediate): Balanced. Waves 1, 2 refill naturally; dampens at wave 3+.
   * - Levels 13+ (Advanced): Strict. Wave 1 refilled naturally; dampens at wave 2+ to require tactical bomb creation.
   */
  private getCascadeDampeningThreshold(): number {
    if (this.config.level <= 5) return 4;
    if (this.config.level <= 12) return 3;
    return 2;
  }

  /**
   * Refills empty cells at the top of each column using the column's PRNG stream.
   * Only applies dampening once cascade count reaches getCascadeDampeningThreshold().
   */
  private applyRefill(steps: Step[], cascade: number = 1): void {
    const rows = this.board.length;
    const cols = this.board[0].length;
    const spawns: { gem: Gem; col: number; toRow: number; dropFrom: number }[] = [];
    const shouldDampen = cascade >= this.getCascadeDampeningThreshold();

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
          let color: GemColor;

          if (shouldDampen) {
            const allowedColors: GemColor[] = [];
            for (let clr = 0; clr < this.config.colors; clr++) {
              const gClr = clr as GemColor;
              // Exclude colors that immediately create runaway automatic 3-in-a-rows
              if (!this.wouldCreateMatch(r, c, gClr)) {
                allowedColors.push(gClr);
              }
            }

            color =
              allowedColors.length > 0
                ? allowedColors[colRng.int(allowedColors.length)]
                : (colRng.int(this.config.colors) as GemColor);
          } else {
            // Natural random refill: allows exciting cascades and combos!
            color = colRng.int(this.config.colors) as GemColor;
          }

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
    const cols = rows > 0 ? this.board[0].length : 0;
    if (rows * cols < 2) return;
    if (this.findValidMoves().length > 0) return;

    // Map each existing gem ID to its current location and state before shuffle
    const prevLocation = new Map<number, Cell>();
    const origById = new Map<number, Gem>();
    const baseGems: Gem[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const gem = this.board[r][c];
        if (gem) {
          prevLocation.set(gem.id, { r, c });
          origById.set(gem.id, gem);
          baseGems.push(gem);
        }
      }
    }

    if (baseGems.length < 2) return;

    // Phase 1: Fast random Fisher-Yates attempts (preserves exact RNG progression when successful)
    const maxShuffleAttempts = 50;
    for (let attempt = 0; attempt < maxShuffleAttempts; attempt++) {
      const gems = [...baseGems];
      this.shuffleArrayInPlace(gems);
      const candidate = this.buildCandidateFromGems(gems);

      if (evaluateMatches(candidate).length === 0 && findValidMoves(candidate).length > 0) {
        this.commitShuffledBoard(candidate, prevLocation, steps);
        return;
      }
    }

    // Phase 2: Constructive balanced placement + swap-repair preserving all existing gems
    let matchFreeCandidate: Board | null = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = this.buildBalancedCandidate(baseGems);
      if (this.repairMatches(candidate)) {
        if (!matchFreeCandidate) matchFreeCandidate = cloneBoard(candidate);
        if (findValidMoves(candidate).length > 0 || this.injectValidMove(candidate)) {
          this.commitShuffledBoard(candidate, prevLocation, steps);
          return;
        }
      }
    }

    for (let attempt = 0; attempt < 10; attempt++) {
      const gems = [...baseGems];
      this.shuffleArrayInPlace(gems);
      const candidate = this.buildCandidateFromGems(gems);
      if (this.repairMatches(candidate)) {
        if (!matchFreeCandidate) matchFreeCandidate = cloneBoard(candidate);
        if (findValidMoves(candidate).length > 0 || this.injectValidMove(candidate)) {
          this.commitShuffledBoard(candidate, prevLocation, steps);
          return;
        }
      }
    }

    // Phase 3: Guaranteed fallback when no pure permutation of baseGems can yield a valid move
    const fallback = this.buildFallbackBoard(baseGems, matchFreeCandidate);
    this.commitShuffledBoard(fallback, prevLocation, steps, origById);
  }

  private shuffleArrayInPlace<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.rngManager.shuffleRng.int(i + 1);
      const temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
  }

  private buildCandidateFromGems(gems: Gem[]): Board {
    const rows = this.board.length;
    const cols = this.board[0].length;
    const candidate = createEmptyBoard(rows, cols);
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (this.board[r][c] !== null && idx < gems.length) {
          candidate[r][c] = gems[idx++];
        }
      }
    }
    return candidate;
  }

  private gemsEquivalent(a: Gem, b: Gem): boolean {
    if (a.kind !== b.kind) return false;
    if (a.kind === 'rainbow') return true;
    if (a.kind === 'bomb' && b.kind === 'bomb') {
      return a.color === b.color && a.tier === b.tier;
    }
    if (a.kind === 'normal' && b.kind === 'normal') {
      return a.color === b.color;
    }
    return false;
  }

  private commitShuffledBoard(
    candidate: Board,
    prevLocation: Map<number, Cell>,
    steps: Step[],
    origById?: Map<number, Gem>
  ): void {
    const rows = this.board.length;
    const cols = this.board[0].length;
    const shuffleMoves: { id: number; from: Cell; to: Cell }[] = [];
    const transformedCells: Cell[] = [];
    const transformedGems: Gem[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const newGem = candidate[r][c];
        const oldGem = this.board[r][c];
        if (!newGem) continue;

        if (oldGem && newGem.id !== oldGem.id) {
          const fromCell = prevLocation.get(newGem.id) ?? { r, c };
          shuffleMoves.push({
            id: newGem.id,
            from: fromCell,
            to: { r, c },
          });
        }

        if (origById) {
          const origGem = origById.get(newGem.id);
          if (origGem && !this.gemsEquivalent(origGem, newGem)) {
            transformedCells.push({ r, c });
            transformedGems.push(newGem);
          }
        }
      }
    }

    this.board = candidate;
    steps.push({
      type: 'shuffle',
      moves: shuffleMoves,
    });

    if (transformedCells.length > 0) {
      steps.push({
        type: 'transform',
        cells: transformedCells,
        to: transformedGems,
        scoreAfter: this.progress.score,
        progressAfter: cloneGoalProgress(this.progress),
      });
    }
  }

  private hasMatchAt(board: Board, r: number, c: number): boolean {
    const gem = board[r][c];
    if (!gem || gem.kind === 'rainbow') return false;
    const color = gem.color;
    const rows = board.length;
    const cols = board[0].length;

    const sameColor = (rr: number, cc: number): boolean => {
      if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) return false;
      const g = board[rr][cc];
      return g !== null && g.kind !== 'rainbow' && g.color === color;
    };

    if (sameColor(r, c - 1) && sameColor(r, c - 2)) return true;
    if (sameColor(r, c + 1) && sameColor(r, c + 2)) return true;
    if (sameColor(r, c - 1) && sameColor(r, c + 1)) return true;

    if (sameColor(r - 1, c) && sameColor(r - 2, c)) return true;
    if (sameColor(r + 1, c) && sameColor(r + 2, c)) return true;
    if (sameColor(r - 1, c) && sameColor(r + 1, c)) return true;

    return false;
  }

  private hasFinalizedMatchAt(
    board: Board,
    finalized: boolean[][],
    r: number,
    c: number,
    gem: Gem
  ): boolean {
    if (gem.kind === 'rainbow') return false;
    const color = gem.color;
    const rows = board.length;
    const cols = board[0].length;

    const sameColorFinalized = (rr: number, cc: number): boolean => {
      if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) return false;
      if (!finalized[rr][cc]) return false;
      const g = board[rr][cc];
      return g !== null && g.kind !== 'rainbow' && g.color === color;
    };

    if (sameColorFinalized(r, c - 1) && sameColorFinalized(r, c - 2)) return true;
    if (sameColorFinalized(r, c + 1) && sameColorFinalized(r, c + 2)) return true;
    if (sameColorFinalized(r, c - 1) && sameColorFinalized(r, c + 1)) return true;

    if (sameColorFinalized(r - 1, c) && sameColorFinalized(r - 2, c)) return true;
    if (sameColorFinalized(r + 1, c) && sameColorFinalized(r + 2, c)) return true;
    if (sameColorFinalized(r - 1, c) && sameColorFinalized(r + 1, c)) return true;

    return false;
  }

  private buildBalancedCandidate(baseGems: Gem[]): Board {
    const rows = this.board.length;
    const cols = this.board[0].length;
    const candidate = createEmptyBoard(rows, cols);

    const rainbows: Gem[] = [];
    const colorBuckets: Gem[][] = [[], [], [], [], []];
    for (const gem of baseGems) {
      if (gem.kind === 'rainbow') {
        rainbows.push(gem);
      } else {
        colorBuckets[gem.color].push(gem);
      }
    }

    this.shuffleArrayInPlace(rainbows);
    for (const bucket of colorBuckets) {
      this.shuffleArrayInPlace(bucket);
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (this.board[r][c] === null) continue;

        const legalColors: GemColor[] = [];
        for (let clr = 0; clr < 5; clr++) {
          if (colorBuckets[clr].length === 0) continue;
          const gClr = clr as GemColor;
          let blocked = false;
          if (c >= 2) {
            const g1 = candidate[r][c - 1];
            const g2 = candidate[r][c - 2];
            if (g1 && g2 && g1.kind !== 'rainbow' && g2.kind !== 'rainbow' && g1.color === gClr && g2.color === gClr) {
              blocked = true;
            }
          }
          if (!blocked && r >= 2) {
            const g1 = candidate[r - 1][c];
            const g2 = candidate[r - 2][c];
            if (g1 && g2 && g1.kind !== 'rainbow' && g2.kind !== 'rainbow' && g1.color === gClr && g2.color === gClr) {
              blocked = true;
            }
          }
          if (!blocked) {
            legalColors.push(gClr);
          }
        }

        if (legalColors.length > 0) {
          let maxCount = 0;
          for (const clr of legalColors) {
            if (colorBuckets[clr].length > maxCount) {
              maxCount = colorBuckets[clr].length;
            }
          }
          const topColors = legalColors.filter((clr) => colorBuckets[clr].length === maxCount);
          const chosenColor = topColors[this.rngManager.shuffleRng.int(topColors.length)];

          if (rainbows.length > 0 && this.rngManager.shuffleRng.int(rows * cols) < rainbows.length) {
            candidate[r][c] = rainbows.pop()!;
          } else {
            candidate[r][c] = colorBuckets[chosenColor].pop()!;
          }
        } else if (rainbows.length > 0) {
          candidate[r][c] = rainbows.pop()!;
        } else {
          for (let clr = 0; clr < 5; clr++) {
            if (colorBuckets[clr].length > 0) {
              candidate[r][c] = colorBuckets[clr].pop()!;
              break;
            }
          }
        }
      }
    }

    return candidate;
  }

  private repairMatches(candidate: Board): boolean {
    const rows = candidate.length;
    const cols = candidate[0].length;
    const total = rows * cols;
    const maxSwaps = total * 2 + 1;

    for (let step = 0; step < maxSwaps; step++) {
      const matches = evaluateMatches(candidate);
      if (matches.length === 0) return true;

      let swapped = false;
      for (const group of matches) {
        const mid = Math.floor(group.cells.length / 2);
        const orderedCells = [
          group.cells[mid],
          ...group.cells.filter((_, i) => i !== mid),
        ];

        for (const p of orderedCells) {
          const gemP = candidate[p.r][p.c];
          if (!gemP) continue;

          const offset = this.rngManager.shuffleRng.int(total);
          for (let k = 0; k < total; k++) {
            const idx = (offset + k) % total;
            const r2 = Math.floor(idx / cols);
            const c2 = idx % cols;
            if (r2 === p.r && c2 === p.c) continue;
            const gemQ = candidate[r2][c2];
            if (!gemQ) continue;
            if (gemP.kind !== 'rainbow' && gemQ.kind !== 'rainbow' && gemP.color === gemQ.color) {
              continue;
            }

            candidate[p.r][p.c] = gemQ;
            candidate[r2][c2] = gemP;
            if (!this.hasMatchAt(candidate, p.r, p.c) && !this.hasMatchAt(candidate, r2, c2)) {
              swapped = true;
              break;
            }
            candidate[p.r][p.c] = gemP;
            candidate[r2][c2] = gemQ;
          }
          if (swapped) break;
        }
        if (swapped) break;
      }

      if (!swapped) return false;
    }

    return evaluateMatches(candidate).length === 0;
  }

  private getMoveInjectionPatterns(
    board: Board
  ): { a: Cell; b: Cell; p: Cell; c: Cell }[] {
    const rows = board.length;
    const cols = board[0].length;
    const patterns: { a: Cell; b: Cell; p: Cell; c: Cell }[] = [];
    const dirs = [
      { dr: 0, dc: 1 },
      { dr: 1, dc: 0 },
      { dr: 0, dc: -1 },
      { dr: -1, dc: 0 },
    ];

    const addLine = (l0: Cell, l1: Cell, l2: Cell) => {
      if (!board[l0.r][l0.c] || !board[l1.r][l1.c] || !board[l2.r][l2.c]) return;
      const line = [l0, l1, l2];
      for (let pi = 0; pi < 3; pi++) {
        const p = line[pi];
        const a = line[(pi + 1) % 3];
        const b = line[(pi + 2) % 3];
        for (const d of dirs) {
          const c: Cell = { r: p.r + d.dr, c: p.c + d.dc };
          if (!isInside(board, c) || !board[c.r][c.c]) continue;
          if (
            (c.r === l0.r && c.c === l0.c) ||
            (c.r === l1.r && c.c === l1.c) ||
            (c.r === l2.r && c.c === l2.c)
          ) {
            continue;
          }
          patterns.push({ a, b, p, c });
        }
      }
    };

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (c + 2 < cols) {
          addLine({ r, c }, { r, c: c + 1 }, { r, c: c + 2 });
        }
        if (r + 2 < rows) {
          addLine({ r, c }, { r: r + 1, c }, { r: r + 2, c });
        }
      }
    }

    return patterns;
  }

  private injectValidMove(candidate: Board): boolean {
    const rows = candidate.length;
    const cols = candidate[0].length;

    // Try pairing two existing bombs adjacent to form a bomb+bomb fusion move
    const bombs: Cell[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const g = candidate[r][c];
        if (g && g.kind === 'bomb') {
          bombs.push({ r, c });
        }
      }
    }
    if (bombs.length >= 2) {
      const dirs = [
        { dr: -1, dc: 0 },
        { dr: 1, dc: 0 },
        { dr: 0, dc: -1 },
        { dr: 0, dc: 1 },
      ];
      for (const b1 of bombs) {
        for (const d of dirs) {
          const nb: Cell = { r: b1.r + d.dr, c: b1.c + d.dc };
          if (!isInside(candidate, nb)) continue;
          const nbGem = candidate[nb.r][nb.c];
          if (!nbGem) continue;
          for (const b2 of bombs) {
            if ((b2.r === b1.r && b2.c === b1.c) || (b2.r === nb.r && b2.c === nb.c)) continue;
            const b2Gem = candidate[b2.r][b2.c]!;
            candidate[nb.r][nb.c] = b2Gem;
            candidate[b2.r][b2.c] = nbGem;
            if (
              !this.hasMatchAt(candidate, nb.r, nb.c) &&
              !this.hasMatchAt(candidate, b2.r, b2.c) &&
              findValidMoves(candidate).length > 0
            ) {
              return true;
            }
            candidate[nb.r][nb.c] = nbGem;
            candidate[b2.r][b2.c] = b2Gem;
          }
        }
      }
    }

    const colorCounts = [0, 0, 0, 0, 0];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const g = candidate[r][c];
        if (g && g.kind !== 'rainbow') {
          colorCounts[g.color]++;
        }
      }
    }
    const eligibleColors = ([0, 1, 2, 3, 4] as GemColor[])
      .filter((clr) => colorCounts[clr] >= 3)
      .sort((a, b) => colorCounts[b] - colorCounts[a]);
    if (eligibleColors.length === 0) return false;

    const patterns = this.getMoveInjectionPatterns(candidate);
    if (patterns.length === 0) return false;

    const patternOffset = this.rngManager.shuffleRng.int(patterns.length);
    for (const targetColor of eligibleColors) {
      for (let k = 0; k < patterns.length; k++) {
        const pat = patterns[(patternOffset + k) % patterns.length];
        const trial = cloneBoard(candidate);
        const reserved = new Set<string>([
          `${pat.a.r},${pat.a.c}`,
          `${pat.b.r},${pat.b.c}`,
          `${pat.p.r},${pat.p.c}`,
          `${pat.c.r},${pat.c.c}`,
        ]);

        const findSwapSource = (
          slot: Cell,
          predicate: (g: Gem) => boolean
        ): Cell | null => {
          const slotGem = trial[slot.r][slot.c]!;
          let fallbackSrc: Cell | null = null;
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              if (reserved.has(`${r},${c}`)) continue;
              const g = trial[r][c];
              if (!g || !predicate(g)) continue;
              if (!fallbackSrc) fallbackSrc = { r, c };
              trial[slot.r][slot.c] = g;
              trial[r][c] = slotGem;
              const clean = !this.hasMatchAt(trial, r, c);
              trial[slot.r][slot.c] = slotGem;
              trial[r][c] = g;
              if (clean) return { r, c };
            }
          }
          return fallbackSrc;
        };

        let ok = true;
        for (const slot of [pat.a, pat.b, pat.c]) {
          const cur = trial[slot.r][slot.c]!;
          if (cur.kind !== 'rainbow' && cur.color === targetColor) continue;
          const src = findSwapSource(slot, (g) => g.kind !== 'rainbow' && g.color === targetColor);
          if (!src) {
            ok = false;
            break;
          }
          trial[slot.r][slot.c] = trial[src.r][src.c];
          trial[src.r][src.c] = cur;
        }
        if (!ok) continue;

        const pGem = trial[pat.p.r][pat.p.c]!;
        if (pGem.kind !== 'rainbow' && pGem.color === targetColor) {
          const src = findSwapSource(pat.p, (g) => g.kind === 'rainbow' || g.color !== targetColor);
          if (!src) continue;
          trial[pat.p.r][pat.p.c] = trial[src.r][src.c];
          trial[src.r][src.c] = pGem;
        }

        if (evaluateMatches(trial).length === 0 && findValidMoves(trial).length > 0) {
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              candidate[r][c] = trial[r][c];
            }
          }
          return true;
        }
      }
    }

    return false;
  }

  private buildFallbackBoard(baseGems: Gem[], matchFreeCandidate: Board | null): Board {
    const rows = this.board.length;
    const cols = this.board[0].length;

    // Case 3A: Patch an already match-free board by minimally recoloring 1-4 normal gems
    if (matchFreeCandidate) {
      const patterns = this.getMoveInjectionPatterns(matchFreeCandidate);
      if (patterns.length > 0) {
        const normalPatterns = patterns.filter((pat) => {
          const cells = [pat.a, pat.b, pat.p, pat.c];
          return cells.every((cell) => matchFreeCandidate[cell.r][cell.c]?.kind === 'normal');
        });
        const pool = normalPatterns.length > 0 ? normalPatterns : patterns;
        const patOffset = this.rngManager.shuffleRng.int(pool.length);
        const colorOffset = this.rngManager.shuffleRng.int(this.config.colors);

        for (let k = 0; k < pool.length; k++) {
          const pat = pool[(patOffset + k) % pool.length];
          for (let ci = 0; ci < this.config.colors; ci++) {
            const c0 = ((colorOffset + ci) % this.config.colors) as GemColor;
            const c1 = ((c0 + 1) % this.config.colors) as GemColor;
            const trial = cloneBoard(matchFreeCandidate);

            for (const slot of [pat.a, pat.b, pat.c]) {
              const g = trial[slot.r][slot.c]!;
              trial[slot.r][slot.c] = { id: g.id, kind: 'normal', color: c0 };
            }
            const pGem = trial[pat.p.r][pat.p.c]!;
            if (pGem.kind !== 'rainbow' && pGem.color === c0) {
              trial[pat.p.r][pat.p.c] = { id: pGem.id, kind: 'normal', color: c1 };
            }

            if (evaluateMatches(trial).length === 0 && findValidMoves(trial).length > 0) {
              return trial;
            }
          }
        }
      }
    }

    // Case 3B: Build a guaranteed match-free board with a seeded valid move (or rainbow on sub-3x2 boards)
    const shuffled = [...baseGems];
    this.shuffleArrayInPlace(shuffled);
    const trial = this.buildCandidateFromGems(shuffled);
    const finalized: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
    const patterns = this.getMoveInjectionPatterns(trial);

    if (patterns.length > 0) {
      const normalPattern = patterns.find((pat) =>
        [pat.a, pat.b, pat.p, pat.c].every((cell) => trial[cell.r][cell.c]?.kind === 'normal')
      );
      const pat = normalPattern ?? patterns[0];
      const c0 = this.rngManager.shuffleRng.int(this.config.colors) as GemColor;
      const c1 = ((c0 + 1) % this.config.colors) as GemColor;

      for (const slot of [pat.a, pat.b, pat.c]) {
        const g = trial[slot.r][slot.c]!;
        trial[slot.r][slot.c] = { id: g.id, kind: 'normal', color: c0 };
        finalized[slot.r][slot.c] = true;
      }
      const pGem = trial[pat.p.r][pat.p.c]!;
      trial[pat.p.r][pat.p.c] = { id: pGem.id, kind: 'normal', color: c1 };
      finalized[pat.p.r][pat.p.c] = true;
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const gem = trial[r][c];
        if (!gem || finalized[r][c]) continue;

        if (!this.hasFinalizedMatchAt(trial, finalized, r, c, gem)) {
          finalized[r][c] = true;
          continue;
        }

        const allowedColors: GemColor[] = [];
        for (let clr = 0; clr < this.config.colors; clr++) {
          const gClr = clr as GemColor;
          if (!this.hasFinalizedMatchAt(trial, finalized, r, c, { id: gem.id, kind: 'normal', color: gClr })) {
            allowedColors.push(gClr);
          }
        }

        if (allowedColors.length > 0) {
          const chosen = allowedColors[this.rngManager.shuffleRng.int(allowedColors.length)];
          trial[r][c] = { id: gem.id, kind: 'normal', color: chosen };
        } else {
          trial[r][c] = { id: gem.id, kind: 'rainbow' };
        }
        finalized[r][c] = true;
      }
    }

    if (findValidMoves(trial).length === 0) {
      // Degenerate tiny board (e.g. 1x2, 2x2, 1x3): convert one adjacent normal/non-rainbow gem to rainbow
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const gem = trial[r][c];
          if (!gem || gem.kind === 'rainbow') continue;
          const hasNeighbor =
            (r + 1 < rows && trial[r + 1][c] !== null) ||
            (r - 1 >= 0 && trial[r - 1][c] !== null) ||
            (c + 1 < cols && trial[r][c + 1] !== null) ||
            (c - 1 >= 0 && trial[r][c - 1] !== null);
          if (hasNeighbor) {
            trial[r][c] = { id: gem.id, kind: 'rainbow' };
            return trial;
          }
        }
      }
    }

    return trial;
  }
}
