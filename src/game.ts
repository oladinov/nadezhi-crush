import confetti from 'canvas-confetti';
import { CoreEngine } from './core/resolver';
import { Cell, TurnResult } from './core/types';
import { getLevelConfig } from './levels/generator';
import { GameScene } from './view/scene';
import { GemSkinMode, GemViewManager } from './view/gemViews';
import { FXManager } from './view/fx';
import { InputManager } from './view/input';
import { TimelinePlayer } from './view/player';
import { sound } from './audio/sound';

export type GameState =
  | 'Idle'
  | 'Selected'
  | 'Swapping'
  | 'Resolving'
  | 'LevelComplete'
  | 'LevelFailed';

export interface UIStateUpdate {
  level: number;
  title: string;
  description: string;
  movesLeft: number;
  score: number;
  goals: {
    description: string;
    current: number;
    target: number;
    completed: boolean;
  }[];
  state: GameState;
  skinMode: GemSkinMode;
  isMuted: boolean;
  volume: number;
}

export class Match3Game {
  public core!: CoreEngine;
  public scene!: GameScene;
  public gemManager!: GemViewManager;
  public fx!: FXManager;
  public input!: InputManager;
  public player!: TimelinePlayer;

  public state: GameState = 'Idle';
  public currentLevel = 1;

  private inactivityTimer: any = null;
  private onUIUpdateCallback?: (ui: UIStateUpdate) => void;

  constructor(private container: HTMLElement, onUIUpdate?: (ui: UIStateUpdate) => void) {
    this.onUIUpdateCallback = onUIUpdate;
    this.initLevel(this.currentLevel);
  }

  public initLevel(levelNumber: number) {
    this.currentLevel = levelNumber;
    const config = getLevelConfig(levelNumber);

    // Clean up previous scene if exists
    if (this.scene) {
      this.clearInactivityTimer();
      this.fx.clearAll();
      this.gemManager.clearAll();
      this.input.destroy();
      this.player.destroy();
      this.scene.destroy();
    }

    // 1. Initialize Core Engine
    this.core = new CoreEngine(config);

    // 2. Initialize Scene and View Systems
    this.scene = new GameScene(this.container, config.rows, config.cols);
    this.gemManager = new GemViewManager();
    this.fx = new FXManager(this.scene);
    this.player = new TimelinePlayer(this.scene, this.gemManager, this.fx);

    // Connect animation updates
    this.scene.onUpdate((dt, time) => {
      this.gemManager.updateViewGems(dt, time);
    });

    // 3. Populate board meshes
    const snapshot = this.core.snapshot;
    for (let r = 0; r < config.rows; r++) {
      for (let c = 0; c < config.cols; c++) {
        const gem = snapshot[r][c];
        if (gem) {
          const view = this.gemManager.createGemView(gem);
          const worldPos = this.scene.cellToWorld(r, c);
          view.group.position.copy(worldPos);
          this.scene.gemGroup.add(view.group);
        }
      }
    }

    // 4. Initialize Input Manager
    this.input = new InputManager(this.scene, {
      onMoveRequested: (a, b) => this.handleMove(a, b),
      onSelectionChanged: (cell) => this.handleSelection(cell),
    });

    this.state = 'Idle';
    this.input.inputLock = false;
    this.resetInactivityTimer();
    this.notifyUI();
  }

  public handleSelection(cell: Cell | null) {
    this.resetInactivityTimer();
    this.fx.clearHint();
    this.fx.showSelection(cell);
    this.state = cell ? 'Selected' : 'Idle';
    this.notifyUI();
  }

