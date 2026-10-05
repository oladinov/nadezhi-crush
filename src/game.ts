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

import { type ColorMeta, getEmoteSetForLevel, DEFAULT_COLOR_METADATA } from './levels/emotes';
export type { ColorMeta };
export { getEmoteSetForLevel, DEFAULT_COLOR_METADATA };
export const COLOR_METADATA: ColorMeta[] = DEFAULT_COLOR_METADATA;

export interface BiomeInfo {
  name: string;
  icon: string;
  image: string;
  desc: string;
  emoteSetName?: string;
}

export function getLevelBiome(level: number): BiomeInfo {
  const emoteSet = getEmoteSetForLevel(level);
  if (level <= 4) {
    return {
      name: 'Praderas del Valle',
      icon: '🌿',
      image: '/fantasy_plains.jpg',
      desc: 'Campos verdes y cielo despejado de la Comarca.',
      emoteSetName: emoteSet.name,
    };
  } else if (level <= 8) {
    return {
      name: 'Colinas del Atardecer',
      icon: '🌅',
      image: '/fantasy_sunset.jpg',
      desc: 'Luz dorada sobre pacíficas aldeas con chimeneas humeantes.',
      emoteSetName: emoteSet.name,
    };
  } else if (level <= 12) {
    return {
      name: 'Caverna de Cristales',
      icon: '🔮',
      image: '/fantasy_cavern.jpg',
      desc: 'Profundidades ancestrales iluminadas por antorchas y gemas místicas.',
      emoteSetName: emoteSet.name,
    };
  } else if (level <= 16) {
    return {
      name: 'Bosque de las Luciérnagas',
      icon: '🌲',
      image: '/fantasy_night.jpg',
      desc: 'Noche estrellada bajo las ramas del Gran Árbol sagrado.',
      emoteSetName: emoteSet.name,
    };
  } else if (level <= 20) {
    return {
      name: 'Monte del Destino',
      icon: '🌋',
      image: '/fantasy_volcano.jpg',
      desc: 'Tierras volcánicas con ríos de fuego y desafíos ardientes.',
      emoteSetName: emoteSet.name,
    };
  } else if (level <= 24) {
    return {
      name: 'Erebor',
      icon: '⛏️',
      image: '/fantasy_erebor.jpg',
      desc: 'El más grande reino de la Tierra Media forjado bajo la Montaña Solitaria.',
      emoteSetName: emoteSet.name,
    };
  } else if (level <= 28) {
    return {
      name: 'Númenórë',
      icon: '⚓',
      image: '/fantasy_numenor.jpg',
      desc: 'Majestuoso imperio marítimo de los Dúnedain sobre el gran océano.',
      emoteSetName: emoteSet.name,
    };
  } else if (level <= 32) {
    return {
      name: 'Pixie Hollow',
      icon: '🧚',
      image: '/fantasy_pixie.jpg',
      desc: 'El valle encantado de las hadas, flores gigantes y polvillo dorado.',
      emoteSetName: emoteSet.name,
    };
  } else if (level <= 36) {
    return {
      name: 'Nunca Jamás',
      icon: '🏴‍☠️',
      image: '/fantasy_neverland.jpg',
      desc: 'La mítica isla de piratas, lagunas de sirenas y eterna juventud.',
      emoteSetName: emoteSet.name,
    };
  } else if (level <= 40) {
    return {
      name: 'Monte Vesubio',
      icon: '🔮',
      image: '/fantasy_vesubio.jpg',
      desc: 'La misteriosa guarida volcánica y santuario arcano de Magica De Spell.',
      emoteSetName: emoteSet.name,
    };
  } else {
    return {
      name: 'Tierras Infinitas',
      icon: '♾️',
      image: '/fantasy_infinite.jpg',
      desc: 'Islas celestiales flotantes y desafíos cósmicos infinitos.',
      emoteSetName: emoteSet.name,
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
  maxLevel: number;
  title: string;
  description: string;
  movesLeft: number;
  score: number;
  targetScore: number;
  goals: UIGoal[];
  state: GameState;
  skinMode: GemSkinMode;
  isMuted: boolean;
  isBgmMuted: boolean;
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
  public maxLevel = 1;

  private inactivityTimer: any = null;
  private onUIUpdateCallback?: (ui: UIStateUpdate) => void;

  constructor(private container: HTMLElement, onUIUpdate?: (ui: UIStateUpdate) => void) {
    this.onUIUpdateCallback = onUIUpdate;
    this.loadSavedProgress();
    this.initLevel(this.currentLevel);
  }

  private loadSavedProgress() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const savedCur = localStorage.getItem('nadezhi_current_level');
        const savedMax = localStorage.getItem('nadezhi_max_level');
        if (savedCur) {
          const curNum = parseInt(savedCur, 10);
          if (!isNaN(curNum) && curNum >= 1) this.currentLevel = Math.min(curNum, 100);
        }
        if (savedMax) {
          const maxNum = parseInt(savedMax, 10);
          if (!isNaN(maxNum) && maxNum >= 1) this.maxLevel = Math.min(maxNum, 100);
        }
      }
    } catch {
      this.maxLevel = 1;
      this.currentLevel = 1;
    }
  }

  public async initLevel(levelNumber: number) {
    this.currentLevel = levelNumber;
    this.maxLevel = Math.max(this.maxLevel, levelNumber);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('nadezhi_current_level', this.currentLevel.toString());
        localStorage.setItem('nadezhi_max_level', this.maxLevel.toString());
      }
    } catch {
      // Ignore if localStorage unavailable
    }
    const config = getLevelConfig(levelNumber);

    const previousSkin: GemSkinMode = this.gemManager ? this.gemManager.skinMode : 'emotes';

    // Clean up previous scene if exists
    if (this.scene) {
      this.clearInactivityTimer();
      this.fx.destroy();
      this.gemManager.destroy();
      this.input.destroy();
      this.player.destroy();
      this.scene.destroy();
    }

    // 1. Initialize Core Engine
    this.core = new CoreEngine(config);

    // 2. Initialize Scene and View Systems (empty board grid is rendered)
    this.scene = new GameScene(this.container, config.rows, config.cols);
    const emoteSet = getEmoteSetForLevel(levelNumber);
    this.gemManager = new GemViewManager(emoteSet.colors.map((c) => c.emoteIcon));
    this.gemManager.setSkinMode(previousSkin);
    this.fx = new FXManager(this.scene);
    this.player = new TimelinePlayer(this.scene, this.gemManager, this.fx);

    // Connect animation updates
    this.scene.onUpdate((dt, time) => {
      this.gemManager.updateViewGems(dt, time);
    });

    // 3. Initialize Input Manager (locked while gems fall into place)
    this.input = new InputManager(this.scene, {
      onMoveRequested: (a, b) => this.handleMove(a, b),
      onSelectionChanged: (cell) => this.handleSelection(cell),
    });

    this.state = 'Resolving';
    this.input.inputLock = true;
    this.notifyUI();

    try {
      // 4. Animate cascading entrance into the empty board
      await this.player.playBoardEntrance(this.core.snapshot);
    } catch (err) {
      console.error('Error during board entrance:', err);
      this.player.verifyAndResync(this.core.snapshot);
    } finally {
      this.state = 'Idle';
      this.input.inputLock = false;
      this.resetInactivityTimer();
      this.notifyUI();
    }
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

    try {
      // Core resolves entire turn synchronously and deterministically
      const result: TurnResult = this.core.resolveMove(a, b);

      // Running score for real-time HUD updates on each cascade wave
      let displayedScore = this.core.progress.score - result.pointsGained;

      // View replays steps asynchronously with GSAP and real-time score increments
      await this.player.play(result.steps, this.core.snapshot, (step) => {
        if (step.type === 'clear' || step.type === 'boardClear') {
          displayedScore += step.points;
          this.notifyUI(displayedScore);
        } else if (step.type === 'combo') {
          displayedScore += step.points;
          this.notifyUI(displayedScore);
        } else if (step.type === 'detonate' && step.points) {
          displayedScore += step.points;
          this.notifyUI(displayedScore);
        }
      });

      if (result.outcome === 'won') {
        this.state = 'LevelComplete';
        this.maxLevel = Math.max(this.maxLevel, this.currentLevel + 1);
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem('nadezhi_max_level', this.maxLevel.toString());
          }
        } catch {
          // Ignore
        }
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
    } catch (err) {
      console.error('Error during move resolution/animation:', err);
      this.player.verifyAndResync(this.core.snapshot);
      this.state = 'Idle';
      this.input.inputLock = false;
      this.resetInactivityTimer();
    } finally {
      if (this.state === 'Resolving') {
        this.state = 'Idle';
        this.input.inputLock = false;
      }
      this.notifyUI();
    }
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

  public toggleBgmMute(): boolean {
    const muted = sound.toggleBgmMute();
    this.notifyUI();
    return muted;
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

  public getColorMetadata(color: GemColor): ColorMeta {
    const emoteSet = getEmoteSetForLevel(this.currentLevel);
    return emoteSet.colors[color] || DEFAULT_COLOR_METADATA[color];
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
          const meta = this.getColorMetadata(g.color);
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
    const scoreGoal = this.core.config.goals.find((g) => g.type === 'score');
    const targetScore = scoreGoal ? scoreGoal.target : 2000;

    this.onUIUpdateCallback({
      level: this.currentLevel,
      maxLevel: this.maxLevel,
      title: this.core.config.title || `Nivel ${this.currentLevel}`,
      description: this.core.config.description || '',
      movesLeft: this.core.movesLeft,
      score: currentScore,
      targetScore,
      goals: goalsData,
      state: this.state,
      skinMode: this.gemManager.skinMode,
      isMuted: sound.isMuted,
      isBgmMuted: sound.isBgmMuted,
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
