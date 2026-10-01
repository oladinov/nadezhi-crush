import confetti from 'canvas-confetti';
import { CoreEngine } from './core/resolver';
import { Cell, GemColor, TurnResult } from './core/types';
import { getLevelConfig } from './levels/generator';
import { GameScene } from './view/scene';
import { GemSkinMode, GemViewManager } from './view/gemViews';
import { FXManager } from './view/fx';
import { InputManager } from './view/input';
import { TimelinePlayer } from './view/player';
import { sound, MusicTrack } from './audio/sound';

export type GameState =
  | 'Idle'
  | 'Selected'
  | 'Swapping'
  | 'Resolving'
  | 'LevelComplete'
  | 'LevelFailed';

export interface ColorMeta {
  color: GemColor;
  emoteName: string;
  emoteIcon: string;
  jewelName: string;
  jewelIcon: string;
  colorHex: string;
}

export const COLOR_METADATA: ColorMeta[] = [
  { color: 0, emoteName: 'Payasito', emoteIcon: '/emotes/1103355444124209192.webp', jewelName: 'Rubí', jewelIcon: '🔴', colorHex: '#ef4444' },
  { color: 1, emoteName: 'Asustada', emoteIcon: '/emotes/1103355458179309619.webp', jewelName: 'Zafiro', jewelIcon: '🔷', colorHex: '#3b82f6' },
  { color: 2, emoteName: 'Gatito Amor', emoteIcon: '/emotes/1142187365251686491.webp', jewelName: 'Esmeralda', jewelIcon: '🟢', colorHex: '#10b981' },
  { color: 3, emoteName: 'Gatito GG', emoteIcon: '/emotes/1536895951950577814.webp', jewelName: 'Topacio', jewelIcon: '🟡', colorHex: '#f59e0b' },
  { color: 4, emoteName: 'Labure', emoteIcon: '/emotes/1536895958728835182.webp', jewelName: 'Amatista', jewelIcon: '🟣', colorHex: '#a855f7' },
];

export interface BiomeInfo {
  name: string;
  image: string;
  desc: string;
}

export function getLevelBiome(level: number): BiomeInfo {
  if (level <= 4) {
    return {
      name: 'Praderas del Valle',
      image: '/fantasy_plains.jpg',
      desc: 'Campos verdes y cielo despejado de la Comarca.',
    };
  } else if (level <= 8) {
    return {
      name: 'Colinas del Atardecer',
      image: '/fantasy_sunset.jpg',
      desc: 'Luz dorada sobre pacíficas aldeas con chimeneas humeantes.',
    };
  } else if (level <= 12) {
    return {
      name: 'Caverna de Cristales',
      image: '/fantasy_cavern.jpg',
      desc: 'Profundidades ancestrales iluminadas por antorchas y gemas místicas.',
    };
  } else if (level <= 16) {
    return {
      name: 'Bosque de las Luciérnagas',
      image: '/fantasy_night.jpg',
      desc: 'Noche estrellada bajo las ramas del Gran Árbol sagrado.',
    };
  } else {
    return {
      name: 'Monte del Destino',
      image: '/fantasy_volcano.jpg',
      desc: 'Tierras volcánicas con ríos de fuego y desafíos ardientes.',
    };
  }
}

export interface UIGoal {
  description: string;
  current: number;
  target: number;
  completed: boolean;
  icon: string;
  iconType: 'image' | 'text';
}

export interface UIStateUpdate {
  level: number;
  title: string;
  description: string;
  movesLeft: number;
  score: number;
  goals: UIGoal[];
  state: GameState;
  skinMode: GemSkinMode;
  isMuted: boolean;
  volume: number;
  biome: BiomeInfo;
  currentTrack: MusicTrack;
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

  public nextMusicTrack(): MusicTrack {
    const track = sound.nextTrack();
    this.notifyUI();
    return track;
  }

  public notifyUI(customScore?: number) {
    if (!this.onUIUpdateCallback) return;

    const currentScore = customScore !== undefined ? customScore : this.core.progress.score;
    const isEmotes = this.gemManager.skinMode === 'emotes';

    const goalsData: UIGoal[] = this.core.config.goals.map((g) => {
      let desc = '';
      let cur = 0;
      let target = 0;
      let icon = '';
      let iconType: 'image' | 'text' = 'text';

      switch (g.type) {
        case 'score':
          desc = `Puntos`;
          icon = '⭐';
          iconType = 'text';
          cur = currentScore;
          target = g.target;
          break;
        case 'collect': {
          const meta = COLOR_METADATA[g.color];
          if (isEmotes) {
            desc = meta.emoteName;
            icon = meta.emoteIcon;
            iconType = 'image';
          } else {
            desc = `Joya ${meta.jewelName}`;
            icon = meta.jewelIcon;
            iconType = 'text';
          }
          cur = this.core.progress.collected[g.color] || 0;
          target = g.count;
          break;
        }
        case 'detonate':
          desc = `Detonar Bombas`;
          icon = '💣';
          iconType = 'text';
          cur = this.core.progress.detonated;
          target = g.count;
          break;
        case 'create':
          if (g.kind === 'rainbow') {
            desc = `Crear Arcoíris`;
            icon = '🌈';
            iconType = 'text';
            cur = this.core.progress.created.rainbow;
          } else {
            desc = g.tier === 1 ? 'Crear Bomba 3×3' : g.tier === 2 ? 'Crear Bomba 5×5' : 'Crear Bomba';
            icon = g.tier === 2 ? '💥' : '💣';
            iconType = 'text';
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
        icon,
        iconType,
      };
    });

    const biome = getLevelBiome(this.currentLevel);

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
      biome,
      currentTrack: sound.currentTrack,
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