  public async handleMove(a: Cell, b: Cell) {
    if (this.state !== 'Idle' && this.state !== 'Selected') {
      return;
    }

    this.clearInactivityTimer();
    this.fx.clearHint();
    this.fx.showSelection(null);
    this.state = 'Resolving';
    this.input.inputLock = true;
    this.notifyUI();

    // Core resolves entire turn synchronously and deterministically
    const result: TurnResult = this.core.resolveMove(a, b);

    // Running score for real-time HUD updates on each cascade wave
    let displayedScore = this.core.progress.score - result.pointsGained;

    // View replays steps asynchronously with GSAP and real-time score increments
    await this.player.play(result.steps, this.core.snapshot, (step) => {
      if (step.type === 'clear') {
        displayedScore += step.points;
        this.notifyUI(displayedScore);
      }
    });

    if (result.outcome === 'won') {
      this.state = 'LevelComplete';
      sound.playWin();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } else if (result.outcome === 'lost') {
      this.state = 'LevelFailed';
      sound.playDefeat();
    } else {
      this.state = 'Idle';
      this.input.inputLock = false;
      this.resetInactivityTimer();
    }

    this.notifyUI();
  }

  private resetInactivityTimer() {
    this.clearInactivityTimer();
    this.inactivityTimer = setTimeout(() => {
      if (this.state === 'Idle') {
        const moves = this.core.findValidMoves();
        if (moves.length > 0) {
          // Highlight the first valid move as a hint
          this.fx.showHint(moves[0].a, moves[0].b);
        }
      }
    }, 5000);
  }

  private clearInactivityTimer() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  public restartLevel() {
    this.initLevel(this.currentLevel);
  }

  public nextLevel() {
    this.initLevel(this.currentLevel + 1);
  }

  public prevLevel() {
    if (this.currentLevel > 1) {
      this.initLevel(this.currentLevel - 1);
    }
  }

  public toggleSkin() {
    const newSkin: GemSkinMode = this.gemManager.skinMode === 'jewels' ? 'emotes' : 'jewels';
    this.gemManager.setSkinMode(newSkin);
    this.notifyUI();
  }

  public toggleMute() {
    sound.toggleMute();
    this.notifyUI();
  }

  public setVolume(val: number) {
    sound.setMasterVolume(val);
    this.notifyUI();
  }

  public notifyUI(customScore?: number) {
    if (!this.onUIUpdateCallback) return;

    const currentScore = customScore !== undefined ? customScore : this.core.progress.score;

    const goalsData = this.core.config.goals.map((g) => {
      let desc = '';
      let cur = 0;
      let target = 0;

      switch (g.type) {
        case 'score':
          desc = `Puntuación`;
          cur = currentScore;
          target = g.target;
          break;
        case 'collect': {
          const names = ['Rojo', 'Azul', 'Verde', 'Ámbar', 'Púrpura'];
          desc = `Gemas: ${names[g.color]}`;
          cur = this.core.progress.collected[g.color] || 0;
          target = g.count;
          break;
        }
        case 'detonate':
          desc = `Bombas activadas`;
          cur = this.core.progress.detonated;
          target = g.count;
          break;
        case 'create':
          if (g.kind === 'rainbow') {
            desc = `Crear Arcoíris`;
            cur = this.core.progress.created.rainbow;
          } else {
            desc = `Crear Bomba ${g.tier ? `Tier ${g.tier}` : ''}`.trim();
            cur =
              g.tier === 1
                ? this.core.progress.created.bomb1
                : g.tier === 2
                ? this.core.progress.created.bomb2
                : this.core.progress.created.bomb1 + this.core.progress.created.bomb2;
          }
          target = g.count;
          break;
      }

      return {
        description: desc,
        current: Math.min(cur, target),
        target,
        completed: cur >= target,
      };
    });

    this.onUIUpdateCallback({
      level: this.currentLevel,
      title: this.core.config.title || `Nivel ${this.currentLevel}`,
      description: this.core.config.description || '',
      movesLeft: this.core.movesLeft,
      score: currentScore,
      goals: goalsData,
      state: this.state,
      skinMode: this.gemManager.skinMode,
      isMuted: sound.isMuted,
      volume: sound.masterVolume,
    });
  }

  public destroy() {
    this.clearInactivityTimer();
    this.fx.clearAll();
    this.gemManager.clearAll();
    this.input.destroy();
    this.player.destroy();
    this.scene.destroy();
  }
}
